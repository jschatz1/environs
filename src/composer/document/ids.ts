// Deterministic ID generation from command log replay.
// Each kind gets its own counter so IDs are readable: "card-1", "button-2", etc.

export type NodeId = string;

export interface IdState {
  counters: Record<string, number>;
}

export function createIdState(): IdState {
  return { counters: {} };
}

export function nextId(state: IdState, kind: string): NodeId {
  const count = (state.counters[kind] || 0) + 1;
  state.counters[kind] = count;
  return `${kind}-${count}`;
}

export function slotKey(parentId: NodeId, slotName: string): string {
  return `${parentId}::${slotName}`;
}
