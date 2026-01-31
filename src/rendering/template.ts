import { setProperty, insertChild } from './dom.js';
import { runComponent, type ComponentFunction } from './component.js';

// Tagged template literal for no-build-step usage:
// html`<div class=${cls}>Hello ${name}</div>`

interface ParsedTemplate {
  template: HTMLTemplateElement;
  parts: TemplatePart[];
}

interface TemplatePart {
  type: 'attribute' | 'child';
  path: number[];      // path to node from template root
  name?: string;       // attribute name (for attribute parts)
  index?: number;      // child placeholder index
}

const templateCache = new Map<TemplateStringsArray, ParsedTemplate>();

export function html(strings: TemplateStringsArray, ...values: unknown[]): Node | Node[] {
  let parsed = templateCache.get(strings);
  if (!parsed) {
    parsed = parseTemplate(strings);
    templateCache.set(strings, parsed);
  }

  const fragment = parsed.template.content.cloneNode(true) as DocumentFragment;
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT);

  // Collect all nodes first (since we'll modify the tree)
  const nodes: Node[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    nodes.push(node);
  }

  // Process attribute bindings
  for (const n of nodes) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      const el = n as Element;
      const bindings: { name: string; value: unknown }[] = [];
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        const match = attr.value.match(/^__environs_(\d+)__$/);
        if (match) {
          const valueIndex = parseInt(match[1], 10);
          bindings.push({ name: attr.name, value: values[valueIndex] });
        }
      }
      for (const { name, value } of bindings) {
        el.removeAttribute(name);
        setProperty(el, name, value);
      }
    }

    if (n.nodeType === Node.COMMENT_NODE) {
      const comment = n as Comment;
      const match = comment.data.match(/^__environs_(\d+)__$/);
      if (match) {
        const valueIndex = parseInt(match[1], 10);
        const value = values[valueIndex];
        const parent = comment.parentNode!;

        insertChild(parent, value as any, comment);
        parent.removeChild(comment);
      }
    }
  }

  const children = Array.from(fragment.childNodes);
  if (children.length === 1) {
    return children[0];
  }
  return children;
}

function isComponentFunction(value: unknown): boolean {
  return typeof value === 'function' && !(value as any).__isSignal;
}

function parseTemplate(strings: TemplateStringsArray): ParsedTemplate {
  let htmlStr = '';
  for (let i = 0; i < strings.length; i++) {
    htmlStr += strings[i];
    if (i < strings.length - 1) {
      // Determine if we're inside an attribute or in child position
      // Simple heuristic: if the last open tag hasn't been closed, we're in attribute position
      const inAttr = isInsideTag(htmlStr);
      if (inAttr) {
        htmlStr += `__environs_${i}__`;
      } else {
        htmlStr += `<!--__environs_${i}__-->`;
      }
    }
  }

  const template = document.createElement('template');
  template.innerHTML = htmlStr;

  return { template, parts: [] };
}

function isInsideTag(html: string): boolean {
  // Walk backward through the string to find if we're inside < >
  let i = html.length - 1;
  while (i >= 0) {
    if (html[i] === '>') return false;
    if (html[i] === '<') return true;
    i--;
  }
  return false;
}
