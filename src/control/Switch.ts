import { effect } from '../reactivity/effect.js';
import { insertChild } from '../rendering/dom.js';
import { createOwner, setOwner, disposeOwner } from '../lifecycle/ownership.js';

interface MatchProps {
  when: () => unknown;
  children: unknown;
}

interface SwitchProps {
  fallback?: unknown;
  children: MatchInstance[];
}

interface MatchInstance {
  when: () => unknown;
  children: unknown;
}

export function Match(props: MatchProps): MatchInstance {
  return { when: props.when, children: props.children };
}

export function Switch(props: SwitchProps): Node {
  const container = document.createDocumentFragment();
  const marker = document.createComment('Switch');
  container.appendChild(marker);

  let currentNodes: Node[] = [];
  let currentOwner: ReturnType<typeof createOwner> | null = null;

  effect(() => {
    const matches = Array.isArray(props.children) ? props.children : [props.children];
    let matched: MatchInstance | null = null;

    for (const match of matches) {
      if (match && match.when()) {
        matched = match;
        break;
      }
    }

    // Clean up previous
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

    const content = matched ? matched.children : props.fallback;
    if (content == null) return;

    currentOwner = createOwner();
    const prev = setOwner(currentOwner);
    try {
      const result = typeof content === 'function' ? (content as Function)() : content;
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
  });

  return container;
}
