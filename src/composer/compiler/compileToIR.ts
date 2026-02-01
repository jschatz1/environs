import type { DocumentModel, NodeRecord, Edge } from '../document/model.js';
import type { NodeId } from '../document/ids.js';
import { getChildrenInSlot, getLayoutSlots } from '../document/model.js';
import { compileLayoutClasses } from '../layout/primitives.js';
import { compileTokens } from '../style/tokens.js';
import { KIND_DEFAULTS, KIND_TAGS } from '../style/defaults.js';

// ---------------------------------------------------------------------------
// IR types
// ---------------------------------------------------------------------------

export interface IRNode {
  id: string;         // NodeId or generated slot-wrapper id
  tag: string;
  text?: string;
  classes: string;
  attrs: Record<string, string>;
  isSlotWrapper?: boolean;
  sourceNodeId?: NodeId;   // the doc node this was generated from
}

export interface IRPlacement {
  parentIRId: string;
  childIRId: string;
  order: number;
}

export interface IR {
  nodes: Map<string, IRNode>;
  placements: IRPlacement[];
  rootIRId: string;
}

// ---------------------------------------------------------------------------
// Compile DocumentModel → IR
// ---------------------------------------------------------------------------

export function compileToIR(doc: DocumentModel): IR {
  const nodes = new Map<string, IRNode>();
  const placements: IRPlacement[] = [];

  function processNode(nodeId: NodeId, parentIRId: string | null, order: number): void {
    const node = doc.nodes.get(nodeId);
    if (!node) return;

    const tag = node.tag ?? KIND_TAGS[node.kind] ?? 'div';

    // Compute classes: layout classes + kind defaults + token classes
    const classParts: string[] = [];

    let layoutClasses: ReturnType<typeof compileLayoutClasses> | null = null;
    if (node.layout) {
      layoutClasses = compileLayoutClasses(node.layout.type, node.layout.options);
      classParts.push(layoutClasses.outer);
    }

    // Token classes (compute first to detect overrides)
    let tokenClasses = '';
    if (node.styleTokens.length > 0) {
      const compiled = compileTokens(node.styleTokens, node.kind);
      tokenClasses = compiled.classes;
    }

    // Kind defaults — strip classes that conflict with token overrides
    const kindDefault = KIND_DEFAULTS[node.kind];
    if (kindDefault) {
      classParts.push(stripConflicting(kindDefault, tokenClasses));
    }

    if (tokenClasses) classParts.push(tokenClasses);

    const classes = classParts.filter(Boolean).join(' ');

    // Build attrs
    const attrs: Record<string, string> = {};
    if (node.kind === 'input' && node.props.placeholder) {
      attrs['placeholder'] = node.props.placeholder;
    }
    if (node.kind === 'image' && node.props.src) {
      attrs['src'] = node.props.src;
      if (node.props.alt) attrs['alt'] = node.props.alt;
    }

    // Text content
    let text: string | undefined;
    if (node.props.text !== undefined) text = String(node.props.text);

    // Create the IR node
    const irNode: IRNode = {
      id: nodeId,
      tag,
      text,
      classes,
      attrs,
      sourceNodeId: nodeId,
    };
    nodes.set(nodeId, irNode);

    if (parentIRId) {
      placements.push({ parentIRId, childIRId: nodeId, order });
    }

    // If layout, create slot wrappers
    if (node.layout && layoutClasses) {
      const slots = getLayoutSlots(node);
      for (const slot of slots) {
        const wrapperId = `${nodeId}::slot::${slot}`;
        const wrapperClasses = layoutClasses.slotWrappers[slot] ?? '';

        nodes.set(wrapperId, {
          id: wrapperId,
          tag: 'div',
          classes: wrapperClasses,
          attrs: {},
          isSlotWrapper: true,
          sourceNodeId: nodeId,
        });

        placements.push({ parentIRId: nodeId, childIRId: wrapperId, order: slots.indexOf(slot) });

        // Place children of this slot into the wrapper
        const children = getChildrenInSlot(doc, nodeId, slot);
        for (const edge of children) {
          processNode(edge.childId, wrapperId, edge.order);
        }
      }
    } else {
      // Non-layout node: place children directly (default slot = content)
      const children = getChildrenInSlot(doc, nodeId, 'content');
      for (const edge of children) {
        processNode(edge.childId, nodeId, edge.order);
      }
    }
  }

  processNode(doc.rootId, null, 0);

  return { nodes, placements, rootIRId: doc.rootId };
}

// ---------------------------------------------------------------------------
// Strip default classes that conflict with token overrides.
// Prevents e.g. default bg-white from fighting token bg-blue-600.
// ---------------------------------------------------------------------------

function classGroup(cls: string): string | null {
  if (cls.startsWith('bg-')) return 'bg';
  if (cls.startsWith('text-')) {
    // Distinguish text-color (text-white, text-slate-900) from text-size (text-sm, text-lg)
    const sizes = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'];
    const rest = cls.slice(5);
    if (sizes.some(s => rest === s)) return 'text-size';
    return 'text-color';
  }
  if (cls.startsWith('border')) return 'border';
  if (cls.startsWith('hover:bg-')) return 'hover:bg';
  if (cls.startsWith('hover:text-')) return 'hover:text';
  return null;
}

function stripConflicting(defaults: string, tokenClasses: string): string {
  if (!tokenClasses) return defaults;

  const tokenParts = tokenClasses.split(/\s+/);
  const tokenGroups = new Set<string>();
  for (const cls of tokenParts) {
    const group = classGroup(cls);
    if (group) tokenGroups.add(group);
  }

  if (tokenGroups.size === 0) return defaults;

  return defaults
    .split(/\s+/)
    .filter(cls => {
      const group = classGroup(cls);
      return !group || !tokenGroups.has(group);
    })
    .join(' ');
}
