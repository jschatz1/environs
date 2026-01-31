import { effect } from '../reactivity/effect.js';
import { insertChild } from '../rendering/dom.js';
import { createOwner, setOwner, disposeOwner } from '../lifecycle/ownership.js';

interface ForProps<T> {
  each: () => T[];
  children: (item: T, index: () => number) => unknown;
}

export function For<T>(props: ForProps<T>): Node {
  const container = document.createDocumentFragment();
  const marker = document.createComment('For');
  container.appendChild(marker);

  let currentNodes: Node[] = [];
  let currentOwners: ReturnType<typeof createOwner>[] = [];

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
        insertChild(tempDiv, result as import('../rendering/dom.js').EnvironsNode);
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

  return container;
}
