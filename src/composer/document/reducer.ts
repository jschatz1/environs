import type { DocCommand } from '../commands/types.js';
import type { DocumentModel, NodeRecord, Edge, FSMDef, FSMStateDef } from './model.js';
import { getChildrenInSlot, getDefaultSlot } from './model.js';
import { layoutSlotsForType } from '../layout/primitives.js';

// ---------------------------------------------------------------------------
// Pure, deterministic reducer: doc + command → new doc
// ---------------------------------------------------------------------------

export function applyCommand(doc: DocumentModel, cmd: DocCommand): DocumentModel {
  switch (cmd.type) {
    case 'CreateNode':
      return createNode(doc, cmd);
    case 'SetProps':
      return setProps(doc, cmd);
    case 'ApplyStyleTokens':
      return applyStyleTokens(doc, cmd);
    case 'AttachLayout':
      return attachLayout(doc, cmd);
    case 'PlaceChild':
      return placeChild(doc, cmd);
    case 'RemoveChild':
      return removeChild(doc, cmd);
    case 'MoveChild':
      return moveChild(doc, cmd);
    case 'DeleteNode':
      return deleteNode(doc, cmd);
    case 'RenameNode':
      return renameNode(doc, cmd);
    case 'DuplicateNode':
      return duplicateNode(doc, cmd);
    case 'ScriptSet':
      return scriptSet(doc, cmd);
    case 'ScriptClear':
      return scriptClear(doc, cmd);
    case 'DefineFSM':
      return defineFSM(doc, cmd);
    case 'FSMAddTransitions':
      return fsmAddTransitions(doc, cmd);
    case 'DeleteFSM':
      return deleteFSM(doc, cmd);
    case 'AddRoute':
      return addRoute(doc, cmd);
    case 'RemoveRoute':
      return removeRoute(doc, cmd);
    case 'SetScreen':
      return setScreen(doc, cmd);
    case 'SetRoutingConfig':
      return { ...doc, routing: { routes: cmd.routes } };
    case 'SetFSMs':
      return { ...doc, fsms: new Map(cmd.fsms) };
    case 'DefineMacro':
      return defineMacro(doc, cmd);
    case 'UpdateMacroParams':
      return updateMacroParams(doc, cmd);
    case 'DeleteMacro':
      return deleteMacro(doc, cmd);
    case 'SetMacros':
      return { ...doc, macros: new Map(cmd.macros) };
    default:
      return doc;
  }
}

// ---------------------------------------------------------------------------
// Individual command handlers
// ---------------------------------------------------------------------------

function createNode(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'CreateNode' }>): DocumentModel {
  const nodes = new Map(doc.nodes);

  let layout = undefined;
  if (cmd.layout) {
    const slots = layoutSlotsForType(cmd.layout.type);
    layout = {
      type: cmd.layout.type,
      options: cmd.layout.options,
      slots,
      defaultSlot: slots[0] === 'left' ? slots[1] || slots[0] : slots[0],
    };
    // sidebar default slot is 'main', not 'left'
    if (cmd.layout.type === 'sidebar') {
      layout.defaultSlot = 'main';
    }
  }

  const node: NodeRecord = {
    id: cmd.id,
    kind: cmd.kind,
    name: cmd.name,
    tag: cmd.tag,
    layout,
    props: cmd.initialProps ?? {},
    styleTokens: cmd.initialStyleTokens ?? [],
  };
  nodes.set(cmd.id, node);

  return { ...doc, nodes };
}

function setProps(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'SetProps' }>): DocumentModel {
  const node = doc.nodes.get(cmd.id);
  if (!node) return doc;

  const nodes = new Map(doc.nodes);
  nodes.set(cmd.id, {
    ...node,
    props: { ...node.props, ...cmd.propsPatch },
  });
  return { ...doc, nodes };
}

function applyStyleTokens(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'ApplyStyleTokens' }>): DocumentModel {
  const node = doc.nodes.get(cmd.id);
  if (!node) return doc;

  let tokens: string[];
  if (cmd.tokensSet) {
    tokens = [...cmd.tokensSet];
  } else {
    tokens = [...node.styleTokens];
    if (cmd.tokensRemove) {
      tokens = tokens.filter(t => !cmd.tokensRemove!.includes(t));
    }
    if (cmd.tokensAdd) {
      tokens.push(...cmd.tokensAdd);
    }
  }

  const nodes = new Map(doc.nodes);
  nodes.set(cmd.id, { ...node, styleTokens: tokens });
  return { ...doc, nodes };
}

function attachLayout(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'AttachLayout' }>): DocumentModel {
  const node = doc.nodes.get(cmd.id);
  if (!node) return doc;

  const slots = layoutSlotsForType(cmd.layoutType);
  const layout = {
    type: cmd.layoutType,
    options: cmd.options,
    slots,
    defaultSlot: cmd.layoutType === 'sidebar' ? 'main' : slots[0],
  };

  const nodes = new Map(doc.nodes);
  nodes.set(cmd.id, { ...node, layout });
  return { ...doc, nodes };
}

function placeChild(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'PlaceChild' }>): DocumentModel {
  const existing = getChildrenInSlot(doc, cmd.parentId, cmd.slot);
  const order = cmd.order ?? (existing.length > 0 ? Math.max(...existing.map(e => e.order)) + 1 : 0);

  const edge: Edge = {
    parentId: cmd.parentId,
    slot: cmd.slot,
    childId: cmd.childId,
    order,
  };

  // Remove any existing placement of this child
  const edges = doc.edges.filter(e => e.childId !== cmd.childId);
  edges.push(edge);

  return { ...doc, edges };
}

function removeChild(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'RemoveChild' }>): DocumentModel {
  const edges = doc.edges.filter(
    e => !(e.parentId === cmd.parentId && e.slot === cmd.slot && e.childId === cmd.childId)
  );
  return { ...doc, edges };
}

function moveChild(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'MoveChild' }>): DocumentModel {
  // Remove from current position
  const edges = doc.edges.filter(e => e.childId !== cmd.childId);

  const existing = edges.filter(e => e.parentId === cmd.toParentId && e.slot === cmd.toSlot);
  const order = cmd.order ?? (existing.length > 0 ? Math.max(...existing.map(e => e.order)) + 1 : 0);

  edges.push({
    parentId: cmd.toParentId,
    slot: cmd.toSlot,
    childId: cmd.childId,
    order,
  });

  return { ...doc, edges };
}

function deleteNode(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'DeleteNode' }>): DocumentModel {
  const nodes = new Map(doc.nodes);
  nodes.delete(cmd.id);

  // Remove all edges involving this node
  const edges = doc.edges.filter(e => e.parentId !== cmd.id && e.childId !== cmd.id);

  return { ...doc, nodes, edges };
}

function renameNode(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'RenameNode' }>): DocumentModel {
  const node = doc.nodes.get(cmd.id);
  if (!node) return doc;

  const nodes = new Map(doc.nodes);
  nodes.set(cmd.id, { ...node, name: cmd.name });
  return { ...doc, nodes };
}

function duplicateNode(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'DuplicateNode' }>): DocumentModel {
  const source = doc.nodes.get(cmd.sourceId);
  if (!source) return doc;

  const nodes = new Map(doc.nodes);
  nodes.set(cmd.newId, {
    ...source,
    id: cmd.newId,
    name: cmd.name ?? (source.name ? source.name + ' Copy' : undefined),
    props: { ...source.props },
    styleTokens: [...source.styleTokens],
    layout: source.layout ? { ...source.layout, options: { ...source.layout.options }, slots: [...source.layout.slots] } : undefined,
    script: source.script ? { ...source.script } : undefined,
  });

  // If deep, duplicate children too (not implemented in this pass — would need recursive ID generation)
  return { ...doc, nodes };
}

function scriptSet(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'ScriptSet' }>): DocumentModel {
  const node = doc.nodes.get(cmd.id);
  if (!node) return doc;

  const prevVersion = node.script?.version ?? 0;
  const nodes = new Map(doc.nodes);
  nodes.set(cmd.id, {
    ...node,
    script: { language: cmd.language, source: cmd.source, version: prevVersion + 1 },
  });
  return { ...doc, nodes };
}

function scriptClear(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'ScriptClear' }>): DocumentModel {
  const node = doc.nodes.get(cmd.id);
  if (!node) return doc;

  const nodes = new Map(doc.nodes);
  const { script: _, ...rest } = node;
  nodes.set(cmd.id, rest as NodeRecord);
  return { ...doc, nodes };
}

function defineFSM(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'DefineFSM' }>): DocumentModel {
  const fsms = new Map(doc.fsms);
  const existing = fsms.get(cmd.name);
  if (existing) {
    // Update initial state, keep existing states
    fsms.set(cmd.name, { ...existing, initialState: cmd.initialState });
  } else {
    fsms.set(cmd.name, {
      name: cmd.name,
      initialState: cmd.initialState,
      states: [{ name: cmd.initialState }],
    });
  }
  return { ...doc, fsms };
}

function fsmAddTransitions(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'FSMAddTransitions' }>): DocumentModel {
  const existing = doc.fsms.get(cmd.name);
  if (!existing) return doc;

  const fsms = new Map(doc.fsms);
  const states = [...existing.states];
  const idx = states.findIndex(s => s.name === cmd.stateName);
  const newOn: Record<string, string> = {};
  for (const [event, target] of Object.entries(cmd.transitions)) {
    newOn[event] = target;
  }

  if (idx >= 0) {
    // Merge transitions into existing state
    states[idx] = { ...states[idx], on: { ...states[idx].on, ...newOn } };
  } else {
    // Add new state definition
    states.push({ name: cmd.stateName, on: newOn });
  }

  // Ensure all target states exist as definitions
  for (const target of Object.values(cmd.transitions)) {
    if (!states.some(s => s.name === target)) {
      states.push({ name: target });
    }
  }

  fsms.set(cmd.name, { ...existing, states });
  return { ...doc, fsms };
}

function deleteFSM(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'DeleteFSM' }>): DocumentModel {
  if (!doc.fsms.has(cmd.name)) return doc;
  const fsms = new Map(doc.fsms);
  fsms.delete(cmd.name);
  return { ...doc, fsms };
}

function addRoute(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'AddRoute' }>): DocumentModel {
  const routes = [...doc.routing.routes];
  // Replace if route with same name exists
  const idx = routes.findIndex(r => r.name === cmd.name);
  if (idx >= 0) {
    routes[idx] = { ...routes[idx], pattern: cmd.pattern };
  } else {
    routes.push({ name: cmd.name, pattern: cmd.pattern, screenNodeName: '', order: routes.length });
  }
  return { ...doc, routing: { ...doc.routing, routes } };
}

function removeRoute(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'RemoveRoute' }>): DocumentModel {
  const routes = doc.routing.routes.filter(r => r.name !== cmd.name);
  return { ...doc, routing: { ...doc.routing, routes } };
}

function setScreen(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'SetScreen' }>): DocumentModel {
  const routes = doc.routing.routes.map(r =>
    r.name === cmd.routeName ? { ...r, screenNodeName: cmd.screenNodeName } : r
  );
  return { ...doc, routing: { ...doc.routing, routes } };
}

function defineMacro(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'DefineMacro' }>): DocumentModel {
  const macros = new Map(doc.macros);
  const existing = macros.get(cmd.name);
  macros.set(cmd.name, {
    name: cmd.name,
    params: existing?.params ?? [],
    template: cmd.template,
  });
  return { ...doc, macros };
}

function updateMacroParams(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'UpdateMacroParams' }>): DocumentModel {
  const existing = doc.macros.get(cmd.name);
  if (!existing) return doc;
  const macros = new Map(doc.macros);
  macros.set(cmd.name, { ...existing, params: cmd.params });
  return { ...doc, macros };
}

function deleteMacro(doc: DocumentModel, cmd: Extract<DocCommand, { type: 'DeleteMacro' }>): DocumentModel {
  if (!doc.macros.has(cmd.name)) return doc;
  const macros = new Map(doc.macros);
  macros.delete(cmd.name);
  return { ...doc, macros };
}
