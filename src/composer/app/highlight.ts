// ---------------------------------------------------------------------------
// Command language syntax highlighter
// Zero-dependency, regex-based tokenizer that returns HTML with <span> tags.
// ---------------------------------------------------------------------------

const COMMANDS = new Set([
  'add', 'layout', 'style', 'set', 'place', 'move', 'select', 'enter', 'exit',
  'show', 'list', 'rename', 'delete', 'dup', 'duplicate', 'undo', 'redo',
  'export', 'import', 'help', 'script', 'fsm', 'route', 'screen', 'history',
  'macro', 'use', 'repeat',
]);

const SUBCOMMANDS = new Set([
  'define', 'state', 'set', 'show', 'clear', 'list', 'end', 'add', 'remove',
  'goto', 'where', 'compact', 'params', 'delete',
]);

const MODIFIERS = new Set([
  'in', 'as', 'named', 'on', 'to', 'from', 'order', 'initial',
]);

const TARGETS = new Set([
  'selected', 'scope', 'root',
]);

// Colors
const C_CMD      = '#2563eb'; // blue-600
const C_SUB      = '#3b82f6'; // blue-500
const C_MOD      = '#9333ea'; // purple-600
const C_TARGET   = '#d97706'; // amber-600
const C_STRING   = '#059669'; // emerald-600
const C_NUMBER   = '#f97316'; // orange-500
const C_COMMENT  = '#94a3b8'; // slate-400
const C_STYLE    = '#0d9488'; // teal-600
const C_FLAG     = '#64748b'; // slate-500
const C_SEMI     = '#cbd5e1'; // slate-300

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function span(color: string, text: string): string {
  return `<span style="color:${color}">${esc(text)}</span>`;
}

type Token = { html: string; end: number };

// Try to match a pattern at position `i` in `line`. Returns token or null.
function tryMatch(line: string, i: number): Token | null {
  const rest = line.slice(i);

  // Triple-quoted strings
  if (rest.startsWith('"""')) {
    const close = rest.indexOf('"""', 3);
    if (close !== -1) {
      const matched = rest.slice(0, close + 3);
      return { html: span(C_STRING, matched), end: i + matched.length };
    }
    // Unclosed triple-quote: color rest of line
    return { html: span(C_STRING, rest), end: line.length };
  }

  // Double-quoted strings
  if (rest[0] === '"') {
    const m = rest.match(/^"(?:[^"\\]|\\.)*"/);
    if (m) return { html: span(C_STRING, m[0]), end: i + m[0].length };
    // Unclosed: color rest
    return { html: span(C_STRING, rest), end: line.length };
  }

  // Single-quoted strings
  if (rest[0] === "'") {
    const m = rest.match(/^'(?:[^'\\]|\\.)*'/);
    if (m) return { html: span(C_STRING, m[0]), end: i + m[0].length };
    return { html: span(C_STRING, rest), end: line.length };
  }

  // Flags --word
  {
    const m = rest.match(/^--\w+/);
    if (m) return { html: span(C_FLAG, m[0]), end: i + m[0].length };
  }

  // Semicolons
  if (rest[0] === ';') {
    return { html: span(C_SEMI, ';'), end: i + 1 };
  }

  // Style tokens: word:value (but not just a bare colon)
  // Must start at a word boundary context. Pattern: identifier:value
  {
    const m = rest.match(/^[\w][\w-]*:[\w][\w\-./]*/);
    if (m) return { html: span(C_STYLE, m[0]), end: i + m[0].length };
  }

  // Numbers (standalone)
  {
    const m = rest.match(/^-?\d+(\.\d+)?(?=\s|;|$)/);
    if (m) {
      // Only match if preceded by whitespace or start of string
      if (i === 0 || /\s/.test(line[i - 1])) {
        return { html: span(C_NUMBER, m[0]), end: i + m[0].length };
      }
    }
  }

  // Words (identifiers/keywords)
  {
    const m = rest.match(/^[a-zA-Z_][\w-]*/);
    if (m) {
      const word = m[0];
      const lower = word.toLowerCase();
      if (TARGETS.has(lower)) return { html: span(C_TARGET, word), end: i + word.length };
      if (MODIFIERS.has(lower)) return { html: span(C_MOD, word), end: i + word.length };
      // Commands get command color only at position 0 (after optional whitespace)
      // or right after a scope prefix "in xxx:"
      if (COMMANDS.has(lower)) {
        const before = line.slice(0, i).trimStart();
        // First word, or after "in <word>:", or after semicolon
        if (before === '' || /;\s*$/.test(before) || /^in\s+\S+:\s*$/i.test(before)) {
          return { html: span(C_CMD, word), end: i + word.length };
        }
        // Could also be a subcommand (e.g. "fsm delete")
        if (SUBCOMMANDS.has(lower)) {
          return { html: span(C_SUB, word), end: i + word.length };
        }
      }
      if (SUBCOMMANDS.has(lower)) {
        // Subcommand: only color if preceded by a command keyword
        const before = line.slice(0, i).trim();
        const lastWord = before.split(/\s+/).pop()?.toLowerCase() ?? '';
        if (COMMANDS.has(lastWord)) {
          return { html: span(C_SUB, word), end: i + word.length };
        }
      }
      // Plain word
      return { html: esc(word), end: i + word.length };
    }
  }

  return null;
}

function highlightLine(line: string): string {
  const trimmed = line.trimStart();

  // Full-line comments
  if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
    return span(C_COMMENT, line);
  }

  let result = '';
  let i = 0;

  while (i < line.length) {
    // Whitespace: pass through
    if (/\s/.test(line[i])) {
      result += line[i];
      i++;
      continue;
    }

    // Inline comment: # or // after content
    const rest = line.slice(i);
    if (rest.startsWith('//') || (rest.startsWith('#') && (i === 0 || /\s/.test(line[i - 1])))) {
      result += span(C_COMMENT, rest);
      break;
    }

    const token = tryMatch(line, i);
    if (token) {
      result += token.html;
      i = token.end;
    } else {
      // Single unrecognized character
      result += esc(line[i]);
      i++;
    }
  }

  return result;
}

export function highlightCommand(input: string): string {
  if (!input) return '';
  return input.split('\n').map(highlightLine).join('\n');
}
