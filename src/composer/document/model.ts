import type { NodeId } from './ids.js';

// ---------------------------------------------------------------------------
// Node kinds and layout types
// ---------------------------------------------------------------------------

export type NodeKind =
  | 'layout'
  | 'text'
  | 'button'
  | 'input'
  | 'card'
  | 'menu'
  | 'menuItem'
  | 'container'
  | 'image'
  | 'divider';

export type LayoutType = 'stack' | 'grid' | 'sidebar' | 'center' | 'tabs' | 'split';

// ---------------------------------------------------------------------------
// Node record
// ---------------------------------------------------------------------------

export interface LayoutInfo {
  type: LayoutType;
  options: Record<string, any>;
  slots: string[];
  defaultSlot: string;
}

export interface NodeRecord {
  id: NodeId;
  kind: NodeKind;
  name?: string;
  tag?: string;
  layout?: LayoutInfo;
  props: Record<string, any>;
  styleTokens: string[];
  events?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Placement edges
// ---------------------------------------------------------------------------

export interface Edge {
  parentId: NodeId;
  slot: string;
  childId: NodeId;
  order: number;
}

// ---------------------------------------------------------------------------
// Document model
// ---------------------------------------------------------------------------

export interface DocumentModel {
  nodes: Map<NodeId, NodeRecord>;
  edges: Edge[];
  rootId: NodeId;
}

export function createDocument(): DocumentModel {
  const rootId = 'root';
  const rootNode: NodeRecord = {
    id: rootId,
    kind: 'layout',
    name: 'Root',
    layout: {
      type: 'stack',
      options: { axis: 'y' },
      slots: ['content'],
      defaultSlot: 'content',
    },
    props: {},
    styleTokens: [],
  };

  const nodes = new Map<NodeId, NodeRecord>();
  nodes.set(rootId, rootNode);

  return { nodes, edges: [], rootId };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getChildrenInSlot(doc: DocumentModel, parentId: NodeId, slot: string): Edge[] {
  return doc.edges
    .filter(e => e.parentId === parentId && e.slot === slot)
    .sort((a, b) => a.order - b.order);
}

export function getAllChildren(doc: DocumentModel, parentId: NodeId): Edge[] {
  return doc.edges
    .filter(e => e.parentId === parentId)
    .sort((a, b) => a.order - b.order);
}

export function getParentEdge(doc: DocumentModel, childId: NodeId): Edge | undefined {
  return doc.edges.find(e => e.childId === childId);
}

export function getLayoutSlots(node: NodeRecord): string[] {
  return node.layout?.slots ?? ['content'];
}

export function getDefaultSlot(node: NodeRecord): string {
  return node.layout?.defaultSlot ?? 'content';
}
