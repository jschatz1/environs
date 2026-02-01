/**
 * Text-level preprocessor that expands `repeat N [as ident] { ... }` blocks
 * before the command parser runs. This is purely textual — no AST involved.
 *
 * Syntax:
 *   repeat <N> [as <ident>] { <body> }
 *
 * {ident} inside the body is replaced with the loop index (0-based).
 * Default ident is "i".
 */

export function expandRepeat(input: string): string {
  let result = input;
  let safety = 100; // prevent infinite loops

  while (safety-- > 0) {
    const match = findRepeatBlock(result);
    if (!match) break;

    const { start, end, count, ident, body } = match;
    const expanded = expandBody(body, count, ident);
    result = result.slice(0, start) + expanded + result.slice(end);
  }

  return result;
}

interface RepeatMatch {
  start: number;   // index of 'r' in 'repeat'
  end: number;     // index after closing '}'
  count: number;
  ident: string;
  body: string;
}

function findRepeatBlock(input: string): RepeatMatch | null {
  // Find 'repeat' keyword that's at word boundary
  const re = /\brepeat\b/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(input)) !== null) {
    const start = m.index;
    let pos = start + 6; // skip 'repeat'

    // Skip whitespace
    pos = skipWhitespace(input, pos);

    // Parse the count (integer literal)
    const countResult = parseInteger(input, pos);
    if (!countResult) continue;
    const { value: count, end: countEnd } = countResult;
    pos = countEnd;

    // Skip whitespace
    pos = skipWhitespace(input, pos);

    // Optional: 'as <ident>'
    let ident = 'i';
    if (input.slice(pos, pos + 2) === 'as' && isWhitespace(input[pos + 2])) {
      pos = skipWhitespace(input, pos + 2);
      const identResult = parseIdent(input, pos);
      if (!identResult) continue;
      ident = identResult.value;
      pos = identResult.end;
    }

    // Skip whitespace
    pos = skipWhitespace(input, pos);

    // Expect '{'
    if (input[pos] !== '{') continue;

    // Find matching '}' with brace depth counting
    const bodyResult = extractBracedBody(input, pos);
    if (!bodyResult) continue;

    return {
      start,
      end: bodyResult.end,
      count,
      ident,
      body: bodyResult.body,
    };
  }

  return null;
}

function expandBody(body: string, count: number, ident: string): string {
  const lines: string[] = [];
  // Build a regex that matches {ident} exactly — no spaces inside braces
  const placeholder = new RegExp('\\{' + escapeRegex(ident) + '\\}', 'g');

  for (let i = 0; i < count; i++) {
    const expanded = body.replace(placeholder, String(i));
    lines.push(expanded.trim());
  }

  return lines.join('\n');
}

function skipWhitespace(input: string, pos: number): number {
  while (pos < input.length && isWhitespace(input[pos])) pos++;
  return pos;
}

function isWhitespace(ch: string | undefined): boolean {
  return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n';
}

function parseInteger(input: string, pos: number): { value: number; end: number } | null {
  let end = pos;
  if (end < input.length && input[end] === '-') end++;
  if (end >= input.length || input[end] < '0' || input[end] > '9') return null;
  while (end < input.length && input[end] >= '0' && input[end] <= '9') end++;
  // Must be followed by whitespace, '{', or end
  if (end < input.length && !isWhitespace(input[end]) && input[end] !== '{') return null;
  return { value: parseInt(input.slice(pos, end), 10), end };
}

function parseIdent(input: string, pos: number): { value: string; end: number } | null {
  if (pos >= input.length) return null;
  const ch = input[pos];
  if (!((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_')) return null;
  let end = pos + 1;
  while (end < input.length) {
    const c = input[end];
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c === '_') {
      end++;
    } else {
      break;
    }
  }
  return { value: input.slice(pos, end), end };
}

/**
 * Extract the body between matched braces, handling:
 * - Nested braces
 * - Single and double quoted strings
 * - Triple-quoted strings (""")
 * - Comments (// and #)
 */
function extractBracedBody(input: string, openPos: number): { body: string; end: number } | null {
  let depth = 0;
  let pos = openPos;

  while (pos < input.length) {
    const ch = input[pos];

    // Triple-quoted string
    if (ch === '"' && input[pos + 1] === '"' && input[pos + 2] === '"') {
      pos += 3;
      while (pos < input.length) {
        if (input[pos] === '"' && input[pos + 1] === '"' && input[pos + 2] === '"') {
          pos += 3;
          break;
        }
        pos++;
      }
      continue;
    }

    // Double-quoted string
    if (ch === '"') {
      pos++;
      while (pos < input.length && input[pos] !== '"') {
        if (input[pos] === '\\') pos++; // skip escaped char
        pos++;
      }
      pos++; // skip closing quote
      continue;
    }

    // Single-quoted string
    if (ch === "'") {
      pos++;
      while (pos < input.length && input[pos] !== "'") {
        if (input[pos] === '\\') pos++;
        pos++;
      }
      pos++; // skip closing quote
      continue;
    }

    // Line comment //
    if (ch === '/' && input[pos + 1] === '/') {
      while (pos < input.length && input[pos] !== '\n') pos++;
      continue;
    }

    // Line comment #
    if (ch === '#') {
      while (pos < input.length && input[pos] !== '\n') pos++;
      continue;
    }

    // Braces
    if (ch === '{') {
      depth++;
      pos++;
      continue;
    }

    if (ch === '}') {
      depth--;
      if (depth === 0) {
        // Body is between openPos+1 and pos
        return {
          body: input.slice(openPos + 1, pos),
          end: pos + 1,
        };
      }
      pos++;
      continue;
    }

    pos++;
  }

  return null; // unmatched braces
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
