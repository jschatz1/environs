import type { DocumentModel } from '../document/model.js';
import { STYLE_TOKEN_KEYS } from '../style/tokens.js';

// ---------------------------------------------------------------------------
// Available commands & kinds
// ---------------------------------------------------------------------------

const COMMANDS = [
  'add', 'layout', 'style', 'set', 'select', 'enter', 'exit',
  'delete', 'rename', 'dup', 'place', 'move', 'show', 'list',
  'help', 'undo', 'redo', 'export', 'import', 'demo', 'script', 'fsm',
  'route', 'screen', 'history', 'macro', 'use', 'repeat',
];

const NODE_KINDS = [
  'button', 'card', 'text', 'input', 'image', 'divider',
  'container', 'menu', 'menuItem',
];

const LAYOUT_TYPES = ['stack', 'grid', 'sidebar', 'center', 'split', 'tabs', 'repeat'];

const LIST_TARGETS = ['nodes', 'children', 'slots'];

const DEMO_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const SCRIPT_SUBCOMMANDS = ['set', 'show', 'clear', 'end'];

const FSM_SUBCOMMANDS = ['define', 'state', 'show', 'delete', 'list'];

const ROUTE_SUBCOMMANDS = ['add', 'remove', 'goto', 'list', 'where'];

const SCREEN_SUBCOMMANDS = ['set'];

const HISTORY_SUBCOMMANDS = ['compact'];

const MACRO_SUBCOMMANDS = ['define', 'params', 'show', 'delete', 'list'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nodeNames(doc: DocumentModel): string[] {
  const names: string[] = [];
  for (const node of doc.nodes.values()) {
    if (node.name) names.push(node.name);
  }
  return names;
}

function slotPaths(doc: DocumentModel): string[] {
  const paths: string[] = [];
  for (const node of doc.nodes.values()) {
    if (!node.name) continue;
    const slots = node.layout?.slots ?? ['content'];
    for (const slot of slots) {
      paths.push(`${node.name}/${slot}`);
    }
  }
  return paths;
}

function fsmNames(doc: DocumentModel): string[] {
  return Array.from(doc.fsms.keys());
}

function routeNames(doc: DocumentModel): string[] {
  return doc.routing.routes.map(r => r.name);
}

function macroNames(doc: DocumentModel): string[] {
  return Array.from(doc.macros.keys());
}

function macroParamNames(doc: DocumentModel, name: string): string[] {
  const macro = doc.macros.get(name);
  if (!macro) return [];
  return macro.params.map(p => p + '=');
}

function filterByPrefix(candidates: string[], partial: string, max: number): string[] {
  if (!partial) return candidates.slice(0, max);
  const lower = partial.toLowerCase();
  const results = candidates.filter(c => c.toLowerCase().startsWith(lower));
  return results.slice(0, max);
}

// ---------------------------------------------------------------------------
// Main suggestion function
// ---------------------------------------------------------------------------

export function getSuggestions(input: string, doc: DocumentModel): string[] {
  const MAX = 10;

  // Nothing typed yet
  if (!input.trim()) return [];

  const parts = input.split(/\s+/);

  // Cursor is at a new word position (input ends with space)
  const endsWithSpace = input.endsWith(' ');
  const partial = endsWithSpace ? '' : parts[parts.length - 1];
  const completedParts = endsWithSpace ? parts.filter(p => p) : parts.slice(0, -1);

  const cmd = completedParts[0]?.toLowerCase() ?? '';
  const wordIndex = completedParts.length; // 0-based index of the word being typed

  // Position 1: command keyword
  if (wordIndex === 0) {
    return filterByPrefix(COMMANDS, partial, MAX);
  }

  // Position 2+: context-dependent
  if (wordIndex === 1) {
    switch (cmd) {
      case 'add':
        return filterByPrefix(NODE_KINDS, partial, MAX);
      case 'layout':
        return filterByPrefix(LAYOUT_TYPES, partial, MAX);
      case 'style':
        return filterByPrefix([...nodeNames(doc), ...STYLE_TOKEN_KEYS], partial, MAX);
      case 'select':
      case 'enter':
      case 'delete':
      case 'rename':
      case 'show':
      case 'dup':
        return filterByPrefix(nodeNames(doc), partial, MAX);
      case 'place':
      case 'move':
        return filterByPrefix(nodeNames(doc), partial, MAX);
      case 'list':
        return filterByPrefix(LIST_TARGETS, partial, MAX);
      case 'help':
        return filterByPrefix(COMMANDS, partial, MAX);
      case 'demo':
        return filterByPrefix(DEMO_IDS, partial, MAX);
      case 'script':
        return filterByPrefix(SCRIPT_SUBCOMMANDS, partial, MAX);
      case 'fsm':
        return filterByPrefix(FSM_SUBCOMMANDS, partial, MAX);
      case 'route':
        return filterByPrefix(ROUTE_SUBCOMMANDS, partial, MAX);
      case 'screen':
        return filterByPrefix(SCREEN_SUBCOMMANDS, partial, MAX);
      case 'history':
        return filterByPrefix(HISTORY_SUBCOMMANDS, partial, MAX);
      case 'macro':
        return filterByPrefix(MACRO_SUBCOMMANDS, partial, MAX);
      case 'use':
        return filterByPrefix(macroNames(doc), partial, MAX);
      default:
        return [];
    }
  }

  // Position 3+: deeper context
  // style <target> <tokens...>
  if (cmd === 'style' && wordIndex >= 2) {
    return filterByPrefix(STYLE_TOKEN_KEYS, partial, MAX);
  }

  // script set/show/clear <target>
  if (cmd === 'script' && wordIndex === 2) {
    const sub = completedParts[1]?.toLowerCase();
    if (sub === 'set' || sub === 'show' || sub === 'clear') {
      return filterByPrefix(nodeNames(doc), partial, MAX);
    }
  }

  // fsm state/show/delete <fsmName>
  if (cmd === 'fsm' && wordIndex === 2) {
    const sub = completedParts[1]?.toLowerCase();
    if (sub === 'state' || sub === 'show' || sub === 'delete') {
      return filterByPrefix(fsmNames(doc), partial, MAX);
    }
  }

  // history compact --preview/--apply
  if (cmd === 'history' && wordIndex === 2) {
    const sub = completedParts[1]?.toLowerCase();
    if (sub === 'compact') {
      return filterByPrefix(['--preview', '--apply'], partial, MAX);
    }
  }

  // route remove <name>, route goto — suggest route names
  if (cmd === 'route' && wordIndex === 2) {
    const sub = completedParts[1]?.toLowerCase();
    if (sub === 'remove') {
      return filterByPrefix(routeNames(doc), partial, MAX);
    }
  }

  // screen set <routeName> <nodeName>
  if (cmd === 'screen' && wordIndex === 2) {
    const sub = completedParts[1]?.toLowerCase();
    if (sub === 'set') {
      return filterByPrefix(routeNames(doc), partial, MAX);
    }
  }
  if (cmd === 'screen' && wordIndex === 3) {
    const sub = completedParts[1]?.toLowerCase();
    if (sub === 'set') {
      return filterByPrefix(nodeNames(doc), partial, MAX);
    }
  }

  // macro params/show/delete <macroName>
  if (cmd === 'macro' && wordIndex === 2) {
    const sub = completedParts[1]?.toLowerCase();
    if (sub === 'params' || sub === 'show' || sub === 'delete') {
      return filterByPrefix(macroNames(doc), partial, MAX);
    }
  }

  // use "Name" <param>=... — suggest param names
  if (cmd === 'use' && wordIndex >= 2) {
    const macroName = completedParts[1];
    if (macroName) {
      // Strip quotes if present
      const cleanName = macroName.replace(/^["']|["']$/g, '');
      return filterByPrefix(macroParamNames(doc, cleanName), partial, MAX);
    }
  }

  // place/move ... in/to <slotPath>
  if ((cmd === 'place' || cmd === 'move')) {
    const lastCompleted = completedParts[completedParts.length - 1]?.toLowerCase();
    if (lastCompleted === 'in' || lastCompleted === 'to') {
      return filterByPrefix(slotPaths(doc), partial, MAX);
    }
  }

  return [];
}
