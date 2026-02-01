import type { NodeId } from './ids.js';
import type { DocumentModel, NodeRecord, Edge } from './model.js';
import { getChildrenInSlot, getAllChildren, getLayoutSlots, getDefaultSlot } from './model.js';

// ---------------------------------------------------------------------------
// Resolve a node reference in context
// ---------------------------------------------------------------------------

export type RefKind = 'id' | 'name' | 'path';

export interface NodeRef {
  kind: RefKind;
  value: string;
  path?: string[];
}

export function resolveRef(
  doc: DocumentModel,
  ref: NodeRef,
  scopeId: NodeId,
  selectedId: NodeId | null,
): NodeId | null {
  if (ref.kind === 'id') {
    return doc.nodes.has(ref.value) ? ref.value : null;
  }

  if (ref.kind === 'name') {
    // Check scope children first
    const scopeChildren = getAllChildren(doc, scopeId);
    for (const edge of scopeChildren) {
      const node = doc.nodes.get(edge.childId);
      if (node && node.name === ref.value) return edge.childId;
    }
    // Global search
    for (const [id, node] of doc.nodes) {
      if (node.name === ref.value) return id;
    }
    return null;
  }

  if (ref.kind === 'path' && ref.path) {
    let currentId: NodeId = scopeId;
    for (const seg of ref.path) {
      if (seg === 'root') { currentId = doc.rootId; continue; }
      if (seg === 'selected' && selectedId) { currentId = selectedId; continue; }
      if (seg === 'scope') { currentId = scopeId; continue; }

      // Try by ID
      if (seg.startsWith('#') && doc.nodes.has(seg.slice(1))) {
        currentId = seg.slice(1);
        continue;
      }

      // Try by name among children
      const children = getAllChildren(doc, currentId);
      let found = false;
      for (const edge of children) {
        const node = doc.nodes.get(edge.childId);
        if (node && (node.name === seg || node.id === seg)) {
          currentId = edge.childId;
          found = true;
          break;
        }
      }
      if (!found) return null;
    }
    return currentId;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Resolve a target spec keyword
// ---------------------------------------------------------------------------

export function resolveTarget(
  target: string | NodeRef,
  doc: DocumentModel,
  scopeId: NodeId,
  selectedId: NodeId | null,
): NodeId | null {
  if (typeof target === 'string') {
    if (target === 'selected') return selectedId;
    if (target === 'scope') return scopeId;
    if (target === 'root') return doc.rootId;
    // Try as ID
    if (target.startsWith('#')) return doc.nodes.has(target.slice(1)) ? target.slice(1) : null;
    // Try as name
    return resolveRef(doc, { kind: 'name', value: target }, scopeId, selectedId);
  }
  return resolveRef(doc, target, scopeId, selectedId);
}

// ---------------------------------------------------------------------------
// Describe a node for `show` command
// ---------------------------------------------------------------------------

export interface NodeDescription {
  id: NodeId;
  kind: string;
  name?: string;
  slots: string[];
  props: Record<string, any>;
  styleTokens: string[];
  events?: Record<string, any>;
  childrenBySlot: Record<string, { id: NodeId; name?: string; kind: string }[]>;
}

export function describeNode(doc: DocumentModel, id: NodeId): NodeDescription | null {
  const node = doc.nodes.get(id);
  if (!node) return null;

  const slots = getLayoutSlots(node);
  const childrenBySlot: Record<string, { id: NodeId; name?: string; kind: string }[]> = {};

  for (const slot of slots) {
    const edges = getChildrenInSlot(doc, id, slot);
    childrenBySlot[slot] = edges.map(e => {
      const child = doc.nodes.get(e.childId);
      return { id: e.childId, name: child?.name, kind: child?.kind ?? 'unknown' };
    });
  }

  return {
    id,
    kind: node.kind,
    name: node.name,
    slots,
    props: node.props,
    styleTokens: node.styleTokens,
    events: node.events,
    childrenBySlot,
  };
}
