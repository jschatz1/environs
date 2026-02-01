// ---------------------------------------------------------------------------
// Convert parsed explicit commands → DocCommands + EditorCommands
// ---------------------------------------------------------------------------

import type { ParsedCommand, ParsedStatement, ParsedSlotPath, ParsedTarget, ParsedStyleToken } from './parseExplicit.js';
import type { DocCommand, EditorCommand, Command } from './types.js';
import type { CommandBus } from './bus.js';
import type { DocumentModel, NodeRecord, TemplateNode } from '../document/model.js';
import type { NodeId } from '../document/ids.js';
import { resolveTarget } from '../document/selectors.js';
import { getDefaultSlot } from '../document/model.js';
import type { LayoutType, NodeKind } from '../document/model.js';
import { compileTokens } from '../style/tokens.js';
import { captureTemplate, expandTemplate } from '../macro/expand.js';

export interface ExecutionContext {
  bus: CommandBus;
  scopeStack: NodeId[];
  selectedId: NodeId | null;
}

export interface ExecutionResult {
  docCommands: DocCommand[];
  editorCommands: EditorCommand[];
  errors: string[];
  transcript: string[];
  scriptCaptureTarget?: NodeId;
}

export function executeStatement(
  stmt: ParsedStatement,
  ctx: ExecutionContext,
): ExecutionResult {
  const result: ExecutionResult = {
    docCommands: [],
    editorCommands: [],
    errors: [],
    transcript: [],
  };

  const doc = ctx.bus.doc();
  const scopeId = ctx.scopeStack[ctx.scopeStack.length - 1] ?? doc.rootId;

  // Resolve scope prefix
  let targetScopeId = scopeId;
  let targetSlot: string | undefined;
  if (stmt.scope) {
    const resolved = resolveSlotPath(stmt.scope, doc, scopeId, ctx.selectedId);
    if (resolved) {
      targetScopeId = resolved.parentId;
      targetSlot = resolved.slot;
    }
  }

  const cmd = stmt.command;

  switch (cmd.type) {
    case 'add': {
      const id = ctx.bus.allocId(cmd.kind);
      const parentNode = doc.nodes.get(targetScopeId);
      const slot = targetSlot ?? (parentNode ? getDefaultSlot(parentNode) : 'content');

      const createCmd: DocCommand = {
        type: 'CreateNode',
        id,
        kind: cmd.kind as NodeKind,
        name: cmd.as ?? id,
        initialProps: cmd.label ? { text: cmd.label } : {},
        initialStyleTokens: cmd.style ? cmd.style.map(tokenToString) : [],
      };
      result.docCommands.push(createCmd);
      result.docCommands.push({
        type: 'PlaceChild',
        parentId: targetScopeId,
        slot,
        childId: id,
      });
      result.transcript.push(`Created ${cmd.kind} "${cmd.label ?? id}" in ${targetScopeId}/${slot}`);
      break;
    }

    case 'layout': {
      const id = ctx.bus.allocId('layout');
      const parentNode = doc.nodes.get(targetScopeId);
      const slot = targetSlot ?? (parentNode ? getDefaultSlot(parentNode) : 'content');

      result.docCommands.push({
        type: 'CreateNode',
        id,
        kind: 'layout',
        name: cmd.as,
        initialStyleTokens: cmd.style ? cmd.style.map(tokenToString) : [],
        layout: {
          type: cmd.layoutType as LayoutType,
          options: optionsToRecord(cmd.options ?? []),
        },
      });
      result.docCommands.push({
        type: 'PlaceChild',
        parentId: targetScopeId,
        slot,
        childId: id,
      });
      result.transcript.push(`Created layout ${cmd.layoutType} "${cmd.as ?? id}" in ${targetScopeId}/${slot}`);
      break;
    }

    case 'style': {
      const targetId = resolveCommandTarget(cmd.target, doc, scopeId, ctx.selectedId);
      if (!targetId) {
        result.errors.push('No target for style command');
        break;
      }
      const tokenStrings = cmd.tokens.map(tokenToString);
      const node = doc.nodes.get(targetId);
      const { warnings } = compileTokens(tokenStrings, node?.kind);
      if (warnings.length > 0) {
        result.errors.push(...warnings);
      }
      result.docCommands.push({
        type: 'ApplyStyleTokens',
        id: targetId,
        tokensAdd: tokenStrings,
      });
      const name = node?.name ?? targetId;
      result.transcript.push(`Applied style tokens to ${name}`);
      break;
    }

    case 'set': {
      const targetId = resolveCommandTarget(cmd.target, doc, scopeId, ctx.selectedId);
      if (!targetId) {
        result.errors.push('No target for set command');
        break;
      }
      const patch: Record<string, any> = {};
      for (const p of cmd.props) patch[p.key] = p.value;
      result.docCommands.push({
        type: 'SetProps',
        id: targetId,
        propsPatch: patch,
      });
      result.transcript.push(`Set props on ${targetId}`);
      break;
    }

    case 'place': {
      const nodeId = resolveCommandTarget(cmd.node, doc, scopeId, ctx.selectedId);
      if (!nodeId) { result.errors.push('Cannot resolve node for place'); break; }
      const resolved = resolveSlotPath(cmd.slotPath, doc, scopeId, ctx.selectedId);
      if (!resolved) { result.errors.push('Cannot resolve slot path for place'); break; }
      result.docCommands.push({
        type: 'PlaceChild',
        parentId: resolved.parentId,
        slot: resolved.slot ?? 'content',
        childId: nodeId,
        order: cmd.order,
      });
      result.transcript.push(`Placed ${nodeId} in ${resolved.parentId}/${resolved.slot}`);
      break;
    }

    case 'move': {
      const nodeId = resolveCommandTarget(cmd.node, doc, scopeId, ctx.selectedId);
      if (!nodeId) { result.errors.push('Cannot resolve node for move'); break; }
      const resolved = resolveSlotPath(cmd.slotPath, doc, scopeId, ctx.selectedId);
      if (!resolved) { result.errors.push('Cannot resolve slot path for move'); break; }
      result.docCommands.push({
        type: 'MoveChild',
        childId: nodeId,
        toParentId: resolved.parentId,
        toSlot: resolved.slot ?? 'content',
        order: cmd.order,
      });
      result.transcript.push(`Moved ${nodeId} to ${resolved.parentId}/${resolved.slot}`);
      break;
    }

    case 'select': {
      const id = resolveCommandTarget(cmd.target, doc, scopeId, ctx.selectedId);
      result.editorCommands.push({ type: 'Select', id });
      result.transcript.push(`Selected ${id ?? 'nothing'}`);
      break;
    }

    case 'enter': {
      const id = cmd.target
        ? resolveCommandTarget(cmd.target, doc, scopeId, ctx.selectedId)
        : ctx.selectedId;
      if (id) {
        result.editorCommands.push({ type: 'EnterScope', id });
        result.transcript.push(`Entered scope: ${id}`);
      } else {
        result.errors.push('No target to enter');
      }
      break;
    }

    case 'exit': {
      result.editorCommands.push({ type: 'ExitScope', count: cmd.count });
      result.transcript.push(`Exited ${cmd.count} scope(s)`);
      break;
    }

    case 'delete': {
      const id = resolveCommandTarget(cmd.target, doc, scopeId, ctx.selectedId);
      if (!id) { result.errors.push('Cannot resolve target for delete'); break; }
      result.docCommands.push({ type: 'DeleteNode', id });
      result.transcript.push(`Deleted ${id}`);
      break;
    }

    case 'rename': {
      const id = resolveCommandTarget(cmd.target, doc, scopeId, ctx.selectedId);
      if (!id) { result.errors.push('Cannot resolve target for rename'); break; }
      result.docCommands.push({ type: 'RenameNode', id, name: cmd.name });
      result.transcript.push(`Renamed ${id} to "${cmd.name}"`);
      break;
    }

    case 'undo':
      result.editorCommands.push({ type: 'Undo', count: cmd.count });
      result.transcript.push(`Undo ${cmd.count}`);
      break;

    case 'redo':
      result.editorCommands.push({ type: 'Redo', count: cmd.count });
      result.transcript.push(`Redo ${cmd.count}`);
      break;

    case 'show':
      result.editorCommands.push({
        type: 'Show',
        id: cmd.target ? resolveCommandTarget(cmd.target, doc, scopeId, ctx.selectedId) ?? undefined : undefined,
        flags: cmd.flags,
      });
      break;

    case 'list':
      result.editorCommands.push({ type: 'List', kind: cmd.kind, scope: cmd.scope ?? 'here' });
      break;

    case 'export':
      result.editorCommands.push({ type: 'Export', kind: cmd.kind, target: cmd.target, path: cmd.path });
      break;

    case 'import':
      result.editorCommands.push({ type: 'Import', kind: cmd.kind, source: cmd.source, data: cmd.data });
      break;

    case 'help':
      result.editorCommands.push({ type: 'Help', topic: cmd.topic });
      break;

    case 'scriptSet': {
      const targetId = resolveCommandTarget(cmd.target, doc, scopeId, ctx.selectedId);
      if (!targetId) {
        result.errors.push('No target for script set — select a node or provide a target');
        break;
      }
      const node = doc.nodes.get(targetId);
      if (cmd.source !== undefined) {
        // Inline script — emit ScriptSet command directly
        const source = cmd.source.trim();
        if (source) {
          result.docCommands.push({
            type: 'ScriptSet',
            id: targetId,
            language: 'js',
            source,
          });
          const lineCount = source.split('\n').length;
          result.transcript.push(`Script set on ${node?.name ?? targetId} (${lineCount} line${lineCount !== 1 ? 's' : ''})`);
        } else {
          result.errors.push(`Empty inline script for ${node?.name ?? targetId}`);
        }
      } else {
        // No inline source — enter capture mode
        result.scriptCaptureTarget = targetId;
        result.transcript.push(`Entering script capture mode for ${node?.name ?? targetId}`);
      }
      break;
    }

    case 'scriptEnd': {
      result.transcript.push('script end (no active capture)');
      break;
    }

    case 'scriptShow': {
      const targetId = resolveCommandTarget(cmd.target, doc, scopeId, ctx.selectedId);
      if (!targetId) {
        result.errors.push('No target for script show');
        break;
      }
      const node = doc.nodes.get(targetId);
      if (node?.script) {
        result.transcript.push(`Script on ${node.name ?? targetId} (${node.script.language}, v${node.script.version}):`);
        for (const line of node.script.source.split('\n')) {
          result.transcript.push(`  ${line}`);
        }
      } else {
        result.transcript.push(`No script on ${node?.name ?? targetId}`);
      }
      break;
    }

    case 'scriptClear': {
      const targetId = resolveCommandTarget(cmd.target, doc, scopeId, ctx.selectedId);
      if (!targetId) {
        result.errors.push('No target for script clear');
        break;
      }
      const node = doc.nodes.get(targetId);
      result.docCommands.push({ type: 'ScriptClear', id: targetId });
      result.transcript.push(`Cleared script on ${node?.name ?? targetId}`);
      break;
    }

    case 'fsmDefine': {
      result.docCommands.push({
        type: 'DefineFSM',
        name: cmd.name,
        initialState: cmd.initialState,
      });
      result.transcript.push(`Defined FSM "${cmd.name}" (initial: ${cmd.initialState})`);
      break;
    }

    case 'fsmState': {
      const fsm = doc.fsms.get(cmd.fsmName);
      if (!fsm) {
        result.errors.push(`FSM "${cmd.fsmName}" not found — define it first with: fsm define ${cmd.fsmName} initial <state>`);
        break;
      }
      const transitions: Record<string, string> = {};
      for (const t of cmd.transitions) {
        transitions[t.event] = t.target;
      }
      result.docCommands.push({
        type: 'FSMAddTransitions',
        name: cmd.fsmName,
        stateName: cmd.stateName,
        transitions,
      });
      const desc = cmd.transitions.map(t => `${t.event} → ${t.target}`).join(', ');
      result.transcript.push(`State "${cmd.stateName}" in "${cmd.fsmName}": ${desc || '(no transitions)'}`);
      break;
    }

    case 'fsmShow': {
      if (cmd.name) {
        const fsm = doc.fsms.get(cmd.name);
        if (!fsm) {
          result.errors.push(`FSM "${cmd.name}" not found`);
          break;
        }
        result.transcript.push(`FSM: ${fsm.name}`);
        result.transcript.push(`Initial: ${fsm.initialState}`);
        result.transcript.push('');
        for (const state of fsm.states) {
          const transitions = state.on ? Object.entries(state.on) : [];
          if (transitions.length === 0) {
            result.transcript.push(`  ${state.name}`);
          } else {
            result.transcript.push(`  ${state.name}`);
            for (const [event, target] of transitions) {
              const targetName = typeof target === 'string' ? target : target.target;
              result.transcript.push(`    ${event} → ${targetName}`);
            }
          }
        }
      } else {
        // Show all FSMs
        if (doc.fsms.size === 0) {
          result.transcript.push('No FSMs defined');
        } else {
          for (const [name, fsm] of doc.fsms) {
            const stateCount = fsm.states.length;
            result.transcript.push(`  ${name} (${stateCount} state${stateCount !== 1 ? 's' : ''}, initial: ${fsm.initialState})`);
          }
        }
      }
      break;
    }

    case 'fsmList': {
      if (doc.fsms.size === 0) {
        result.transcript.push('No FSMs defined');
      } else {
        result.transcript.push('FSMs:');
        for (const [name, fsm] of doc.fsms) {
          const stateCount = fsm.states.length;
          result.transcript.push(`  ${name} (${stateCount} state${stateCount !== 1 ? 's' : ''}, initial: ${fsm.initialState})`);
        }
      }
      break;
    }

    case 'fsmDelete': {
      if (!doc.fsms.has(cmd.name)) {
        result.errors.push(`FSM "${cmd.name}" not found`);
        break;
      }
      result.docCommands.push({ type: 'DeleteFSM', name: cmd.name });
      result.transcript.push(`Deleted FSM "${cmd.name}"`);
      break;
    }

    case 'routeAdd': {
      result.docCommands.push({ type: 'AddRoute', name: cmd.name, pattern: cmd.pattern });
      result.transcript.push(`Added route "${cmd.name}" → ${cmd.pattern}`);
      break;
    }

    case 'routeRemove': {
      result.docCommands.push({ type: 'RemoveRoute', name: cmd.name });
      result.transcript.push(`Removed route "${cmd.name}"`);
      break;
    }

    case 'screenSet': {
      result.docCommands.push({ type: 'SetScreen', routeName: cmd.routeName, screenNodeName: cmd.nodeName });
      result.transcript.push(`Screen for route "${cmd.routeName}" set to "${cmd.nodeName}"`);
      break;
    }

    case 'routeGoto': {
      result.editorCommands.push({ type: 'RouteGoto', path: cmd.path, mode: cmd.replace ? 'replace' : 'push' });
      break;
    }

    case 'routeList': {
      result.editorCommands.push({ type: 'RouteList' });
      break;
    }

    case 'routeWhere': {
      result.editorCommands.push({ type: 'RouteWhere' });
      break;
    }

    case 'historyCompact':
      result.editorCommands.push({ type: 'HistoryCompact', mode: cmd.mode });
      break;

    case 'macroDefine': {
      let sourceId: NodeId | null = null;
      if (cmd.from === 'selected') {
        sourceId = ctx.selectedId;
      } else {
        sourceId = resolveTarget(cmd.from, doc, scopeId, ctx.selectedId);
      }
      if (!sourceId) {
        result.errors.push(`Cannot resolve source "${cmd.from}" for macro define — select a node or provide a target`);
        break;
      }
      const template = captureTemplate(doc, sourceId);
      if (!template) {
        result.errors.push(`Cannot capture template from node "${sourceId}"`);
        break;
      }
      result.docCommands.push({ type: 'DefineMacro', name: cmd.name, template });
      result.transcript.push(`Defined macro "${cmd.name}" from ${sourceId}`);
      break;
    }

    case 'macroParams': {
      const macro = doc.macros.get(cmd.name);
      if (!macro) {
        result.errors.push(`Macro "${cmd.name}" not found — define it first`);
        break;
      }
      result.docCommands.push({ type: 'UpdateMacroParams', name: cmd.name, params: cmd.params });
      result.transcript.push(`Set params for macro "${cmd.name}": ${cmd.params.join(', ')}`);
      break;
    }

    case 'macroShow': {
      const macro = doc.macros.get(cmd.name);
      if (!macro) {
        result.errors.push(`Macro "${cmd.name}" not found`);
        break;
      }
      result.transcript.push(`Macro: ${macro.name}`);
      result.transcript.push(`Params: ${macro.params.length > 0 ? macro.params.join(', ') : '(none)'}`);
      result.transcript.push(`Template: ${macro.template.kind}${macro.template.layout ? ` (${macro.template.layout.type})` : ''}`);
      if (macro.template.props && Object.keys(macro.template.props).length > 0) {
        result.transcript.push(`Props: ${JSON.stringify(macro.template.props)}`);
      }
      if (macro.template.styleTokens.length > 0) {
        result.transcript.push(`Style: ${macro.template.styleTokens.join(' ')}`);
      }
      if (macro.template.children && macro.template.children.length > 0) {
        const childCount = macro.template.children.reduce((sum, g) => sum + g.nodes.length, 0);
        result.transcript.push(`Children: ${childCount} node(s)`);
      }
      break;
    }

    case 'macroList': {
      if (doc.macros.size === 0) {
        result.transcript.push('No macros defined');
      } else {
        result.transcript.push('Macros:');
        for (const [name, macro] of doc.macros) {
          const paramStr = macro.params.length > 0 ? ` (params: ${macro.params.join(', ')})` : '';
          result.transcript.push(`  ${name}${paramStr}`);
        }
      }
      break;
    }

    case 'macroDelete': {
      if (!doc.macros.has(cmd.name)) {
        result.errors.push(`Macro "${cmd.name}" not found`);
        break;
      }
      result.docCommands.push({ type: 'DeleteMacro', name: cmd.name });
      result.transcript.push(`Deleted macro "${cmd.name}"`);
      break;
    }

    case 'use': {
      const macro = doc.macros.get(cmd.name);
      if (!macro) {
        result.errors.push(`Macro "${cmd.name}" not found — define it first`);
        break;
      }

      // Build overrides from bindings
      const overrides: Record<string, any> = {};
      for (const b of cmd.bindings) {
        if (macro.params.length > 0 && !macro.params.includes(b.key)) {
          result.transcript.push(`Warning: "${b.key}" is not a declared param of macro "${cmd.name}" (declared: ${macro.params.join(', ')})`);
        }
        overrides[b.key] = b.value;
      }

      const parentNode = doc.nodes.get(targetScopeId);
      const slot = targetSlot ?? (parentNode ? getDefaultSlot(parentNode) : 'content');

      const expandedCmds = expandTemplate(
        macro.template,
        overrides,
        (kind: string) => ctx.bus.allocId(kind),
        targetScopeId,
        slot,
      );
      result.docCommands.push(...expandedCmds);
      result.transcript.push(`Instantiated macro "${cmd.name}" in ${targetScopeId}/${slot}`);
      break;
    }

    case 'error':
      result.errors.push(cmd.message);
      break;

    case 'comment':
      break;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tokenToString(t: ParsedStyleToken): string {
  if (t.value !== undefined) return `${t.key}:${t.value}`;
  return t.key;
}

function optionsToRecord(opts: { key: string; value?: any }[]): Record<string, any> {
  const rec: Record<string, any> = {};
  for (const o of opts) rec[o.key] = o.value ?? true;
  return rec;
}

function resolveCommandTarget(
  target: ParsedTarget | undefined,
  doc: DocumentModel,
  scopeId: NodeId,
  selectedId: NodeId | null,
): NodeId | null {
  if (!target) return selectedId ?? scopeId;

  if (target.kind === 'keyword') {
    if (target.value === 'selected') return selectedId;
    if (target.value === 'scope') return scopeId;
    if (target.value === 'root') return doc.rootId;
  }

  if (target.kind === 'id') {
    // Direct ID lookup — the parser already stripped the '#'
    return doc.nodes.has(target.value) ? target.value : null;
  }

  return resolveTarget(target.value, doc, scopeId, selectedId);
}

function resolveSlotPath(
  sp: ParsedSlotPath,
  doc: DocumentModel,
  scopeId: NodeId,
  selectedId: NodeId | null,
): { parentId: NodeId; slot?: string } | null {
  let parentId: NodeId;

  if (typeof sp.anchor === 'string') {
    if (sp.anchor === 'scope') parentId = scopeId;
    else if (sp.anchor === 'selected') parentId = selectedId ?? scopeId;
    else if (sp.anchor === 'root') parentId = doc.rootId;
    else {
      const resolved = resolveTarget(sp.anchor, doc, scopeId, selectedId);
      if (!resolved) return null;
      parentId = resolved;
    }
  } else {
    // Array path — resolve
    const pathStr = sp.anchor.join('/');
    const resolved = resolveTarget(pathStr, doc, scopeId, selectedId);
    if (!resolved) {
      // Try last segment as name
      const last = sp.anchor[sp.anchor.length - 1];
      const r = resolveTarget(last, doc, scopeId, selectedId);
      if (!r) return null;
      parentId = r;
    } else {
      parentId = resolved;
    }
  }

  // If slot is specified but doesn't exist on the parent, try treating it
  // as a node name and use that node's default slot instead.
  if (sp.slot) {
    const parentNode = doc.nodes.get(parentId);
    const parentSlots = parentNode?.layout?.slots ?? ['content'];
    if (!parentSlots.includes(sp.slot)) {
      const nodeAsTarget = resolveTarget(sp.slot, doc, scopeId, selectedId);
      if (nodeAsTarget) {
        const targetNode = doc.nodes.get(nodeAsTarget);
        return { parentId: nodeAsTarget, slot: targetNode ? getDefaultSlot(targetNode) : undefined };
      }
    }
  }

  return { parentId, slot: sp.slot };
}
