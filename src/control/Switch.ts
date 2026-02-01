import { effect } from '../reactivity/effect.js';
import { insertChild } from '../rendering/dom.js';
import { createOwner, setOwner, disposeOwner } from '../lifecycle/ownership.js';
import { COMPONENT_RESULT } from '../rendering/jsx-runtime.js';

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

// Unwrap a Match child that may have been wrapped by the JSX runtime.
// When <Match> goes through jsx(), the MatchInstance object is stored
// on the wrapper fragment via COMPONENT_RESULT.
//
// We cannot duck-type via `.when` because in browsers DocumentFragment
// extends EventTarget which has its own `when()` method.
function unwrapMatch(child: unknown): MatchInstance | null {
  if (child && typeof child === 'object' && COMPONENT_RESULT in (child as any)) {
    return (child as any)[COMPONENT_RESULT] as MatchInstance;
  }
  // Direct MatchInstance (not wrapped by jsx) — only match plain objects,
  // never DOM nodes which inherit EventTarget.when().
  if (child && typeof child === 'object' && !(child instanceof Node) && typeof (child as MatchInstance).when === 'function') {
    return child as MatchInstance;
  }
  return null;
}

export function Switch(props: SwitchProps): Node {
  const container = document.createDocumentFragment();
  const marker = document.createComment('Switch');
  container.appendChild(marker);

  let currentNodes: Node[] = [];
  let currentOwner: ReturnType<typeof createOwner> | null = null;

  effect(() => {
    const raw = Array.isArray(props.children) ? props.children : [props.children];
    let matched: MatchInstance | null = null;

    for (const child of raw) {
      const match = unwrapMatch(child);
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
