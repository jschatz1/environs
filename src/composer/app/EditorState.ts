import { signal, computed, batch } from '../../index.js';
import type { NodeId } from '../document/ids.js';
import type { EditorCommand } from '../commands/types.js';
import type { CommandBus } from '../commands/bus.js';
import { describeNode } from '../document/selectors.js';
import { getRouter } from '../router/runtime.js';
import { compactHistory, describeCommand } from '../commands/compaction.js';

// ---------------------------------------------------------------------------
// Editor state (selection, scope, transcript)
// ---------------------------------------------------------------------------

export interface TranscriptEntry {
  input: string;
  explicit: string[];
  status: 'ok' | 'err';
  errors: string[];
  messages: string[];
}

export interface EditorState {
  selectedId: ReturnType<typeof signal<NodeId | null>>;
  scopeStack: ReturnType<typeof signal<NodeId[]>>;
  transcript: ReturnType<typeof signal<TranscriptEntry[]>>;
  currentScopeId: ReturnType<typeof computed<NodeId>>;
  breadcrumbs: ReturnType<typeof computed<{ id: NodeId; name: string }[]>>;
  applyEditorCommand(cmd: EditorCommand, bus: CommandBus): string[];
}

export function createEditorState(bus: CommandBus): EditorState {
  const selectedId = signal<NodeId | null>(null);
  const scopeStack = signal<NodeId[]>(['root']);
  const transcript = signal<TranscriptEntry[]>([]);

  const currentScopeId = computed(() => {
    const stack = scopeStack();
    return stack[stack.length - 1] ?? 'root';
  });

  const breadcrumbs = computed(() => {
    const doc = bus.doc();
    return scopeStack().map(id => {
      const node = doc.nodes.get(id);
      return { id, name: node?.name ?? id };
    });
  });

  function applyEditorCommand(cmd: EditorCommand, bus: CommandBus): string[] {
    const messages: string[] = [];

    switch (cmd.type) {
      case 'Select':
        selectedId.set(cmd.id);
        break;

      case 'EnterScope': {
        const id = cmd.id ?? selectedId();
        if (id) {
          scopeStack.update(s => [...s, id]);
          selectedId.set(null);
          messages.push(`Scope: ${id}`);
        }
        break;
      }

      case 'ExitScope': {
        scopeStack.update(s => {
          const newStack = [...s];
          for (let i = 0; i < cmd.count && newStack.length > 1; i++) {
            newStack.pop();
          }
          return newStack;
        });
        selectedId.set(null);
        break;
      }

      case 'Undo':
        bus.undo(cmd.count);
        transcript.update(t => t.slice(0, -(cmd.count)));
        break;

      case 'Redo':
        bus.redo(cmd.count);
        messages.push(`Redid ${cmd.count} action(s)`);
        break;

      case 'Show': {
        const doc = bus.doc();
        const id = cmd.id ?? selectedId() ?? currentScopeId();
        const desc = describeNode(doc, id);
        if (desc) {
          messages.push(`${desc.kind} "${desc.name ?? desc.id}"`);
          messages.push(`  Slots: ${desc.slots.join(', ')}`);
          messages.push(`  Tokens: ${desc.styleTokens.join(' ') || '(none)'}`);
          if (desc.script) {
            const lineCount = desc.script.source.split('\n').length;
            messages.push(`  Script: ${desc.script.language} v${desc.script.version} (${lineCount} line${lineCount !== 1 ? 's' : ''})`);
          }
          for (const [slot, children] of Object.entries(desc.childrenBySlot)) {
            if (children.length > 0) {
              messages.push(`  [${slot}]: ${children.map(c => c.name ?? c.id).join(', ')}`);
            }
          }
        } else {
          messages.push(`Node not found: ${id}`);
        }
        break;
      }

      case 'List': {
        const doc = bus.doc();
        const scopeId = currentScopeId();
        if (cmd.kind === 'children' || cmd.kind === 'nodes') {
          const desc = describeNode(doc, scopeId);
          if (desc) {
            for (const [slot, children] of Object.entries(desc.childrenBySlot)) {
              for (const child of children) {
                messages.push(`  [${slot}] ${child.kind} "${child.name ?? child.id}"`);
              }
            }
          }
        } else if (cmd.kind === 'slots') {
          const node = doc.nodes.get(scopeId);
          if (node?.layout) {
            messages.push(`Slots: ${node.layout.slots.join(', ')} (default: ${node.layout.defaultSlot})`);
          }
        }
        break;
      }

      case 'Export': {
        if (cmd.kind === 'log') {
          const lines = bus.log.map(c => describeCommand(c));
          const text = lines.join('\n');
          if (cmd.target === 'file') {
            const name = cmd.path ?? 'environs-log.txt';
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            a.click();
            URL.revokeObjectURL(url);
            messages.push(`Exported ${lines.length} command(s) to ${name}`);
          } else if (cmd.target === 'clipboard') {
            navigator.clipboard?.writeText(text);
            messages.push(`Copied ${lines.length} command(s) to clipboard`);
          } else {
            messages.push(...lines);
          }
        }
        break;
      }

      case 'Import': {
        if (cmd.kind === 'log') {
          if (cmd.source === 'file') {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt,.json';
            input.onchange = () => {
              const file = input.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const content = reader.result as string;
                const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#') && !l.startsWith('//'));
                // Reset state before replaying
                bus.replaceHistory([]);
                transcript.set([]);
                scopeStack.set(['root']);
                selectedId.set(null);
                // Emit a custom event so ComposerApp can replay the lines
                document.dispatchEvent(new CustomEvent('environs:import', { detail: { lines, fileName: file.name } }));
              };
              reader.readAsText(file);
            };
            input.click();
          } else if (cmd.data) {
            const json = typeof cmd.data === 'string' ? cmd.data : JSON.stringify(cmd.data);
            bus.importLog(json);
            messages.push('Imported command log');
          }
        }
        break;
      }

      case 'RouteGoto': {
        const router = getRouter();
        if (cmd.mode === 'replace') {
          router.replace(cmd.path);
          messages.push(`Navigated to ${cmd.path} (replace)`);
        } else {
          router.push(cmd.path);
          messages.push(`Navigated to ${cmd.path}`);
        }
        break;
      }

      case 'RouteList': {
        const doc = bus.doc();
        if (doc.routing.routes.length === 0) {
          messages.push('No routes defined');
        } else {
          messages.push('Routes:');
          for (const route of doc.routing.routes) {
            const screen = route.screenNodeName || '(no screen)';
            messages.push(`  ${route.name}  ${route.pattern}  → ${screen}`);
          }
        }
        break;
      }

      case 'RouteWhere': {
        const router = getRouter();
        const loc = router.location();
        messages.push(`Path: ${loc.pathname}`);
        if (loc.routeName) {
          messages.push(`Route: ${loc.routeName}`);
        } else {
          messages.push('Route: (no match)');
        }
        if (Object.keys(loc.params).length > 0) {
          messages.push(`Params: ${JSON.stringify(loc.params)}`);
        }
        if (Object.keys(loc.query).length > 0) {
          messages.push(`Query: ${JSON.stringify(loc.query)}`);
        }
        break;
      }

      case 'HistoryCompact': {
        const result = compactHistory(bus.undoStack);
        if (cmd.mode === 'preview') {
          messages.push(...result.preview);
          messages.push('');
          messages.push('Run `history compact --apply` to apply.');
        } else {
          bus.replaceHistory(result.commands);
          // Rebuild transcript to reflect the compacted command list
          const newTranscript: TranscriptEntry[] = result.commands.map(c => ({
            input: describeCommand(c),
            explicit: [],
            status: 'ok' as const,
            errors: [],
            messages: [],
          }));
          transcript.set(newTranscript);
        }
        break;
      }

      case 'Help': {
        const topic = cmd.topic;
        const helpTopics: Record<string, string[]> = {
          add: [
            'add <kind> [\"label\"] [as <name>] [style <tokens...>]',
            '  Kinds: section, text, button, image, input, card, heading, nav, list, container',
            '  Example: add button "Click me" as myBtn style tone:primary rounded',
          ],
          layout: [
            'layout <type> [as <name>] [style <tokens...>]',
            '  Types: stack, sidebar, grid, center, split, tabs',
            '  Example: layout sidebar as page',
          ],
          style: [
            'style [<target>] <tokens...>',
            '  Tokens: pad-sm, pad-md, rounded, shadow, tone:primary, gap-md, ...',
            '  Example: style #myBtn tone:danger rounded shadow',
          ],
          set: [
            'set [<target>] <prop>=<value> ...',
            '  Example: set #myBtn disabled=true',
          ],
          place: [
            'place <target> in <slot-path> [order <n>]',
            '  Example: place #myBtn in #page/main',
          ],
          move: [
            'move <target> to <slot-path> [order <n>]',
            '  Example: move #myBtn to #sidebar/left',
          ],
          select: [
            'select <target>',
            '  Target: #id, name, selected, scope, root',
            '  Example: select #myBtn',
          ],
          enter: [
            'enter [<target>]',
            '  Enter scope of target node (or selected node)',
          ],
          exit: [
            'exit [<count>]',
            '  Exit current scope (count times, default 1)',
          ],
          show: [
            'show [<target>] [--flags]',
            '  Show details of a node',
          ],
          list: [
            'list [children|nodes|slots]',
            '  List children or slots in current scope',
          ],
          rename: [
            'rename <target> <new-name>',
            '  Example: rename #myBtn "Submit"',
          ],
          delete: [
            'delete <target> [--recursive]',
            '  Example: delete #myBtn',
          ],
          dup: [
            'dup <target> [as <name>] [--deep]',
            '  Duplicate a node',
          ],
          undo: ['undo [<count>]'],
          redo: ['redo [<count>]'],
          export: [
            'export log [clipboard|file|console]',
            '  Export command log as user-facing commands.',
            '  clipboard — copy to clipboard (default)',
            '  file — download as .txt file',
            '  console — print to transcript',
          ],
          import: [
            'import log [file|inline <json>]',
            '  Import a command log.',
            '  file — open file picker (.txt or .json)',
            '  inline <json> — import inline JSON',
          ],
          script: [
            'script set [<target>]  — enter script capture mode',
            'script end             — save captured script',
            'script show [<target>] — display current script source',
            'script clear [<target>] — remove script from node',
            '  In capture mode, type JS using self (DOM) and ctx (reactivity).',
            '  Example: self.onClick(() => ctx.log("clicked"))',
          ],
          fsm: [
            'fsm define <name> initial <state>  — create a new FSM',
            'fsm state <fsm> <state> on <EVENT> <target> [on ...]  — add transitions',
            'fsm show [<name>]  — display FSM graph (or list all)',
            'fsm list  — list all defined FSMs',
            'fsm delete <name>  — remove an FSM',
            '  Use in scripts: const m = ctx.global.fsm("name")',
            '  m.current()  m.send("EVENT")  m.state (signal)',
          ],
          route: [
            'route add <name> "<pattern>"  — define a route',
            'route remove <name>           — remove a route',
            'route goto "<path>" [--replace] — navigate to a path',
            'route list                    — list all defined routes',
            'route where                   — show current location and matched route',
            '  Example: route add home "/"',
            '  Example: route add post "/post/:id"',
          ],
          screen: [
            'screen set <routeName> <nodeName>  — map a route to a screen node',
            '  Example: screen set home homeScreen',
          ],
          history: [
            'history compact [--preview|--apply]',
            '  Compact the command history to a minimal canonical form.',
            '  --preview (default): show what the compacted history would look like.',
            '  --apply: replace the current history with the compacted version.',
            '  Undo/redo history is replaced. Undo after compact undoes the entire state.',
          ],
          help: ['help [<command>]  or  ? [<command>]'],
        };

        if (topic && helpTopics[topic]) {
          messages.push(...helpTopics[topic]);
        } else {
          messages.push('Commands: add, layout, style, set, place, move, select, enter, exit, show, list, rename, delete, dup, undo, redo, export, import, script, fsm, route, screen, history');
          messages.push('Type ? <command> for details (e.g. ? add)');
        }
        break;
      }
    }

    return messages;
  }

  return {
    selectedId,
    scopeStack,
    transcript,
    currentScopeId,
    breadcrumbs,
    applyEditorCommand,
  };
}
