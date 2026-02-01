import type { NodeKind } from '../document/model.js';

// ---------------------------------------------------------------------------
// Token → Tailwind compilation
// ---------------------------------------------------------------------------

export interface ParsedToken {
  key: string;
  value?: string;
  raw?: string; // for tw:"..." escape hatch
}

export function parseToken(token: string): ParsedToken {
  // tw:"..." escape hatch
  if (token.startsWith('tw:')) {
    const raw = token.slice(3);
    // Strip quotes if present
    if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
      return { key: 'tw', raw: raw.slice(1, -1) };
    }
    return { key: 'tw', raw };
  }

  const colon = token.indexOf(':');
  if (colon === -1) {
    return { key: token };
  }
  return { key: token.slice(0, colon), value: token.slice(colon + 1) };
}

export interface CompileResult {
  classes: string;
  warnings: string[];
}

export function compileTokens(tokens: string[], kind?: NodeKind): CompileResult {
  const classes: string[] = [];
  const warnings: string[] = [];

  for (const token of tokens) {
    const parsed = parseToken(token);
    const result = compileSingleToken(parsed, kind);
    if (result) {
      classes.push(result);
    } else if (parsed.key !== 'tw') {
      warnings.push(`Unknown token: "${token}"`);
    }
  }

  return { classes: classes.join(' '), warnings };
}

function compileSingleToken(parsed: ParsedToken, kind?: NodeKind): string | null {
  // Escape hatch
  if (parsed.key === 'tw' && parsed.raw) {
    return parsed.raw;
  }

  // Presets (macro tokens)
  const preset = PRESETS[parsed.key];
  if (preset && !parsed.value) {
    return preset;
  }

  // Kind-specialized tokens
  if (kind && parsed.value) {
    const specialized = KIND_SPECIALIZATIONS[kind]?.[`${parsed.key}:${parsed.value}`];
    if (specialized) return specialized;
  }

  // Standard token mapping
  const key = parsed.value ? `${parsed.key}:${parsed.value}` : parsed.key;
  return TOKEN_MAP[key] ?? null;
}

// ---------------------------------------------------------------------------
// Exact token → Tailwind mappings
// ---------------------------------------------------------------------------

const TOKEN_MAP: Record<string, string> = {
  // Padding — colon syntax
  'pad:0': 'p-0', 'pad:1': 'p-1', 'pad:2': 'p-2', 'pad:3': 'p-3',
  'pad:4': 'p-4', 'pad:5': 'p-5', 'pad:6': 'p-6', 'pad:8': 'p-8',
  'pad:10': 'p-10', 'pad:12': 'p-12',
  // Padding — dash shorthands
  'pad-0': 'p-0', 'pad-1': 'p-1', 'pad-2': 'p-2', 'pad-3': 'p-3',
  'pad-4': 'p-4', 'pad-5': 'p-5', 'pad-6': 'p-6', 'pad-8': 'p-8',
  'pad-10': 'p-10', 'pad-12': 'p-12',
  // Padding — named shorthands
  'pad-xs': 'p-1', 'pad-sm': 'p-2', 'pad-md': 'p-4', 'pad-lg': 'p-6', 'pad-xl': 'p-8',

  'px:0': 'px-0', 'px:2': 'px-2', 'px:3': 'px-3', 'px:4': 'px-4',
  'px:6': 'px-6', 'px:8': 'px-8', 'px:10': 'px-10', 'px:12': 'px-12',

  'py:0': 'py-0', 'py:2': 'py-2', 'py:3': 'py-3', 'py:4': 'py-4',
  'py:6': 'py-6', 'py:8': 'py-8', 'py:10': 'py-10', 'py:12': 'py-12',

  // Margin
  'm:0': 'm-0', 'm:2': 'm-2', 'm:3': 'm-3', 'm:4': 'm-4',
  'm:6': 'm-6', 'm:8': 'm-8',
  'mx:auto': 'mx-auto',

  // Gap — colon syntax
  'gap:0': 'gap-0', 'gap:1': 'gap-1', 'gap:2': 'gap-2', 'gap:3': 'gap-3',
  'gap:4': 'gap-4', 'gap:6': 'gap-6', 'gap:8': 'gap-8',
  'gap:10': 'gap-10', 'gap:12': 'gap-12',
  // Gap — dash shorthands
  'gap-0': 'gap-0', 'gap-1': 'gap-1', 'gap-2': 'gap-2', 'gap-3': 'gap-3',
  'gap-4': 'gap-4', 'gap-6': 'gap-6', 'gap-8': 'gap-8',
  'gap-10': 'gap-10', 'gap-12': 'gap-12',
  // Gap — named shorthands
  'gap-xs': 'gap-1', 'gap-sm': 'gap-2', 'gap-md': 'gap-4', 'gap-lg': 'gap-6',

  // Border radius — colon syntax
  'radius:none': 'rounded-none', 'radius:sm': 'rounded-sm', 'radius:md': 'rounded-md',
  'radius:lg': 'rounded-lg', 'radius:xl': 'rounded-xl', 'radius:2xl': 'rounded-2xl',
  'radius:full': 'rounded-full',
  // Border radius — bare names
  'rounded': 'rounded-md', 'rounded-sm': 'rounded-sm', 'rounded-md': 'rounded-md',
  'rounded-lg': 'rounded-lg', 'rounded-xl': 'rounded-xl', 'rounded-full': 'rounded-full',

  // Borders
  'border': 'border border-slate-200',
  'border-2': 'border-2 border-slate-200',
  'border:muted': 'border border-slate-100',
  'border:strong': 'border border-slate-300',
  'divider': 'border-b border-slate-200',
  'ring': 'ring-1 ring-slate-200',

  // Elevation — colon syntax
  'elev:0': 'shadow-none', 'elev:1': 'shadow-sm', 'elev:2': 'shadow',
  'elev:3': 'shadow-md', 'elev:4': 'shadow-lg',
  // Elevation — bare names
  'shadow': 'shadow', 'shadow-sm': 'shadow-sm', 'shadow-md': 'shadow-md',
  'shadow-lg': 'shadow-lg', 'shadow-xl': 'shadow-xl',

  // Typography — colon syntax
  'text:xs': 'text-xs', 'text:sm': 'text-sm', 'text:base': 'text-base',
  'text:lg': 'text-lg', 'text:xl': 'text-xl', 'text:2xl': 'text-2xl', 'text:3xl': 'text-3xl',
  // Typography — bare names
  'text-xs': 'text-xs', 'text-sm': 'text-sm', 'text-lg': 'text-lg',
  'text-xl': 'text-xl', 'text-2xl': 'text-2xl', 'text-3xl': 'text-3xl',
  'bold': 'font-bold', 'semibold': 'font-semibold', 'medium': 'font-medium',
  'light': 'font-light', 'italic': 'italic',
  'uppercase': 'uppercase', 'tracking-wide': 'tracking-wide',
  'leading-tight': 'leading-tight', 'leading-relaxed': 'leading-relaxed',

  'weight:normal': 'font-normal', 'weight:medium': 'font-medium',
  'weight:semibold': 'font-semibold', 'weight:bold': 'font-bold',

  'leading:tight': 'leading-tight', 'leading:snug': 'leading-snug',
  'leading:normal': 'leading-normal', 'leading:relaxed': 'leading-relaxed',

  // Color intent (base, non-kind-specialized)
  'tone:neutral': 'text-slate-900',
  'tone:muted': 'text-slate-600',
  'tone:primary': 'text-blue-700',
  'tone:danger': 'text-red-700',
  'tone:success': 'text-emerald-700',

  // Backgrounds
  'bg:surface': 'bg-white',
  'bg:muted': 'bg-slate-50',
  'bg:primary': 'bg-blue-600',
  'bg:danger': 'bg-red-600',
  'bg:success': 'bg-emerald-600',

  // Width — colon syntax
  'w:full': 'w-full', 'w:64': 'w-64', 'w:72': 'w-72', 'w:80': 'w-80', 'w:96': 'w-96',
  // Width — bare names
  'w-full': 'w-full', 'w-auto': 'w-auto', 'w-screen': 'w-screen',

  // Height — colon syntax
  'h:full': 'h-full', 'h:screen': 'h-screen',
  // Height — bare names
  'h-full': 'h-full', 'h-auto': 'h-auto', 'h-screen': 'h-screen',

  // Max width
  'maxw:sm': 'max-w-sm', 'maxw:md': 'max-w-md', 'maxw:lg': 'max-w-lg',
  'maxw:xl': 'max-w-xl', 'maxw:2xl': 'max-w-2xl', 'maxw:3xl': 'max-w-3xl',
  'maxw:4xl': 'max-w-4xl', 'maxw:5xl': 'max-w-5xl', 'maxw:6xl': 'max-w-6xl', 'maxw:7xl': 'max-w-7xl',

  // Flex — bare names
  'flex': 'flex', 'flex-col': 'flex flex-col', 'flex-row': 'flex flex-row', 'flex-wrap': 'flex-wrap',
  'items-center': 'items-center', 'justify-center': 'justify-center', 'justify-between': 'justify-between',
  'self-center': 'self-center', 'self-end': 'self-end',
  'grow': 'grow', 'nogrow': 'grow-0', 'shrink': 'shrink', 'noshrink': 'shrink-0', 'shrink-0': 'shrink-0',

  // Centering
  'center': 'flex items-center justify-center',
  'centerX': 'flex justify-center',
  'centerY': 'flex items-center',

  // Text alignment
  'align:left': 'text-left', 'align:center': 'text-center', 'align:right': 'text-right',
};

export const STYLE_TOKEN_KEYS: string[] = Object.keys(TOKEN_MAP);

// ---------------------------------------------------------------------------
// Presets (macro tokens)
// ---------------------------------------------------------------------------

const PRESETS: Record<string, string> = {
  card: 'rounded-xl border border-slate-200 bg-white shadow-sm',
  panel: 'rounded-lg border border-slate-200 bg-white',
  muted: 'text-slate-600',
  chip: 'inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-sm',
  link: 'text-blue-700 hover:underline',
  focusable: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
};

// ---------------------------------------------------------------------------
// Kind-specialized token expansions
// ---------------------------------------------------------------------------

const KIND_SPECIALIZATIONS: Partial<Record<NodeKind, Record<string, string>>> = {
  button: {
    'tone:primary': 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    'tone:neutral': 'bg-slate-900 text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2',
    'tone:danger': 'bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
    'tone:success': 'bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
    'tone:muted': 'bg-slate-100 text-slate-900 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2',
    'bg:primary': 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
    'bg:danger': 'bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
    'bg:success': 'bg-emerald-600 text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2',
  },
};
