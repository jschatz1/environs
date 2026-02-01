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
import { parseExplicit, type ParsedLine } from '../commands/parseExplicit.js';
import { parseNatural } from '../commands/parseNatural.js';
import { expandRepeat } from '../commands/expandRepeat.js';
import { executeStatement } from '../commands/toCommands.js';
import { compileToIR, type IR } from '../compiler/compileToIR.js';
import { diffIR } from '../compiler/diffIR.js';
import { createDOMBackend, type DOMBackend } from '../backend/domBackend.js';
import { getSuggestions } from './suggestions.js';
import { highlightCommand } from './highlight.js';
import { DEMOS, getDemoCommands, type DemoStep } from './demos.js';
import { runScriptsForDocument, disposeAllScripts } from '../script/runtime.js';
import { syncFSMs, resetAllFSMs } from '../fsm/registry.js';
import { getRouter, resetRouter } from '../router/runtime.js';
import type { NodeId } from '../document/ids.js';

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
  const inputRef = signal<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Command history for up/down arrow recall
  const commandHistory: string[] = [];
  let historyIndex = -1; // -1 means not browsing history
  let savedInput = ''; // saves current input when entering history

  // Viewport state
  type Viewport = 'desktop' | 'landscape' | 'portrait';
  const viewport = signal<Viewport>('desktop');

  // Script capture mode
  const scriptCapture = signal<{ targetId: NodeId } | null>(null);

  // Multi-line input mode (triggered by pasting text with newlines)
  const multiLine = signal(false);

  // Autocomplete state
  const selectedSuggestionIndex = signal(-1);
  const suggestions = computed(() => getSuggestions(inputValue(), bus.doc()));

  // Reactivity bridge: bumped after scripts run so repeat nodes re-read signals
  const repeatVersion = signal(0);

  // ---------------------------------------------------------------------------
  // Compilation pipeline: doc changes → IR → DOM patches
  // ---------------------------------------------------------------------------
  effect(() => {
    const doc = bus.doc();
    repeatVersion(); // subscribe so we recompile when scripts create repeat-items signals
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
  // Script execution: run after DOM patches
  // ---------------------------------------------------------------------------
  effect(() => {
    const doc = bus.doc();
    if (!backend) return;
    // Sync FSM registry before running scripts so ctx.global.fsm() works
    syncFSMs(doc);
    const errors = runScriptsForDocument(doc, backend);
    if (errors.length > 0) {
      const entry: TranscriptEntry = {
        input: '',
        explicit: [],
        status: 'err',
        errors: errors.map(e => `Script error on ${e.nodeId} (${e.phase}): ${e.message}`),
        messages: [],
      };
      editor.transcript.update(t => [...t, entry]);
    }

    // Bump repeatVersion so the compilation effect re-runs and picks up
    // any signals that scripts just created (e.g. window.__app.todos)
    const hasRepeat = Array.from(doc.nodes.values()).some(n => n.layout?.type === 'repeat');
    if (hasRepeat) {
      repeatVersion.set(repeatVersion() + 1);
    }
  });

  // ---------------------------------------------------------------------------
  // Router: sync route definitions when doc changes
  // ---------------------------------------------------------------------------
  // Ensure a router instance exists at startup
  getRouter();

  effect(() => {
    const doc = bus.doc();
    getRouter().syncRoutes(doc.routing.routes);
  });

  // ---------------------------------------------------------------------------
  // Router: toggle screen visibility when location changes
  // ---------------------------------------------------------------------------
  effect(() => {
    const doc = bus.doc();
    const loc = getRouter().location();

    for (const route of doc.routing.routes) {
      if (!route.screenNodeName) continue;
      for (const [id, node] of doc.nodes) {
        if (node.name === route.screenNodeName && backend) {
          const el = backend.getElement(id);
          if (el) el.classList.toggle('hidden', route.name !== loc.routeName);
        }
      }
    }
  });

  // ---------------------------------------------------------------------------
  // Run a single command string through parse → execute → transcript
  // ---------------------------------------------------------------------------
  function runCommand(raw: string): void {
    const entry: TranscriptEntry = {
      input: raw,
      explicit: [],
      status: 'ok',
      errors: [],
      messages: [],
    };

    const expanded = expandRepeat(raw);

    const parsed = parseExplicit(expanded);

    // Per-line NL fallback: only re-parse lines that have errors, not the
    // entire input.  Sending a large multi-line script (especially after
    // repeat expansion) through parseNatural produces garbage.
    const lines = parsed.lines.flatMap(line => {
      const hasLineError = line.statements.some(s => s.command.type === 'error');
      if (!hasLineError) return [line];

      // Split: keep valid statements, NL-fallback only the error ones
      const validStmts = line.statements.filter(s => s.command.type !== 'error');
      const errorStmts = line.statements.filter(s => s.command.type === 'error');

      const lineText = errorStmts
        .map(s => (s.command as { input: string }).input)
        .join(' ');

      const result: ParsedLine[] = [];
      if (validStmts.length > 0) {
        result.push({ statements: validStmts });
      }

      if (lineText) {
        const nl = parseNatural(lineText);
        if (nl.explicit.length > 0) {
          entry.explicit.push(...nl.explicit);
          const combined = nl.explicit.join('; ');
          const reparsed = parseExplicit(combined);
          result.push(...reparsed.lines);
        } else {
          // NL parser couldn't help — keep error statements for error reporting
          result.push({ statements: errorStmts });
        }
      }

      return result.length > 0 ? result : [line];
    });

    if (entry.explicit.length === 0) {
      entry.explicit = [raw];
    }

    for (const line of lines) {
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

        if (result.scriptCaptureTarget) {
          scriptCapture.set({ targetId: result.scriptCaptureTarget });
          const existingNode = bus.doc().nodes.get(result.scriptCaptureTarget);
          if (existingNode?.script) {
            inputValue.set(existingNode.script.source);
          }
        }
      }
    }

    if (entry.errors.length > 0) entry.status = 'err';
    editor.transcript.update(t => [...t, entry]);
  }

  // ---------------------------------------------------------------------------
  // Listen for import replay events
  // ---------------------------------------------------------------------------
  document.addEventListener('environs:import', ((e: CustomEvent<{ lines: string[]; fileName?: string }>) => {
    // Reset DOM backend for clean slate
    if (stageEl) {
      while (stageEl.firstChild) stageEl.removeChild(stageEl.firstChild);
      backend = createDOMBackend(stageEl);
      prevIR = null;
    }
    for (const line of e.detail.lines) {
      runCommand(line);
    }
  }) as EventListener);

  // ---------------------------------------------------------------------------
  // Handle input submission
  // ---------------------------------------------------------------------------
  function handleSubmit(e?: Event) {
    e?.preventDefault();

    // Script capture mode: read directly from the textarea element,
    // not from inputValue (the textarea has no onInput handler).
    const capture = scriptCapture();
    if (capture) {
      const el = inputRef();
      const source = (el ? el.value : inputValue()).trim();
      if (!source) return;
      const lineCount = source.split('\n').length;
      bus.dispatch([{
        type: 'ScriptSet',
        id: capture.targetId,
        language: 'js',
        source,
      }]);
      const node = bus.doc().nodes.get(capture.targetId);
      const entry: TranscriptEntry = {
        input: source.split('\n').map(l => `  ${l}`).join('\n'),
        explicit: [],
        status: 'ok',
        errors: [],
        messages: [`Script set on ${node?.name ?? capture.targetId} (${lineCount} line${lineCount !== 1 ? 's' : ''})`],
      };
      editor.transcript.update(t => [...t, entry]);
      scriptCapture.set(null);
      inputValue.set('');
      if (el) el.value = '';
      return;
    }

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
      disposeAllScripts();
      resetAllFSMs();
      resetRouter();
      scriptCapture.set(null);
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

      // Feed demo commands one at a time with a delay so you see it build out
      const headerEntry: TranscriptEntry = {
        input: raw,
        explicit: [],
        status: 'ok',
        errors: [],
        messages: [`Running demo ${demoId}: ${DEMOS[demoId].name}`],
      };
      editor.transcript.update(t => [...t, headerEntry]);

      const STEP_DELAY = 60; // ms between commands

      function runDemoStep(index: number) {
        if (index >= commands.length) return;
        const step = commands[index];

        // Script attachment step — dispatch ScriptSet directly
        if (typeof step !== 'string') {
          const doc = bus.doc();
          let targetId: NodeId | undefined;
          for (const [id, node] of doc.nodes) {
            if (node.name === step.scriptTarget) { targetId = id; break; }
          }
          if (targetId) {
            bus.dispatch([{
              type: 'ScriptSet',
              id: targetId,
              language: 'js',
              source: step.source,
            }]);
            const lineCount = step.source.split('\n').length;
            const entry: TranscriptEntry = {
              input: `script set ${step.scriptTarget}`,
              explicit: [],
              status: 'ok',
              errors: [],
              messages: [`Script set on ${step.scriptTarget} (${lineCount} line${lineCount !== 1 ? 's' : ''})`],
            };
            editor.transcript.update(t => [...t, entry]);
          }
          if (index < commands.length - 1) {
            setTimeout(() => runDemoStep(index + 1), STEP_DELAY);
          }
          return;
        }

        const parsed = parseExplicit(step);
        const entry: TranscriptEntry = {
          input: step,
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
        editor.transcript.update(t => [...t, entry]);

        if (index < commands.length - 1) {
          setTimeout(() => runDemoStep(index + 1), STEP_DELAY);
        }
      }

      runDemoStep(0);
      inputValue.set('');
      const el = inputRef();
      if (el) el.value = '';
      return;
    }

    commandHistory.push(raw);
    historyIndex = -1;
    savedInput = '';

    // Clear input state BEFORE runCommand — runCommand may set scriptCapture,
    // which triggers the script capture textarea to mount. If inputValue isn't
    // cleared first, the textarea reads the stale command text.
    inputValue.set('');
    multiLine.set(false);
    const el = inputRef();
    if (el) el.value = '';

    runCommand(raw);
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

  function handlePaste(e: ClipboardEvent) {
    const text = e.clipboardData?.getData('text') ?? '';
    if (text.includes('\n')) {
      e.preventDefault();
      const current = inputValue();
      const el = inputRef() as HTMLInputElement | HTMLTextAreaElement | null;
      // Insert pasted text at cursor position
      const start = el?.selectionStart ?? current.length;
      const end = el?.selectionEnd ?? current.length;
      const newVal = current.slice(0, start) + text + current.slice(end);
      inputValue.set(newVal);
      multiLine.set(true);
      // Focus and set cursor will happen after the textarea renders
      requestAnimationFrame(() => {
        const ta = inputRef();
        if (ta) {
          ta.value = newVal;
          ta.focus();
          const cursorPos = start + text.length;
          ta.selectionStart = ta.selectionEnd = cursorPos;
        }
      });
    }
  }

  function handleInputKeyDown(e: KeyboardEvent) {
    // In multi-line mode: Enter inserts newline, Cmd/Ctrl+Enter submits
    if (multiLine()) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        multiLine.set(false);
        // Keep value, just switch back to single-line if no newlines remain
        const val = inputValue();
        if (!val.includes('\n')) {
          requestAnimationFrame(() => {
            const el = inputRef();
            if (el) { el.value = val; el.focus(); }
          });
        } else {
          multiLine.set(true); // stay in multi-line
        }
        return;
      }
      // Let all other keys (including Enter for newline) pass through
      return;
    }

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
      if (e.key === 'ArrowUp') {
        if (commandHistory.length === 0) return;
        e.preventDefault();
        if (historyIndex === -1) {
          savedInput = inputValue();
          historyIndex = commandHistory.length - 1;
        } else if (historyIndex > 0) {
          historyIndex--;
        }
        const val = commandHistory[historyIndex];
        inputValue.set(val);
        const el = inputRef();
        if (el) el.value = val;
        return;
      }
      if (e.key === 'ArrowDown') {
        if (historyIndex === -1) return;
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
          historyIndex++;
          const val = commandHistory[historyIndex];
          inputValue.set(val);
          const el = inputRef();
          if (el) el.value = val;
        } else {
          historyIndex = -1;
          inputValue.set(savedInput);
          const el = inputRef();
          if (el) el.value = savedInput;
        }
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
                  <div
                    class="font-mono text-slate-700 mb-1 whitespace-pre-wrap"
                    ref={(el: HTMLElement) => { el.innerHTML = '&gt; ' + highlightCommand(entry.input); }}
                  />
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
                    {(msg) => <div class="text-slate-600 whitespace-pre-wrap">{msg}</div>}
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
          {/* Browser chrome */}
          <div class="shrink-0 bg-slate-200 border-b border-slate-300 px-3 py-2 flex items-center gap-3">
            <div class="flex items-center gap-1.5">
              <div class="w-3 h-3 rounded-full bg-[#FF5F57]" />
              <div class="w-3 h-3 rounded-full bg-[#FEBC2E]" />
              <div class="w-3 h-3 rounded-full bg-[#28C840]" />
            </div>
            <div class="flex items-center gap-2">
              <div class="flex items-center gap-1">
                <button
                  class={() => getRouter().canGoBack()
                    ? 'text-slate-500 hover:text-slate-700 cursor-pointer'
                    : 'text-slate-300 cursor-default'}
                  onClick={() => getRouter().back()}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button
                  class={() => getRouter().canGoForward()
                    ? 'text-slate-500 hover:text-slate-700 cursor-pointer'
                    : 'text-slate-300 cursor-default'}
                  onClick={() => getRouter().forward()}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>
            <div class="flex-1 flex items-center bg-white rounded-lg border border-slate-300 px-3 py-1 text-xs text-slate-500 font-mono">
              <svg class="shrink-0 mr-1.5 text-slate-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>{() => `localhost:5173${getRouter().location().pathname}`}</span>
            </div>
          </div>
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
            <Show when={() => scriptCapture() !== null}>
              {() => {
                const cap = scriptCapture()!;
                const targetNode = bus.doc().nodes.get(cap.targetId);
                const label = targetNode?.name ?? cap.targetId;
                return (
                  <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-2 text-xs">
                      <span class="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold">Script mode</span>
                      <span class="text-slate-500">Writing JS for <span class="font-medium text-slate-700">{label}</span></span>
                      <button
                        class="ml-auto text-slate-400 hover:text-slate-600 text-xs"
                        onClick={() => { scriptCapture.set(null); inputValue.set(''); }}
                      >
                        Cancel
                      </button>
                    </div>
                    <div class="flex gap-2">
                      <textarea
                        ref={(el: HTMLTextAreaElement) => {
                          inputRef.set(el);
                          const existing = inputValue();
                          if (existing) el.value = existing;
                          inputValue.set('');
                          el.focus();
                          el.selectionStart = el.selectionEnd = el.value.length;
                        }}
                        class="w-full px-3 py-2 rounded-lg border border-amber-300 bg-amber-50/30 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition placeholder:text-slate-400 resize-y min-h-[80px]"
                        rows={5}
                        placeholder="Type JS code here... (Cmd+Enter to save)"
                        onKeyDown={(e: KeyboardEvent) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault();
                            handleSubmit();
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            scriptCapture.set(null);
                          }
                        }}
                      />
                      <button
                        class="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 active:bg-amber-700 transition shrink-0 self-end"
                        onClick={() => handleSubmit()}
                      >
                        Save
                      </button>
                    </div>
                    <div class="text-[10px] text-slate-400">Cmd+Enter to save &middot; Escape to cancel</div>
                  </div>
                );
              }}
            </Show>
            <Show when={() => scriptCapture() === null}>
              {() => (
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
                    <Show when={multiLine}>
                      {() => {
                        let overlayRef: HTMLDivElement | undefined;
                        return (
                          <div class="flex flex-col gap-1">
                            <div class="relative">
                              <div
                                ref={(el: HTMLDivElement) => { overlayRef = el; el.innerHTML = highlightCommand(inputValue()); }}
                                class="absolute inset-0 px-3 py-2 text-sm font-mono whitespace-pre-wrap break-words pointer-events-none overflow-hidden"
                                aria-hidden="true"
                                style="border: 1px solid transparent; line-height: 1.5;"
                              />
                              <textarea
                                ref={(el: HTMLTextAreaElement) => {
                                  inputRef.set(el);
                                  const val = inputValue();
                                  if (val) { el.value = val; }
                                  el.focus();
                                  el.selectionStart = el.selectionEnd = el.value.length;
                                  // Sync scroll
                                  el.addEventListener('scroll', () => {
                                    if (overlayRef) overlayRef.scrollTop = el.scrollTop;
                                  });
                                }}
                                class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none transition placeholder:text-slate-400 resize-y min-h-[80px] relative"
                                style="color: transparent; caret-color: #334155; background: transparent; line-height: 1.5;"
                                rows={4}
                                placeholder="Type commands (one per line)... Cmd+Enter to run"
                                onInput={(e: InputEvent) => {
                                  const val = (e.target as HTMLTextAreaElement).value;
                                  inputValue.set(val);
                                  selectedSuggestionIndex.set(-1);
                                  if (overlayRef) overlayRef.innerHTML = highlightCommand(val);
                                }}
                                onKeyDown={(e: KeyboardEvent) => handleInputKeyDown(e)}
                                onPaste={(e: ClipboardEvent) => handlePaste(e)}
                              />
                            </div>
                            <div class="text-[10px] text-slate-400">Cmd+Enter to run &middot; Escape to collapse</div>
                          </div>
                        );
                      }}
                    </Show>
                    <Show when={() => !multiLine()}>
                      {() => (
                        <input
                          ref={(el: HTMLInputElement) => inputRef.set(el)}
                          class="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none transition placeholder:text-slate-400"
                          placeholder="Type a command or describe what you want..."
                          value={inputValue}
                          onInput={(e: InputEvent) => {
                            inputValue.set((e.target as HTMLInputElement).value);
                            selectedSuggestionIndex.set(-1);
                          }}
                          onKeyDown={(e: KeyboardEvent) => handleInputKeyDown(e)}
                          onPaste={(e: ClipboardEvent) => handlePaste(e)}
                        />
                      )}
                    </Show>
                  </div>
                  <button
                    type="submit"
                    class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 active:bg-blue-800 transition shrink-0"
                  >
                    Run
                  </button>
                </form>
              )}
            </Show>
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
