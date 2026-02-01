import type { NodeKind } from '../document/model.js';

// ---------------------------------------------------------------------------
// Default Tailwind classes per node kind
// ---------------------------------------------------------------------------

export const KIND_DEFAULTS: Partial<Record<NodeKind, string>> = {
  container: 'min-w-0',
  outlet: 'min-w-0',
  card: 'rounded-xl border border-slate-200 bg-white shadow-sm',
  text: '',
  button: 'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
  input: 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
  menu: 'flex flex-col gap-1',
  menuItem: 'flex items-center rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100',
  divider: 'border-t border-slate-200',
  link: 'text-blue-700 hover:underline cursor-pointer',
};

// ---------------------------------------------------------------------------
// Default tag per kind
// ---------------------------------------------------------------------------

export const KIND_TAGS: Partial<Record<NodeKind, string>> = {
  layout: 'div',
  container: 'div',
  card: 'div',
  text: 'span',
  button: 'button',
  input: 'input',
  menu: 'nav',
  menuItem: 'button',
  image: 'img',
  divider: 'hr',
  link: 'a',
  outlet: 'div',
};

// ---------------------------------------------------------------------------
// Default props per kind
// ---------------------------------------------------------------------------

export const KIND_DEFAULT_PROPS: Partial<Record<NodeKind, Record<string, any>>> = {
  input: { placeholder: '' },
  button: { text: 'Button' },
  text: { text: 'Text' },
  image: { src: '', alt: '' },
  link: { text: 'Link', href: '' },
};
