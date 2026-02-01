import type { PatchOp } from '../compiler/diffIR.js';
import type { IRNode } from '../compiler/compileToIR.js';

// ---------------------------------------------------------------------------
// DOM Backend — applies IR patch ops to actual DOM
// ---------------------------------------------------------------------------

export interface DOMBackend {
  root: HTMLElement;
  elements: Map<string, HTMLElement>;
  applyPatches(ops: PatchOp[]): void;
  getElement(id: string): HTMLElement | undefined;
  clear(): void;
}

export function createDOMBackend(root: HTMLElement): DOMBackend {
  const elements = new Map<string, HTMLElement>();

  function applyPatches(ops: PatchOp[]): void {
    // Process creates first, then updates, then placements, then removals
    const creates: Extract<PatchOp, { op: 'create' }>[] = [];
    const removes: Extract<PatchOp, { op: 'remove' }>[] = [];
    const updates: PatchOp[] = [];
    const placements: Extract<PatchOp, { op: 'place' }>[] = [];
    const unplacements: Extract<PatchOp, { op: 'unplace' }>[] = [];

    for (const op of ops) {
      switch (op.op) {
        case 'create': creates.push(op); break;
        case 'remove': removes.push(op); break;
        case 'place': placements.push(op); break;
        case 'unplace': unplacements.push(op); break;
        default: updates.push(op); break;
      }
    }

    // 1. Create new elements
    for (const { node } of creates) {
      ensureElement(node);
    }

    // 2. Apply updates
    for (const op of updates) {
      switch (op.op) {
        case 'updateText': {
          const el = elements.get(op.id);
          if (el) {
            // Only set text if no children (preserve slot wrappers)
            if (el.childElementCount === 0) {
              el.textContent = op.text ?? '';
            } else {
              // Find or create a text node at the beginning
              let textNode = el.firstChild;
              if (textNode && textNode.nodeType === Node.TEXT_NODE) {
                textNode.textContent = op.text ?? '';
              } else if (op.text) {
                el.insertBefore(document.createTextNode(op.text), el.firstChild);
              }
            }
          }
          break;
        }
        case 'updateClasses': {
          const el = elements.get(op.id);
          if (el) el.className = op.classes;
          break;
        }
        case 'updateAttrs': {
          const el = elements.get(op.id);
          if (el) {
            // Remove old attrs
            for (const attr of Array.from(el.attributes)) {
              if (attr.name !== 'class' && attr.name !== 'data-nodeid' && !op.attrs[attr.name]) {
                el.removeAttribute(attr.name);
              }
            }
            for (const [key, val] of Object.entries(op.attrs)) {
              el.setAttribute(key, val);
            }
          }
          break;
        }
      }
    }

    // 3. Unplace (detach children)
    for (const { childId } of unplacements) {
      const child = elements.get(childId);
      if (child && child.parentNode) {
        child.parentNode.removeChild(child);
      }
    }

    // 4. Place children (sorted by order within each parent)
    const byParent = new Map<string, typeof placements>();
    for (const p of placements) {
      let list = byParent.get(p.parentId);
      if (!list) { list = []; byParent.set(p.parentId, list); }
      list.push(p);
    }
    for (const [parentId, list] of byParent) {
      list.sort((a, b) => a.order - b.order);
      const parentEl = parentId === 'root' ? root : elements.get(parentId);
      if (!parentEl) continue;

      for (const { childId, order } of list) {
        const childEl = elements.get(childId);
        if (!childEl) continue;

        // Find the right position based on order
        const children = Array.from(parentEl.children);
        let inserted = false;
        for (let i = 0; i < children.length; i++) {
          const sibling = children[i] as HTMLElement;
          if (sibling === childEl) continue;
          // Insert before a sibling that should come after
          const sibOrder = parseInt(sibling.dataset.order ?? '0', 10);
          if (order < sibOrder) {
            parentEl.insertBefore(childEl, sibling);
            inserted = true;
            break;
          }
        }
        if (!inserted) {
          parentEl.appendChild(childEl);
        }
        childEl.dataset.order = String(order);
      }
    }

    // 5. Remove deleted elements
    for (const { id } of removes) {
      const el = elements.get(id);
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
      elements.delete(id);
    }
  }

  function ensureElement(node: IRNode): HTMLElement {
    let el = elements.get(node.id);
    if (!el) {
      el = document.createElement(node.tag);
      el.setAttribute('data-nodeid', node.sourceNodeId ?? node.id);
      elements.set(node.id, el);
    }
    el.className = node.classes;
    if (node.text) el.textContent = node.text;
    for (const [key, val] of Object.entries(node.attrs)) {
      el.setAttribute(key, val);
    }
    return el;
  }

  function getElement(id: string): HTMLElement | undefined {
    return elements.get(id);
  }

  function clear(): void {
    root.innerHTML = '';
    elements.clear();
  }

  return { root, elements, applyPatches, getElement, clear };
}
