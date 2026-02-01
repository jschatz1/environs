// ---------------------------------------------------------------------------
// Convert parsed explicit commands → DocCommands + EditorCommands
// ---------------------------------------------------------------------------

import type { ParsedCommand, ParsedStatement, ParsedSlotPath, ParsedTarget, ParsedStyleToken } from './parseExplicit.js';
import type { DocCommand, EditorCommand, Command } from './types.js';
import type { CommandBus } from './bus.js';
import type { DocumentModel, NodeRecord } from '../document/model.js';
import type { NodeId } from '../document/ids.js';
import { resolveTarget } from '../document/selectors.js';
import { getDefaultSlot } from '../document/model.js';
import type { LayoutType, NodeKind } from '../document/model.js';
import { compileTokens } from '../style/tokens.js';

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
        name: cmd.as ?? cmd.label,
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

  return resolveTarget(target.value.startsWith('#') ? target.value : target.value, doc, scopeId, selectedId);
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

  return { parentId, slot: sp.slot };
}
