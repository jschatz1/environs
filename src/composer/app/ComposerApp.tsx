import {
  signal,
  computed,
  effect,
  batch,
  mount,
  Show,
  For,
  onMount,
  onCleanup,
} from '../../index.js';
import { createCommandBus } from '../commands/bus.js';
import { createEditorState, type TranscriptEntry } from './EditorState.js';
import { parseExplicit } from '../commands/parseExplicit.js';
import { parseNatural } from '../commands/parseNatural.js';
import { executeStatement } from '../commands/toCommands.js';
import { compileToIR, type IR } from '../compiler/compileToIR.js';
import { diffIR } from '../compiler/diffIR.js';
import { createDOMBackend, type DOMBackend } from '../backend/domBackend.js';
import { getSuggestions } from './suggestions.js';
import { DEMOS, getDemoCommands } from './demos.js';

// ---------------------------------------------------------------------------
// Main Composer Application
// ---------------------------------------------------------------------------

function ComposerApp() {
  const bus = createCommandBus();
  const editor = createEditorState(bus);

  // Stage ref
  let stageEl: HTMLDivElement | null = null;
  let backend: DOMBackend | null = null;
  let prevIR: IR | null = null;

  // Input state
  const inputValue = signal('');
  const inputRef = signal<HTMLInputElement | null>(null);

  // Viewport state
  type Viewport = 'desktop' | 'landscape' | 'portrait';
  const viewport = signal<Viewport>('desktop');

  // Autocomplete state
  const selectedSuggestionIndex = signal(-1);
  const suggestions = computed(() => getSuggestions(inputValue(), bus.doc()));

  // ---------------------------------------------------------------------------
  // Compilation pipeline: doc changes → IR → DOM patches
  // ---------------------------------------------------------------------------
  effect(() => {
    const doc = bus.doc();
    if (!backend || !stageEl) return;

    const ir = compileToIR(doc);
    const patches = diffIR(prevIR, ir);
    backend.applyPatches(patches);
    prevIR = ir;

    // Ensure root element is in stage
    const rootEl = backend.getElement(doc.rootId);
    if (rootEl && !rootEl.parentNode) {
      stageEl.appendChild(rootEl);
    }
  });

  // ---------------------------------------------------------------------------
  // Handle input submission
  // ---------------------------------------------------------------------------
  function handleSubmit(e?: Event) {
    e?.preventDefault();
    const raw = inputValue().trim();
    if (!raw) return;

    // Handle "demo" command
    const demoMatch = raw.match(/^demo(?:\s+(\S+))?$/i);
    if (demoMatch) {
      const demoId = demoMatch[1];
      if (!demoId) {
        // Bare "demo" — list available demos
        const listing: TranscriptEntry = {
          input: raw,
          explicit: [],
          status: 'ok',
          errors: [],
          messages: [
            'Available demos:',
            ...Object.entries(DEMOS).map(
              ([id, d]) => `  demo ${id}  — ${d.name}: ${d.description}`
            ),
          ],
        };
        editor.transcript.update(t => [...t, listing]);
        inputValue.set('');
        const el = inputRef();
        if (el) el.value = '';
        return;
      }

      const commands = getDemoCommands(demoId);
      if (!commands) {
        const errEntry: TranscriptEntry = {
          input: raw,
          explicit: [],
          status: 'err',
          errors: [`Unknown demo "${demoId}". Type "demo" to see available demos.`],
          messages: [],
        };
        editor.transcript.update(t => [...t, errEntry]);
        inputValue.set('');
        const el = inputRef();
        if (el) el.value = '';
        return;
      }

      // Reset document to blank slate before running demo
      bus.importLog('[]');
      editor.transcript.set([]);
      editor.scopeStack.set([]);
      editor.selectedId.set(null);

      // Remove old stage content and re-init
      if (stageEl) {
        while (stageEl.firstChild) stageEl.removeChild(stageEl.firstChild);
        backend = createDOMBackend(stageEl);
        prevIR = null;
      }

      // Feed demo commands through the existing pipeline, one entry per command
      const headerEntry: TranscriptEntry = {
        input: raw,
        explicit: [],
        status: 'ok',
        errors: [],
        messages: [`Running demo ${demoId}: ${DEMOS[demoId].name}`],
      };
      const entries: TranscriptEntry[] = [headerEntry];

      for (const cmd of commands) {
        const parsed = parseExplicit(cmd);
        const entry: TranscriptEntry = {
          input: cmd,
          explicit: [],
          status: 'ok',
          errors: [],
          messages: [],
        };

        for (const line of parsed.lines) {
          for (const stmt of line.statements) {
            const result = executeStatement(stmt, {
              bus,
              scopeStack: editor.scopeStack(),
              selectedId: editor.selectedId(),
            });
            if (result.docCommands.length > 0) {
              bus.dispatch(result.docCommands);
            }
            for (const ecmd of result.editorCommands) {
              const msgs = editor.applyEditorCommand(ecmd, bus);
              entry.messages.push(...msgs);
            }
            entry.messages.push(...result.transcript);
            entry.errors.push(...result.errors);
          }
        }

        if (entry.errors.length > 0) entry.status = 'err';
        entries.push(entry);
      }

      editor.transcript.update(t => [...t, ...entries]);
      inputValue.set('');
      const el = inputRef();
      if (el) el.value = '';
      return;
    }

    const entry: TranscriptEntry = {
      input: raw,
      explicit: [],
      status: 'ok',
      errors: [],
      messages: [],
    };

    // Try explicit parse first
    const parsed = parseExplicit(raw);
    const hasError = parsed.lines.some(l =>
      l.statements.some(s => s.command.type === 'error')
    );

    let lines = parsed.lines;

    // If explicit parse fails, try NL mapping
    if (hasError) {
      const nl = parseNatural(raw);
      if (nl.explicit.length > 0) {
        entry.explicit = nl.explicit;
        const combined = nl.explicit.join('; ');
        const reparsed = parseExplicit(combined);
        lines = reparsed.lines;
      }
    } else {
      entry.explicit = [raw];
    }

    // Execute all statements
    for (const line of lines) {
      for (const stmt of line.statements) {
        const result = executeStatement(stmt, {
          bus,
          scopeStack: editor.scopeStack(),
          selectedId: editor.selectedId(),
        });

        // Apply doc commands
        if (result.docCommands.length > 0) {
          bus.dispatch(result.docCommands);
        }

        // Apply editor commands
        for (const ecmd of result.editorCommands) {
          const msgs = editor.applyEditorCommand(ecmd, bus);
          entry.messages.push(...msgs);
        }

        entry.messages.push(...result.transcript);
        entry.errors.push(...result.errors);
      }
    }

    if (entry.errors.length > 0) entry.status = 'err';

    editor.transcript.update(t => [...t, entry]);
    inputValue.set('');
    const el = inputRef();
    if (el) el.value = '';
  }

  // ---------------------------------------------------------------------------
  // Autocomplete helpers
  // ---------------------------------------------------------------------------
  function acceptSuggestion(suggestion: string) {
    const raw = inputValue();
    const endsWithSpace = raw.endsWith(' ');
    const parts = raw.split(/\s+/);
    if (endsWithSpace || parts.length <= 1) {
      // Append suggestion after current input
      const prefix = endsWithSpace ? raw : (parts.length > 1 ? parts.slice(0, -1).join(' ') + ' ' : '');
      inputValue.set(prefix + suggestion + ' ');
    } else {
      // Replace last partial word
      const prefix = parts.slice(0, -1).join(' ') + ' ';
      inputValue.set(prefix + suggestion + ' ');
    }
    selectedSuggestionIndex.set(-1);
    const el = inputRef();
    if (el) {
      el.value = inputValue();
      el.focus();
    }
  }

  function handleInputKeyDown(e: KeyboardEvent) {
    const suggs = suggestions();
    const idx = selectedSuggestionIndex();

    if (suggs.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedSuggestionIndex.set(idx < suggs.length - 1 ? idx + 1 : 0);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedSuggestionIndex.set(idx > 0 ? idx - 1 : suggs.length - 1);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const pick = idx >= 0 ? suggs[idx] : suggs[0];
        if (pick) acceptSuggestion(pick);
        return;
      }
      if (e.key === 'Enter') {
        if (idx >= 0) {
          e.preventDefault();
          acceptSuggestion(suggs[idx]);
          return;
        }
        // No highlight — fall through to submit
        handleSubmit();
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        selectedSuggestionIndex.set(-1);
        inputValue.set(inputValue()); // force close by resetting
        return;
      }
    } else {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Stage click handler — selection
  // ---------------------------------------------------------------------------
  function handleStageClick(e: MouseEvent) {
    const target = (e.target as HTMLElement).closest('[data-nodeid]');
    if (target) {
      const nodeId = target.getAttribute('data-nodeid');
      if (nodeId) {
        editor.selectedId.set(nodeId);
      }
    } else {
      editor.selectedId.set(null);
    }
  }

  // ---------------------------------------------------------------------------
  // Selection highlight overlay
  // ---------------------------------------------------------------------------
  const selectionRect = signal<{ top: number; left: number; width: number; height: number } | null>(null);

  effect(() => {
    const id = editor.selectedId();
    if (!id || !backend) { selectionRect.set(null); return; }

    const el = backend.getElement(id);
    if (!el || !stageEl) { selectionRect.set(null); return; }

    const stageRect = stageEl.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    selectionRect.set({
      top: elRect.top - stageRect.top,
      left: elRect.left - stageRect.left,
      width: elRect.width,
      height: elRect.height,
    });
  });

  // ---------------------------------------------------------------------------
  // Keyboard shortcuts
  // ---------------------------------------------------------------------------
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && e.target !== inputRef()) {
      editor.selectedId.set(null);
    }
    // Ctrl+Z undo, Ctrl+Shift+Z redo
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.target !== inputRef()) {
      e.preventDefault();
      if (e.shiftKey) {
        bus.redo();
      } else {
        bus.undo();
      }
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div class="flex flex-col h-screen bg-slate-50 font-sans text-slate-900">
      {/* Header */}
      <header class="h-12 flex items-center justify-between px-4 border-b border-slate-200 bg-white shrink-0">
        <div class="flex items-center gap-3">
          <h1 class="text-sm font-bold tracking-tight">Composer</h1>
          {/* Breadcrumbs */}
          <nav class="flex items-center gap-1 text-xs text-slate-500">
            <For each={editor.breadcrumbs}>
              {(crumb, index) => (
                <span class="flex items-center gap-1">
                  <Show when={() => index() > 0}>
                    {() => <span class="text-slate-300">/</span>}
                  </Show>
                  <button
                    class="hover:text-slate-800 transition"
                    onClick={() => {
                      const stack = editor.scopeStack();
                      editor.scopeStack.set(stack.slice(0, index() + 1));
                    }}
                  >
                    {crumb.name}
                  </button>
                </span>
              )}
            </For>
          </nav>
        </div>
        <div class="flex items-center gap-3 text-xs text-slate-400">
          {/* Viewport toggle buttons */}
          <div class="flex items-center gap-0.5 border border-slate-200 rounded-lg p-0.5">
            <button
              class={() => viewport() === 'desktop'
                ? 'p-1.5 rounded-md bg-slate-200 text-slate-800'
                : 'p-1.5 rounded-md text-slate-400 hover:text-slate-600'}
              onClick={() => viewport.set('desktop')}
              title="Desktop"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </button>
            <button
              class={() => viewport() === 'landscape'
                ? 'p-1.5 rounded-md bg-slate-200 text-slate-800'
                : 'p-1.5 rounded-md text-slate-400 hover:text-slate-600'}
              onClick={() => viewport.set('landscape')}
              title="Tablet landscape (768px)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="5" width="22" height="14" rx="2" ry="2"/><line x1="18" y1="9" x2="18" y2="15"/></svg>
            </button>
            <button
              class={() => viewport() === 'portrait'
                ? 'p-1.5 rounded-md bg-slate-200 text-slate-800'
                : 'p-1.5 rounded-md text-slate-400 hover:text-slate-600'}
              onClick={() => viewport.set('portrait')}
              title="Phone portrait (375px)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="1" width="14" height="22" rx="2" ry="2"/><line x1="9" y1="18" x2="15" y2="18"/></svg>
            </button>
          </div>
          <Show when={() => editor.selectedId() !== null}>
            {() => (
              <span class="px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                {() => {
                  const id = editor.selectedId();
                  const doc = bus.doc();
                  const node = id ? doc.nodes.get(id) : null;
                  return node?.name ?? id ?? '';
                }}
              </span>
            )}
          </Show>
        </div>
      </header>

      {/* Main area */}
      <div class="flex flex-1 overflow-hidden">
        {/* Transcript sidebar */}
        <aside class="w-80 shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div class="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Transcript
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-1">
            <For each={editor.transcript}>
              {(entry) => (
                <div class={() =>
                  entry.status === 'err'
                    ? 'rounded-lg border border-red-100 bg-red-50 p-2 text-xs'
                    : 'rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs'
                }>
                  <div class="font-mono text-slate-700 mb-1">{() => `> ${entry.input}`}</div>
                  <Show when={() => entry.explicit.length > 0 && entry.explicit[0] !== entry.input}>
                    {() => (
                      <div class="text-slate-400 mb-1">
                        <For each={() => entry.explicit}>
                          {(cmd) => <div class="font-mono">{cmd}</div>}
                        </For>
                      </div>
                    )}
                  </Show>
                  <For each={() => entry.messages}>
                    {(msg) => <div class="text-slate-600">{msg}</div>}
                  </For>
                  <For each={() => entry.errors}>
                    {(err) => <div class="text-red-600">{err}</div>}
                  </For>
                </div>
              )}
            </For>
          </div>
        </aside>

        {/* Stage */}
        <div class="flex-1 flex flex-col overflow-hidden">
          <div class={() =>
            viewport() === 'desktop'
              ? 'flex-1 overflow-auto relative'
              : 'flex-1 overflow-auto relative bg-slate-100'
          }>
            <div
              class={() => {
                const base = '@container relative';
                const v = viewport();
                if (v === 'portrait') return base + ' max-w-[375px] mx-auto border-x border-slate-200 bg-white shadow-lg min-h-full';
                if (v === 'landscape') return base + ' max-w-[768px] mx-auto border-x border-slate-200 bg-white shadow-lg min-h-full';
                return base;
              }}
              ref={(el: HTMLDivElement) => {
                stageEl = el;
                backend = createDOMBackend(el);
                // Trigger initial compilation
                const doc = bus.doc();
                const ir = compileToIR(doc);
                const patches = diffIR(null, ir);
                backend.applyPatches(patches);
                prevIR = ir;
                const rootEl = backend.getElement(doc.rootId);
                if (rootEl) el.appendChild(rootEl);
              }}
              onClick={(e: MouseEvent) => handleStageClick(e)}
            >
              {/* Selection overlay */}
              <Show when={() => selectionRect() !== null}>
                {() => {
                  const rect = selectionRect()!;
                  return (
                    <div
                      class="absolute pointer-events-none border-2 border-blue-500 rounded-sm z-50"
                      style={() =>
                        `top:${rect.top}px;left:${rect.left}px;width:${rect.width}px;height:${rect.height}px`
                      }
                    >
                      <div class="absolute -top-5 left-0 bg-blue-500 text-white text-[10px] px-1 rounded-sm font-medium whitespace-nowrap">
                        {() => {
                          const id = editor.selectedId();
                          const doc = bus.doc();
                          const node = id ? doc.nodes.get(id) : null;
                          return node?.name ?? node?.kind ?? id ?? '';
                        }}
                      </div>
                    </div>
                  );
                }}
              </Show>
            </div>
          </div>

          {/* Input bar */}
          <div class="border-t border-slate-200 bg-white p-3">
            <form
              class="flex gap-2"
              onSubmit={(e: Event) => handleSubmit(e)}
            >
              <div class="flex-1 relative">
                {/* Suggestions dropdown */}
                <Show when={() => suggestions().length > 0}>
                  {() => (
                    <div class="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-50 max-h-60 overflow-y-auto">
                      <For each={suggestions}>
                        {(suggestion, index) => (
                          <div
                            class={() =>
                              index() === selectedSuggestionIndex()
                                ? 'px-3 py-1.5 text-sm font-mono cursor-pointer bg-blue-50 text-blue-700'
                                : 'px-3 py-1.5 text-sm font-mono cursor-pointer hover:bg-slate-50 text-slate-700'
                            }
                            onMouseDown={(e: MouseEvent) => {
                              e.preventDefault();
                              acceptSuggestion(suggestion);
                            }}
                          >
                            {suggestion}
                          </div>
                        )}
                      </For>
                    </div>
                  )}
                </Show>
                <input
                  ref={(el: HTMLInputElement) => inputRef.set(el)}
                  class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition placeholder:text-slate-400"
                  placeholder="Type a command or describe what you want..."
                  value={inputValue}
                  onInput={(e: InputEvent) => {
                    inputValue.set((e.target as HTMLInputElement).value);
                    selectedSuggestionIndex.set(-1);
                  }}
                  onKeyDown={(e: KeyboardEvent) => handleInputKeyDown(e)}
                />
              </div>
              <button
                type="submit"
                class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition shrink-0"
              >
                Run
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export mount function
// ---------------------------------------------------------------------------
export function mountComposer(container: Element) {
  return mount(ComposerApp, container);
}

export default ComposerApp;
