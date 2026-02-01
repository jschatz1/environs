import { setProperty, insertChild, type EnvironsNode } from './dom.js';
import { runComponent, type ComponentFunction } from './component.js';

// Symbol used to carry non-Node component results (e.g. Match objects)
// through the JSX pipeline so parent components can access them.
export const COMPONENT_RESULT = Symbol('component-result');

export function jsx(
  tag: string | ComponentFunction,
  props: Record<string, unknown>,
): Node {
  if (typeof tag === 'function') {
    const instance = runComponent(tag, props);
    const result = instance.result;
    if (result instanceof Node) return result;
    // Wrap non-node results, but preserve the raw result so parent
    // components like Switch can read the Match objects their children return.
    const wrapper = document.createDocumentFragment();
    (wrapper as any)[COMPONENT_RESULT] = result;
    insertChild(wrapper, result as EnvironsNode);
    return wrapper;
  }

  const el = document.createElement(tag);

  const { children, ...rest } = props;

  for (const [key, value] of Object.entries(rest)) {
    setProperty(el, key, value);
  }

  if (children != null) {
    if (Array.isArray(children)) {
      for (const child of children) {
        insertChild(el, child as EnvironsNode);
      }
    } else {
      insertChild(el, children as EnvironsNode);
    }
  }

  return el;
}

export const jsxs = jsx;
export const jsxDEV = jsx;
export const Fragment = Symbol('Fragment');

export function jsxFragment(props: { children?: unknown }): DocumentFragment {
  const fragment = document.createDocumentFragment();
  if (props.children != null) {
    if (Array.isArray(props.children)) {
      for (const child of props.children) {
        insertChild(fragment, child as EnvironsNode);
      }
    } else {
      insertChild(fragment, props.children as EnvironsNode);
    }
  }
  return fragment;
}
