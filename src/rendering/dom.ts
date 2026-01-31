import { effect } from '../reactivity/effect.js';
import { getOwner } from '../lifecycle/ownership.js';

export type EnvironsNode = Node | string | number | boolean | null | undefined | EnvironsNode[] | (() => unknown);

export function insertChild(parent: Node, child: EnvironsNode, marker?: Node | null): void {
  if (child == null || typeof child === 'boolean') return;

  if (typeof child === 'string' || typeof child === 'number') {
    const textNode = document.createTextNode(String(child));
    parent.insertBefore(textNode, marker ?? null);
    return;
  }

  if (Array.isArray(child)) {
    for (const c of child) {
      insertChild(parent, c, marker);
    }
    return;
  }

  if (child instanceof Node) {
    parent.insertBefore(child, marker ?? null);
    return;
  }

  if (typeof child === 'function') {
    insertReactive(parent, child as () => unknown, marker);
    return;
  }
}

function insertReactive(parent: Node, accessor: () => unknown, marker?: Node | null): void {
  let currentNodes: Node[] = [];
  const endMarker = document.createComment('');
  parent.insertBefore(endMarker, marker ?? null);

  effect(() => {
    const value = accessor();
    // Remove old nodes
    for (const node of currentNodes) {
      parent.removeChild(node);
    }
    currentNodes = [];

    if (value == null || typeof value === 'boolean') return;

    if (value instanceof Node) {
      parent.insertBefore(value, endMarker);
      currentNodes = [value];
      return;
    }

    if (Array.isArray(value)) {
      const fragment = document.createDocumentFragment();
      const nodes: Node[] = [];
      collectNodes(value, fragment, nodes);
      parent.insertBefore(fragment, endMarker);
      currentNodes = nodes;
      return;
    }

    const textNode = document.createTextNode(String(value));
    parent.insertBefore(textNode, endMarker);
    currentNodes = [textNode];
  });
}

function collectNodes(children: unknown[], parent: Node, collected: Node[]): void {
  for (const child of children) {
    if (child == null || typeof child === 'boolean') continue;
    if (child instanceof Node) {
      parent.appendChild(child);
      collected.push(child);
    } else if (Array.isArray(child)) {
      collectNodes(child, parent, collected);
    } else {
      const text = document.createTextNode(String(child));
      parent.appendChild(text);
      collected.push(text);
    }
  }
}

export function setProperty(el: Element, key: string, value: unknown): void {
  if (key === 'className' || key === 'class') {
    if (typeof value === 'function') {
      effect(() => {
        (el as HTMLElement).className = String((value as () => unknown)()) ?? '';
      });
    } else {
      (el as HTMLElement).className = String(value) ?? '';
    }
    return;
  }

  if (key === 'style') {
    if (typeof value === 'object' && value !== null) {
      const styleObj = value as Record<string, unknown>;
      for (const prop of Object.keys(styleObj)) {
        const val = styleObj[prop];
        if (typeof val === 'function') {
          effect(() => {
            (el as HTMLElement).style.setProperty(prop, String((val as () => unknown)()));
          });
        } else {
          (el as HTMLElement).style.setProperty(prop, String(val));
        }
      }
    } else if (typeof value === 'string') {
      (el as HTMLElement).setAttribute('style', value);
    }
    return;
  }

  if (key === 'ref') {
    if (typeof value === 'function') {
      (value as (el: Element) => void)(el);
    }
    return;
  }

  if (key.startsWith('on')) {
    const event = key.slice(2).toLowerCase();
    el.addEventListener(event, value as EventListener);
    return;
  }

  // Boolean attributes
  if (typeof value === 'boolean') {
    if (value) {
      el.setAttribute(key, '');
    } else {
      el.removeAttribute(key);
    }
    return;
  }

  if (typeof value === 'function') {
    effect(() => {
      const v = (value as () => unknown)();
      if (v == null || v === false) {
        el.removeAttribute(key);
      } else {
        el.setAttribute(key, String(v));
      }
    });
    return;
  }

  if (value == null) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, String(value));
  }
}
