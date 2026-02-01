/**
 * Expands a `layout repeat` node into IR nodes at compile time.
 *
 * Reads the items signal, looks up the template macro, and generates
 * IRNode + IRPlacement entries for each item in the array.
 */

import type { DocumentModel, MacroDef, TemplateNode, NodeRecord } from '../document/model.js';
import type { NodeId } from '../document/ids.js';
import type { IRNode, IRPlacement } from './compileToIR.js';
import { compileLayoutClasses } from '../layout/primitives.js';
import { compileTokens } from '../style/tokens.js';
import { KIND_DEFAULTS, KIND_TAGS } from '../style/defaults.js';
import { parseRichText } from './richText.js';

/**
 * Resolve the items array from a signal reference like "app.todos".
 * Looks at `window.__app.<path>` — if the value is a function (signal accessor), calls it.
 */
export function resolveItemsSignal(ref: string): any[] | null {
  if (typeof window === 'undefined') return null;

  try {
    // ref is like "app.todos" — we look at window.__app.todos
    // or "app.items" → window.__app.items
    const parts = ref.split('.');
    let obj: any = (window as any);

    // If it starts with "app", map to window.__app
    if (parts[0] === 'app') {
      obj = (window as any).__app;
      if (!obj) return null;
      for (let i = 1; i < parts.length; i++) {
        obj = obj[parts[i]];
        if (obj == null) return null;
      }
    } else {
      // Try window.__<first part>
      obj = (window as any)[`__${parts[0]}`];
      if (!obj) return null;
      for (let i = 1; i < parts.length; i++) {
        obj = obj[parts[i]];
        if (obj == null) return null;
      }
    }

    // If it's a signal accessor (function), call it
    if (typeof obj === 'function') {
      obj = obj();
    }

    return Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
}

export interface RepeatIRContext {
  nodes: Map<string, IRNode>;
  placements: IRPlacement[];
}

/**
 * Expand a repeat layout node into IR nodes for each item.
 *
 * @param repeatNodeId  The ID of the repeat layout node in the document
 * @param node          The repeat node record
 * @param doc           The full document model
 * @param parentIRId    The IR parent (slot wrapper) to place generated nodes into
 * @param ctx           Accumulator for generated IR nodes and placements
 */
export function expandRepeatToIR(
  repeatNodeId: NodeId,
  node: NodeRecord,
  doc: DocumentModel,
  parentIRId: string,
  ctx: RepeatIRContext,
): void {
  const options = node.layout?.options ?? {};
  const itemsRef = options.items as string | undefined;
  const keyField = options.key as string | undefined;
  const templateName = options.template as string | undefined;
  const emptyTemplate = options.empty as string | undefined;

  // Resolve items
  const items = itemsRef ? resolveItemsSignal(itemsRef) : null;

  if (!items || items.length === 0) {
    // Render empty template if specified
    if (emptyTemplate) {
      const emptyMacro = doc.macros.get(emptyTemplate);
      if (emptyMacro) {
        const emptyId = `${repeatNodeId}::ri::empty::0`;
        expandTemplateNodeToIR(
          emptyMacro.template,
          emptyId,
          parentIRId,
          0,
          {},
          ctx,
        );
      }
    }
    return;
  }

  // Resolve template macro
  if (!templateName) return;
  const macro = doc.macros.get(templateName);
  if (!macro) return;

  // Generate IR nodes for each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const key = keyField && item && typeof item === 'object' ? item[keyField] : i;
    const itemId = `${repeatNodeId}::ri::${key}`;

    expandTemplateNodeToIR(
      macro.template,
      itemId,
      parentIRId,
      i,
      item && typeof item === 'object' ? item : { value: item },
      ctx,
    );
  }
}

/**
 * Recursively convert a TemplateNode tree into IR nodes.
 */
function expandTemplateNodeToIR(
  template: TemplateNode,
  idPrefix: string,
  parentIRId: string,
  order: number,
  itemData: Record<string, any>,
  ctx: RepeatIRContext,
): void {
  const tag = template.tag ?? KIND_TAGS[template.kind] ?? 'div';

  // Compute classes
  const classParts: string[] = [];

  let layoutClasses: ReturnType<typeof compileLayoutClasses> | null = null;
  if (template.layout) {
    layoutClasses = compileLayoutClasses(template.layout.type, template.layout.options);
    classParts.push(layoutClasses.outer);
  }

  let tokenClasses = '';
  if (template.styleTokens.length > 0) {
    const compiled = compileTokens(template.styleTokens, template.kind);
    tokenClasses = compiled.classes;
  }

  const kindDefault = KIND_DEFAULTS[template.kind];
  if (kindDefault) {
    classParts.push(kindDefault);
  }
  if (tokenClasses) classParts.push(tokenClasses);

  const classes = classParts.filter(Boolean).join(' ');

  // Merge item data into props for text interpolation
  const props = { ...template.props };
  // Interpolate {field} references in text with item data
  let text: string | undefined;
  let richText: string | undefined;
  if (props.text !== undefined) {
    text = interpolateItemData(String(props.text), itemData);
    const parsed = parseRichText(text);
    if (parsed.hasLinks) {
      richText = parsed.html;
    }
  }

  // Build attrs
  const attrs: Record<string, string> = {};
  if (template.kind === 'input' && props.placeholder) {
    attrs['placeholder'] = interpolateItemData(props.placeholder, itemData);
  }
  if (template.kind === 'image' && props.src) {
    attrs['src'] = props.src;
    if (props.alt) attrs['alt'] = props.alt;
  }
  if (template.kind === 'link' || (template.kind === 'button' && props.href)) {
    if (props.href) attrs['href'] = interpolateItemData(props.href, itemData);
    if (props.target) attrs['target'] = props.target;
  }

  const irNode: IRNode = {
    id: idPrefix,
    tag,
    text,
    richText,
    classes,
    attrs,
  };

  ctx.nodes.set(idPrefix, irNode);
  ctx.placements.push({ parentIRId, childIRId: idPrefix, order });

  // Handle children through slots
  if (template.children && template.layout && layoutClasses) {
    const slots = template.layout.options?.slots ?? ['content'];
    for (const group of template.children) {
      const slotWrapperId = `${idPrefix}::slot::${group.slot}`;
      const wrapperClasses = layoutClasses.slotWrappers[group.slot] ?? '';

      ctx.nodes.set(slotWrapperId, {
        id: slotWrapperId,
        tag: 'div',
        classes: wrapperClasses,
        attrs: {},
        isSlotWrapper: true,
      });
      ctx.placements.push({ parentIRId: idPrefix, childIRId: slotWrapperId, order: 0 });

      for (let ci = 0; ci < group.nodes.length; ci++) {
        expandTemplateNodeToIR(
          group.nodes[ci],
          `${slotWrapperId}::${ci}`,
          slotWrapperId,
          ci,
          itemData,
          ctx,
        );
      }
    }
  } else if (template.children) {
    // No layout — place children directly
    for (const group of template.children) {
      for (let ci = 0; ci < group.nodes.length; ci++) {
        expandTemplateNodeToIR(
          group.nodes[ci],
          `${idPrefix}::${ci}`,
          idPrefix,
          ci,
          itemData,
          ctx,
        );
      }
    }
  }
}

/**
 * Replace `{field}` placeholders in a string with values from itemData.
 */
function interpolateItemData(text: string, itemData: Record<string, any>): string {
  return text.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in itemData) return String(itemData[key]);
    return match;
  });
}
