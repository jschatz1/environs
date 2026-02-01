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
  | 'divider'
  | 'link'
  | 'outlet';

export type LayoutType = 'stack' | 'grid' | 'sidebar' | 'center' | 'tabs' | 'split' | 'paragraph' | 'repeat';

// ---------------------------------------------------------------------------
// Script attachment
// ---------------------------------------------------------------------------

export interface ScriptAttachment {
  language: 'js';
  source: string;
  version: number;
}

// ---------------------------------------------------------------------------
// FSM definitions
// ---------------------------------------------------------------------------

export interface FSMTransition {
  target: string;
  action?: string;
}

export interface FSMStateDef {
  name: string;
  on?: Record<string, string | FSMTransition>;
}

export interface FSMDef {
  name: string;
  initialState: string;
  states: FSMStateDef[];
}

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
  script?: ScriptAttachment;
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
// Route definitions
// ---------------------------------------------------------------------------

export interface RouteDef {
  name: string;           // "home", "settings"
  pattern: string;        // "/", "/post/:id"
  screenNodeName: string; // name of node to show
  order: number;          // match precedence
}

export interface RoutingConfig {
  routes: RouteDef[];
}

// ---------------------------------------------------------------------------
// Macro definitions
// ---------------------------------------------------------------------------

export interface TemplateNode {
  kind: NodeKind;
  tag?: string;
  name?: string;
  props: Record<string, any>;
  styleTokens: string[];
  layout?: { type: LayoutType; options: Record<string, any> };
  children?: { slot: string; nodes: TemplateNode[] }[];
}

export interface MacroDef {
  name: string;
  params: string[];
  template: TemplateNode;
}

// ---------------------------------------------------------------------------
// Document model
// ---------------------------------------------------------------------------

export interface DocumentModel {
  nodes: Map<NodeId, NodeRecord>;
  edges: Edge[];
  rootId: NodeId;
  fsms: Map<string, FSMDef>;
  routing: RoutingConfig;
  macros: Map<string, MacroDef>;
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

  return { nodes, edges: [], rootId, fsms: new Map(), routing: { routes: [] }, macros: new Map() };
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
