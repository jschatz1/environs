import type { DocumentModel, TemplateNode } from '../document/model.js';
import type { NodeId } from '../document/ids.js';
import type { DocCommand } from '../commands/types.js';
import { getAllChildren } from '../document/model.js';

// ---------------------------------------------------------------------------
// Capture: walk a node subtree and build a TemplateNode tree
// ---------------------------------------------------------------------------

export function captureTemplate(doc: DocumentModel, nodeId: NodeId): TemplateNode | null {
  const node = doc.nodes.get(nodeId);
  if (!node) return null;

  const template: TemplateNode = {
    kind: node.kind,
    tag: node.tag,
    name: node.name,
    props: { ...node.props },
    styleTokens: [...node.styleTokens],
  };

  if (node.layout) {
    template.layout = {
      type: node.layout.type,
      options: { ...node.layout.options },
    };

    // Capture children grouped by slot
    const childEdges = getAllChildren(doc, nodeId);
    if (childEdges.length > 0) {
      const slotMap = new Map<string, TemplateNode[]>();
      for (const edge of childEdges) {
        const childTemplate = captureTemplate(doc, edge.childId);
        if (childTemplate) {
          let arr = slotMap.get(edge.slot);
          if (!arr) {
            arr = [];
            slotMap.set(edge.slot, arr);
          }
          arr.push(childTemplate);
        }
      }
      template.children = Array.from(slotMap.entries()).map(([slot, nodes]) => ({ slot, nodes }));
    }
  }

  return template;
}

// ---------------------------------------------------------------------------
// Expand: recursively generate DocCommands from a TemplateNode
// ---------------------------------------------------------------------------

export function expandTemplate(
  template: TemplateNode,
  overrides: Record<string, any>,
  allocId: (kind: string) => string,
  parentId: NodeId,
  slot: string,
): DocCommand[] {
  const cmds: DocCommand[] = [];

  const id = allocId(template.kind === 'layout' ? 'layout' : template.kind);

  // Merge overrides into root node props only
  const props = { ...template.props, ...overrides };

  const createCmd: DocCommand = {
    type: 'CreateNode',
    id,
    kind: template.kind,
    // Clear name to avoid conflicts — expanded nodes get fresh IDs
    name: undefined,
    tag: template.tag,
    initialProps: Object.keys(props).length > 0 ? props : undefined,
    initialStyleTokens: template.styleTokens.length > 0 ? [...template.styleTokens] : undefined,
    layout: template.layout ? { type: template.layout.type, options: { ...template.layout.options } } : undefined,
  };
  cmds.push(createCmd);

  cmds.push({
    type: 'PlaceChild',
    parentId,
    slot,
    childId: id,
  });

  // Recursively expand children (no overrides — only root gets them)
  if (template.children) {
    for (const group of template.children) {
      for (const childTemplate of group.nodes) {
        cmds.push(...expandChildren(childTemplate, allocId, id, group.slot));
      }
    }
  }

  return cmds;
}

function expandChildren(
  template: TemplateNode,
  allocId: (kind: string) => string,
  parentId: NodeId,
  slot: string,
): DocCommand[] {
  const cmds: DocCommand[] = [];

  const id = allocId(template.kind === 'layout' ? 'layout' : template.kind);

  const createCmd: DocCommand = {
    type: 'CreateNode',
    id,
    kind: template.kind,
    name: undefined,
    tag: template.tag,
    initialProps: Object.keys(template.props).length > 0 ? { ...template.props } : undefined,
    initialStyleTokens: template.styleTokens.length > 0 ? [...template.styleTokens] : undefined,
    layout: template.layout ? { type: template.layout.type, options: { ...template.layout.options } } : undefined,
  };
  cmds.push(createCmd);

  cmds.push({
    type: 'PlaceChild',
    parentId,
    slot,
    childId: id,
  });

  if (template.children) {
    for (const group of template.children) {
      for (const childTemplate of group.nodes) {
        cmds.push(...expandChildren(childTemplate, allocId, id, group.slot));
      }
    }
  }

  return cmds;
}
