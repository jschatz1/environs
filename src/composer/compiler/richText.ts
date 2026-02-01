// ---------------------------------------------------------------------------
// Rich text parser — converts markdown-style [text](url) links to HTML
// ---------------------------------------------------------------------------

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

export interface RichTextResult {
  html: string;
  hasLinks: boolean;
}

export function parseRichText(text: string): RichTextResult {
  if (!LINK_RE.test(text)) {
    return { html: text, hasLinks: false };
  }

  // Reset lastIndex after test()
  LINK_RE.lastIndex = 0;

  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = LINK_RE.exec(text)) !== null) {
    // Escape plain text before this match
    result += escapeHTML(text.slice(lastIndex, match.index));
    const linkText = escapeHTML(match[1]);
    const href = escapeAttr(match[2]);
    result += `<a href="${href}" class="text-blue-700 hover:underline cursor-pointer">${linkText}</a>`;
    lastIndex = match.index + match[0].length;
  }

  // Escape remaining plain text
  result += escapeHTML(text.slice(lastIndex));

  return { html: result, hasLinks: true };
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str: string): string {
  return escapeHTML(str).replace(/"/g, '&quot;');
}
