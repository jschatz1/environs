import { signal, computed, batch } from '../../index.js';
import type { NodeId } from '../document/ids.js';
import type { EditorCommand } from '../commands/types.js';
import type { CommandBus } from '../commands/bus.js';
import { describeNode } from '../document/selectors.js';

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
        messages.push(`Undid ${cmd.count} action(s)`);
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
          const json = bus.exportLog();
          if (cmd.target === 'clipboard') {
            navigator.clipboard?.writeText(json);
            messages.push('Command log copied to clipboard');
          } else {
            messages.push(json);
          }
        }
        break;
      }

      case 'Import': {
        if (cmd.kind === 'log' && cmd.data) {
          const json = typeof cmd.data === 'string' ? cmd.data : JSON.stringify(cmd.data);
          bus.importLog(json);
          messages.push('Imported command log');
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
            'export log [clipboard|console]',
            '  Export command log',
          ],
          import: [
            'import log <json>',
            '  Import a command log',
          ],
          help: ['help [<command>]  or  ? [<command>]'],
        };

        if (topic && helpTopics[topic]) {
          messages.push(...helpTopics[topic]);
        } else {
          messages.push('Commands: add, layout, style, set, place, move, select, enter, exit, show, list, rename, delete, dup, undo, redo, export, import');
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
