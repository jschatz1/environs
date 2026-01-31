import { effect } from '../reactivity/effect.js';
import { insertChild } from '../rendering/dom.js';
import { createOwner, setOwner, disposeOwner } from '../lifecycle/ownership.js';

interface ShowProps {
  when: () => unknown;
  fallback?: unknown;
  children: unknown;
}

export function Show(props: ShowProps): Node {
  const container = document.createDocumentFragment();
  const marker = document.createComment('Show');
  container.appendChild(marker);

  let currentNodes: Node[] = [];
  let currentOwner: ReturnType<typeof createOwner> | null = null;

  effect(() => {
    const condition = props.when();

    // Clean up previous render
    for (const node of currentNodes) {
      node.parentNode?.removeChild(node);
    }
    currentNodes = [];
    if (currentOwner) {
      disposeOwner(currentOwner);
      currentOwner = null;
    }

    const parent = marker.parentNode;
    if (!parent) return;

    const content = condition ? props.children : props.fallback;
    if (content == null) return;

    if (typeof content === 'function') {
      currentOwner = createOwner();
      const prev = setOwner(currentOwner);
      try {
        const result = (content as Function)(condition);
        const tempDiv = document.createElement('div');
        insertChild(tempDiv, result);
        const nodes = Array.from(tempDiv.childNodes);
        for (const node of nodes) {
          parent.insertBefore(node, marker);
        }
        currentNodes = nodes;
      } finally {
        setOwner(prev);
      }
    } else if (content instanceof Node) {
      parent.insertBefore(content, marker);
      currentNodes = [content];
    } else {
      const text = document.createTextNode(String(content));
      parent.insertBefore(text, marker);
      currentNodes = [text];
    }
  });

  return container;
}
