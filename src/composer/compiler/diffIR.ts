import type { IR, IRNode, IRPlacement } from './compileToIR.js';

// ---------------------------------------------------------------------------
// Diff two IRs and produce a patch plan
// ---------------------------------------------------------------------------

export type PatchOp =
  | { op: 'create'; node: IRNode }
  | { op: 'remove'; id: string }
  | { op: 'updateText'; id: string; text: string | undefined }
  | { op: 'updateRichText'; id: string; html: string | undefined }
  | { op: 'updateClasses'; id: string; classes: string }
  | { op: 'updateAttrs'; id: string; attrs: Record<string, string> }
  | { op: 'place'; parentId: string; childId: string; order: number }
  | { op: 'unplace'; parentId: string; childId: string };

export function diffIR(prev: IR | null, next: IR): PatchOp[] {
  const ops: PatchOp[] = [];

  const prevNodes = prev?.nodes ?? new Map();
  const nextNodes = next.nodes;
  const prevPlacements = prev?.placements ?? [];
  const nextPlacements = next.placements;

  // 1. New nodes
  for (const [id, node] of nextNodes) {
    if (!prevNodes.has(id)) {
      ops.push({ op: 'create', node });
    }
  }

  // 2. Removed nodes
  for (const [id] of prevNodes) {
    if (!nextNodes.has(id)) {
      ops.push({ op: 'remove', id });
    }
  }

  // 3. Updated nodes (text, classes, attrs)
  for (const [id, node] of nextNodes) {
    const prev = prevNodes.get(id);
    if (!prev) continue;

    if (prev.text !== node.text) {
      ops.push({ op: 'updateText', id, text: node.text });
    }
    if (prev.richText !== node.richText) {
      ops.push({ op: 'updateRichText', id, html: node.richText });
    }
    if (prev.classes !== node.classes) {
      ops.push({ op: 'updateClasses', id, classes: node.classes });
    }
    if (!attrsEqual(prev.attrs, node.attrs)) {
      ops.push({ op: 'updateAttrs', id, attrs: node.attrs });
    }
  }

  // 4. Placement changes
  const prevPlaceSet = new Set(prevPlacements.map(p => `${p.parentIRId}|${p.childIRId}|${p.order}`));
  const nextPlaceSet = new Set(nextPlacements.map(p => `${p.parentIRId}|${p.childIRId}|${p.order}`));

  // Removed placements
  for (const p of prevPlacements) {
    const key = `${p.parentIRId}|${p.childIRId}|${p.order}`;
    if (!nextPlaceSet.has(key)) {
      // Check if child still exists somewhere
      const stillPlaced = nextPlacements.some(np => np.childIRId === p.childIRId);
      if (!stillPlaced || !nextPlacements.some(np => np.parentIRId === p.parentIRId && np.childIRId === p.childIRId)) {
        ops.push({ op: 'unplace', parentId: p.parentIRId, childId: p.childIRId });
      }
    }
  }

  // New/moved placements
  for (const p of nextPlacements) {
    const key = `${p.parentIRId}|${p.childIRId}|${p.order}`;
    if (!prevPlaceSet.has(key)) {
      ops.push({ op: 'place', parentId: p.parentIRId, childId: p.childIRId, order: p.order });
    }
  }

  return ops;
}

function attrsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}
