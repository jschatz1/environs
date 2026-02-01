import { effect } from '../reactivity/effect.js';
import { signal, type Signal } from '../reactivity/signal.js';
import { insertChild, type EnvironsNode } from '../rendering/dom.js';
import { createOwner, setOwner, disposeOwner, type Owner } from '../lifecycle/ownership.js';

interface ForProps<T> {
  each: () => T[];
  children: (item: T, index: () => number) => unknown;
  key?: (item: T) => string | number;
}

interface KeyedItem {
  key: string | number;
  owner: Owner;
  nodes: Node[];
  indexSignal: Signal<number>;
}

export function For<T>(props: ForProps<T>): Node {
  const container = document.createDocumentFragment();
  const marker = document.createComment('For');
  container.appendChild(marker);

  if (props.key) {
    keyedFor(props as ForProps<T> & { key: (item: T) => string | number }, marker);
  } else {
    unkeyedFor(props, marker);
  }

  return container;
}

function unkeyedFor<T>(props: ForProps<T>, marker: Comment): void {
  let currentNodes: Node[] = [];
  let currentOwners: Owner[] = [];

  effect(() => {
    const items = props.each();
    const parent = marker.parentNode;
    if (!parent) return;

    // Clean up previous render
    for (const node of currentNodes) {
      node.parentNode?.removeChild(node);
    }
    for (const owner of currentOwners) {
      disposeOwner(owner);
    }
    currentNodes = [];
    currentOwners = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const owner = createOwner();
      currentOwners.push(owner);

      const prev = setOwner(owner);
      try {
        const index = () => i;
        const result = props.children(item, index);
        const tempDiv = document.createElement('div');
        insertChild(tempDiv, result as EnvironsNode);
        const nodes = Array.from(tempDiv.childNodes);
        for (const node of nodes) {
          parent.insertBefore(node, marker);
        }
        currentNodes.push(...nodes);
      } finally {
        setOwner(prev);
      }
    }
  });
}

function keyedFor<T>(props: ForProps<T> & { key: (item: T) => string | number }, marker: Comment): void {
  const keyedItems = new Map<string | number, KeyedItem>();
  // Stable owner for keyed items — created outside the effect so items
  // survive effect re-runs. We create it under the current owner scope.
  const forOwner = createOwner();

  effect(() => {
    const items = props.each();
    const parent = marker.parentNode;
    if (!parent) return;

    // Phase 1: Compute new keys, check for duplicates
    const newKeys: (string | number)[] = [];
    const newKeySet = new Set<string | number>();
    for (let i = 0; i < items.length; i++) {
      const k = props.key(items[i]);
      if (newKeySet.has(k)) {
        throw new Error(`Duplicate key in For: ${String(k)}`);
      }
      newKeySet.add(k);
      newKeys.push(k);
    }

    // Phase 2: Remove items whose keys are no longer present
    for (const [key, item] of keyedItems) {
      if (!newKeySet.has(key)) {
        for (const node of item.nodes) {
          node.parentNode?.removeChild(node);
        }
        disposeOwner(item.owner);
        keyedItems.delete(key);
      }
    }

    // Phase 3: Add new items, update indices for existing items
    for (let i = 0; i < items.length; i++) {
      const k = newKeys[i];
      const existing = keyedItems.get(k);
      if (existing) {
        // Update index if position changed
        if (existing.indexSignal() !== i) {
          existing.indexSignal.set(i);
        }
      } else {
        // New item — create under forOwner so it persists across effect re-runs
        const prevOwner = setOwner(forOwner);
        const owner = createOwner();
        const prevOwner2 = setOwner(owner);
        try {
          const indexSignal = signal(i);
          const result = props.children(items[i], indexSignal);
          const tempDiv = document.createElement('div');
          insertChild(tempDiv, result as EnvironsNode);
          const nodes = Array.from(tempDiv.childNodes);
          keyedItems.set(k, { key: k, owner, nodes, indexSignal });
        } finally {
          setOwner(prevOwner2);
          setOwner(prevOwner);
        }
      }
    }

    // Phase 4: Reorder DOM — walk in reverse, insertBefore to place correctly
    let refNode: Node = marker;
    for (let i = newKeys.length - 1; i >= 0; i--) {
      const item = keyedItems.get(newKeys[i])!;
      // Walk the item's nodes in reverse so they end up in the right order
      for (let j = item.nodes.length - 1; j >= 0; j--) {
        const node = item.nodes[j];
        // Skip if already in the correct position
        if (node.nextSibling !== refNode) {
          parent.insertBefore(node, refNode);
        }
        refNode = node;
      }
    }
  });
}
