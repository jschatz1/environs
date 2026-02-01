import type { DocCommand } from './types.js';
import type { DocumentModel } from '../document/model.js';
import { createDocument } from '../document/model.js';
import { applyCommand } from '../document/reducer.js';
import type { IdState } from '../document/ids.js';

// ---------------------------------------------------------------------------
// Compaction result
// ---------------------------------------------------------------------------

export interface CompactionResult {
  originalCommandCount: number;
  compactedCommandCount: number;
  commands: DocCommand[];
  preview: string[];
}

// ---------------------------------------------------------------------------
// Flatten undo stack into a single command list
// ---------------------------------------------------------------------------

export function getEffectiveCommands(undoStack: DocCommand[][]): DocCommand[] {
  const cmds: DocCommand[] = [];
  for (const group of undoStack) {
    cmds.push(...group);
  }
  return cmds;
}

// ---------------------------------------------------------------------------
// Replay commands to get final document state
// ---------------------------------------------------------------------------

export function reduceToFinalState(commands: DocCommand[]): DocumentModel {
  let doc = createDocument();
  for (const cmd of commands) {
    doc = applyCommand(doc, cmd);
  }
  return doc;
}

// ---------------------------------------------------------------------------
// Generate the minimal canonical command set from a document
// ---------------------------------------------------------------------------

export function generateCanonicalCommands(doc: DocumentModel): DocCommand[] {
  const cmds: DocCommand[] = [];
  const defaultDoc = createDocument();
  const defaultRoot = defaultDoc.nodes.get(defaultDoc.rootId)!;

  // 1. SetRoutingConfig if routes exist
  if (doc.routing.routes.length > 0) {
    cmds.push({ type: 'SetRoutingConfig', routes: doc.routing.routes });
  }

  // 2. SetFSMs if any FSMs defined
  if (doc.fsms.size > 0) {
    cmds.push({ type: 'SetFSMs', fsms: Array.from(doc.fsms.entries()) });
  }

  // 2b. SetMacros if any macros defined
  if (doc.macros.size > 0) {
    cmds.push({ type: 'SetMacros', macros: Array.from(doc.macros.entries()) });
  }

  // 3. Root node — only emit commands if it differs from defaults
  const root = doc.nodes.get(doc.rootId);
  if (root) {
    // SetProps if props differ from defaults
    if (Object.keys(root.props).length > 0) {
      cmds.push({ type: 'SetProps', id: root.id, propsPatch: { ...root.props } });
    }

    // ApplyStyleTokens if non-empty
    if (root.styleTokens.length > 0) {
      cmds.push({ type: 'ApplyStyleTokens', id: root.id, tokensSet: [...root.styleTokens] });
    }

    // AttachLayout if layout differs from default stack
    if (root.layout && !layoutEquals(root.layout, defaultRoot.layout!)) {
      cmds.push({
        type: 'AttachLayout',
        id: root.id,
        layoutType: root.layout.type,
        options: { ...root.layout.options },
      });
    }

    // RenameNode if name differs from default
    if (root.name !== defaultRoot.name) {
      cmds.push({ type: 'RenameNode', id: root.id, name: root.name ?? '' });
    }

    // ScriptSet if root has a script
    if (root.script) {
      cmds.push({ type: 'ScriptSet', id: root.id, language: root.script.language, source: root.script.source });
    }
  }

  // 4. CreateNode for every non-root node (sorted by id)
  const nonRootNodes = Array.from(doc.nodes.values())
    .filter(n => n.id !== doc.rootId)
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const node of nonRootNodes) {
    const createCmd: DocCommand = {
      type: 'CreateNode',
      id: node.id,
      kind: node.kind,
      name: node.name,
      tag: node.tag,
      initialProps: Object.keys(node.props).length > 0 ? { ...node.props } : undefined,
      initialStyleTokens: node.styleTokens.length > 0 ? [...node.styleTokens] : undefined,
      layout: node.layout ? { type: node.layout.type, options: { ...node.layout.options } } : undefined,
    };
    cmds.push(createCmd);
  }

  // 5. PlaceChild for every edge (sorted by parentId, slot, order, childId)
  const sortedEdges = [...doc.edges].sort((a, b) =>
    a.parentId.localeCompare(b.parentId)
    || a.slot.localeCompare(b.slot)
    || a.order - b.order
    || a.childId.localeCompare(b.childId)
  );

  for (const edge of sortedEdges) {
    cmds.push({
      type: 'PlaceChild',
      parentId: edge.parentId,
      slot: edge.slot,
      childId: edge.childId,
      order: edge.order,
    });
  }

  // 6. ScriptSet for every non-root node with a script (sorted by id)
  for (const node of nonRootNodes) {
    if (node.script) {
      cmds.push({
        type: 'ScriptSet',
        id: node.id,
        language: node.script.language,
        source: node.script.source,
      });
    }
  }

  return cmds;
}

// ---------------------------------------------------------------------------
// Update IdState counters from final document so future allocations don't collide
// ---------------------------------------------------------------------------

export function updateIdStateFromDoc(idState: IdState, doc: DocumentModel): void {
  const pattern = /^(.+)-(\d+)$/;
  for (const id of doc.nodes.keys()) {
    const match = pattern.exec(id);
    if (match) {
      const kind = match[1];
      const num = parseInt(match[2], 10);
      const current = idState.counters[kind] ?? 0;
      if (num > current) {
        idState.counters[kind] = num;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main compaction entry point
// ---------------------------------------------------------------------------

export function compactHistory(undoStack: DocCommand[][]): CompactionResult {
  const effective = getEffectiveCommands(undoStack);
  const doc = reduceToFinalState(effective);
  const commands = generateCanonicalCommands(doc);

  const preview: string[] = [];
  preview.push(`Original: ${effective.length} command(s) in ${undoStack.length} group(s)`);
  preview.push(`Compacted: ${commands.length} command(s) in 1 group`);
  if (commands.length > 0) {
    preview.push('');
    preview.push('Commands:');
    for (const cmd of commands) {
      preview.push(`  ${describeCommand(cmd)}`);
    }
  }

  return {
    originalCommandCount: effective.length,
    compactedCommandCount: commands.length,
    commands,
    preview,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slotPathStr(parentId: string, slot: string): string {
  // Use 'root' keyword for the root node since the parser recognizes it.
  // For other nodes, use bare ID (no # prefix) so parseSlotPath can handle it.
  const parent = parentId === 'root' ? 'root' : parentId;
  return `${parent}/${slot}`;
}

function layoutEquals(
  a: { type: string; options: Record<string, any> },
  b: { type: string; options: Record<string, any> },
): boolean {
  if (a.type !== b.type) return false;
  const aKeys = Object.keys(a.options).sort();
  const bKeys = Object.keys(b.options).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
    if (a.options[aKeys[i]] !== b.options[bKeys[i]]) return false;
  }
  return true;
}

export function describeCommand(cmd: DocCommand): string {
  switch (cmd.type) {
    case 'CreateNode': {
      const label = cmd.name ? ` "${cmd.name}"` : '';
      const style = cmd.initialStyleTokens?.length ? ` style ${cmd.initialStyleTokens.join(' ')}` : '';
      if (cmd.kind === 'layout' && cmd.layout) {
        return `layout ${cmd.layout.type}${cmd.name ? ` as "${cmd.name}"` : ''}${style}`;
      }
      return `add ${cmd.kind}${label}${cmd.name ? ` as "${cmd.name}"` : ''}${style}`;
    }
    case 'SetProps': {
      const props = Object.entries(cmd.propsPatch).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
      return `set #${cmd.id} ${props}`;
    }
    case 'ApplyStyleTokens': {
      const tokens = cmd.tokensSet ?? cmd.tokensAdd ?? [];
      return `style #${cmd.id} ${tokens.join(' ')}`;
    }
    case 'AttachLayout':
      return `layout ${cmd.layoutType} on #${cmd.id}`;
    case 'PlaceChild':
      return `place #${cmd.childId} in ${slotPathStr(cmd.parentId, cmd.slot)}`;
    case 'RemoveChild':
      return `delete #${cmd.childId} from ${slotPathStr(cmd.parentId, cmd.slot)}`;
    case 'DeleteNode':
      return `delete #${cmd.id}`;
    case 'RenameNode':
      return `rename #${cmd.id} "${cmd.name}"`;
    case 'MoveChild':
      return `move #${cmd.childId} to ${slotPathStr(cmd.toParentId, cmd.toSlot)}`;
    case 'ScriptSet':
      return `script set #${cmd.id}`;
    case 'ScriptClear':
      return `script clear #${cmd.id}`;
    case 'DefineFSM':
      return `fsm define ${cmd.name} initial ${cmd.initialState}`;
    case 'FSMAddTransitions': {
      const transitions = Object.entries(cmd.transitions).map(([ev, tgt]) => `on ${ev} ${tgt}`).join(' ');
      return `fsm state ${cmd.name} ${cmd.stateName} ${transitions}`;
    }
    case 'DeleteFSM':
      return `fsm delete ${cmd.name}`;
    case 'AddRoute':
      return `route add ${cmd.name} "${cmd.pattern}"`;
    case 'RemoveRoute':
      return `route remove ${cmd.name}`;
    case 'SetScreen':
      return `screen set ${cmd.routeName} ${cmd.screenNodeName}`;
    case 'SetRoutingConfig': {
      const routes = cmd.routes.map(r => `route add ${r.name} "${r.pattern}"`);
      return routes.join('; ');
    }
    case 'SetFSMs': {
      const names = cmd.fsms.map(([name]) => name).join(', ');
      return `fsm bulk set [${names}]`;
    }
    case 'DuplicateNode':
      return `dup #${cmd.sourceId}${cmd.name ? ` as "${cmd.name}"` : ''}`;
    case 'DefineMacro':
      return `macro define "${cmd.name}"`;
    case 'UpdateMacroParams':
      return `macro params "${cmd.name}" ${cmd.params.join(' ')}`;
    case 'DeleteMacro':
      return `macro delete "${cmd.name}"`;
    case 'SetMacros': {
      const names = cmd.macros.map(([name]) => name).join(', ');
      return `macro bulk set [${names}]`;
    }
    default: {
      const _exhaustive: never = cmd;
      return (_exhaustive as any).type;
    }
  }
}
