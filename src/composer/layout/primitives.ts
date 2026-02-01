import type { LayoutType } from '../document/model.js';

// ---------------------------------------------------------------------------
// Slot definitions per layout type
// ---------------------------------------------------------------------------

const LAYOUT_SLOTS: Record<LayoutType, string[]> = {
  stack: ['content'],
  grid: ['content'],
  sidebar: ['left', 'main'],
  center: ['content'],
  tabs: ['content'],
  split: ['left', 'right'],
};

export function layoutSlotsForType(type: LayoutType): string[] {
  return LAYOUT_SLOTS[type] ?? ['content'];
}

// ---------------------------------------------------------------------------
// Layout → Tailwind class compilation
// ---------------------------------------------------------------------------

export interface LayoutClasses {
  outer: string;
  slotWrappers: Record<string, string>;
}

export function compileLayoutClasses(type: LayoutType, options: Record<string, any>): LayoutClasses {
  switch (type) {
    case 'stack':
      return compileStack(options);
    case 'grid':
      return compileGrid(options);
    case 'sidebar':
      return compileSidebar(options);
    case 'center':
      return compileCenter(options);
    case 'split':
      return compileSplit(options);
    case 'tabs':
      return compileTabs(options);
    default:
      return { outer: '', slotWrappers: {} };
  }
}

function compileStack(opts: Record<string, any>): LayoutClasses {
  const axis = opts.axis ?? 'y';
  const gap = opts.gap ?? 4;
  const align = opts.align ?? 'stretch';
  const justify = opts.justify ?? 'start';
  const wrap = opts.wrap ?? false;

  const alignMap: Record<string, string> = {
    start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch',
  };
  const justifyMap: Record<string, string> = {
    start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between',
  };

  const classes = [
    'flex min-w-0',
    axis === 'x' ? 'flex-row' : 'flex-col',
    `gap-${gap}`,
    alignMap[align] ?? '',
    justifyMap[justify] ?? '',
    wrap ? 'flex-wrap' : '',
  ].filter(Boolean).join(' ');

  const slotClasses = [
    'min-w-0 grow flex',
    axis === 'x' ? 'flex-row' : 'flex-col',
    `gap-${gap}`,
    alignMap[align] ?? '',
    justifyMap[justify] ?? '',
  ].filter(Boolean).join(' ');

  return { outer: classes, slotWrappers: { content: slotClasses } };
}

function compileGrid(opts: Record<string, any>): LayoutClasses {
  const cols = opts.cols ?? 1;
  const gap = opts.gap ?? 4;

  return {
    outer: `grid min-w-0 grid-cols-${cols} gap-${gap}`,
    slotWrappers: { content: 'contents' },
  };
}

function compileSidebar(opts: Record<string, any>): LayoutClasses {
  const leftWidth = opts.leftWidth ?? 72;
  const divider = opts.divider !== false;
  const minH = opts.minH ?? 'screen';
  const pad = opts.pad ?? 6;

  const minHMap: Record<string, string> = {
    screen: 'min-h-screen', full: 'min-h-full', none: '',
  };

  const outer = ['flex min-w-0', minHMap[minH] ?? ''].filter(Boolean).join(' ');

  const leftClasses = [
    `min-w-0 w-${leftWidth} bg-white`,
    divider ? 'border-r border-slate-200' : '',
  ].filter(Boolean).join(' ');

  const mainClasses = [
    'min-w-0 flex-1',
    `p-${pad}`,
  ].join(' ');

  return {
    outer,
    slotWrappers: { left: leftClasses, main: mainClasses },
  };
}

function compileCenter(opts: Record<string, any>): LayoutClasses {
  const maxW = opts.maxW ?? '5xl';
  const pad = opts.pad ?? 6;

  return {
    outer: `min-w-0 w-full mx-auto max-w-${maxW} p-${pad}`,
    slotWrappers: { content: 'contents' },
  };
}

function compileSplit(opts: Record<string, any>): LayoutClasses {
  const gap = opts.gap ?? 4;
  return {
    outer: `flex min-w-0 gap-${gap}`,
    slotWrappers: { left: 'min-w-0 flex-1', right: 'min-w-0 flex-1' },
  };
}

function compileTabs(opts: Record<string, any>): LayoutClasses {
  return {
    outer: 'min-w-0',
    slotWrappers: { content: 'contents' },
  };
}
