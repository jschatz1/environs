// ---------------------------------------------------------------------------
// Heuristic NL → explicit command mapping
//
// Rule-based, no LLM. Detects keywords and quoted strings, produces
// explicit command strings for transparency.
// ---------------------------------------------------------------------------

export interface NLResult {
  explicit: string[];    // explicit command strings to execute
  confidence: number;    // 0-1, how confident the mapping is
}

const KIND_KEYWORDS = ['sidebar', 'menu', 'card', 'button', 'input', 'text', 'divider', 'image', 'container'];
const LAYOUT_KEYWORDS = ['sidebar', 'stack', 'grid', 'center', 'split', 'tabs'];

export function parseNatural(input: string): NLResult {
  const lower = input.toLowerCase().trim();
  const commands: string[] = [];

  // Split on sentence-like boundaries
  const sentences = input.split(/[.;!]\s*/).filter(Boolean);

  for (const sentence of sentences) {
    const cmds = parseSentence(sentence.trim());
    commands.push(...cmds);
  }

  if (commands.length === 0) {
    // Try as a single sentence
    const cmds = parseSentence(input.trim());
    commands.push(...cmds);
  }

  return {
    explicit: commands,
    confidence: commands.length > 0 ? 0.7 : 0,
  };
}

function parseSentence(sentence: string): string[] {
  const lower = sentence.toLowerCase();
  const commands: string[] = [];

  // Extract all quoted strings
  const quotedStrings: string[] = [];
  const withoutQuotes = sentence.replace(/"([^"]+)"/g, (_, q) => {
    quotedStrings.push(q);
    return `__Q${quotedStrings.length - 1}__`;
  });

  let qIdx = 0;
  function nextQuoted(): string | null {
    return qIdx < quotedStrings.length ? quotedStrings[qIdx++] : null;
  }

  // Detect "create/add/put/make a sidebar"
  if (/\b(create|add|make|put)\b/.test(lower) && /\bsidebar\b/.test(lower)) {
    const name = nextQuoted();
    commands.push(`layout sidebar${name ? ` as "${name}"` : ''}`);

    // Look for "with X on the left/right" or "put X in left/main"
    const leftMatch = sentence.match(/(?:left|sidebar)\s+(?:with\s+)?(?:a\s+)?(\w+)\s*(?:"([^"]+)")?/i);
    const mainMatch = sentence.match(/(?:main|right|content)\s+(?:with\s+)?(?:a\s+)?(\w+)\s*(?:"([^"]+)")?/i);

    return commands;
  }

  // Detect "create/add a <kind>" or "add <kind> <label>"
  const addMatch = lower.match(/\b(?:create|add|make|put|insert)\s+(?:a\s+)?(\w+)/);
  if (addMatch) {
    const kind = addMatch[1];
    if (KIND_KEYWORDS.includes(kind) || LAYOUT_KEYWORDS.includes(kind)) {
      const label = nextQuoted();

      // Check for "in left" / "in main" / "on the left"
      const slotMatch = lower.match(/\b(?:in|on|to|into)\s+(?:the\s+)?(\w+)/);
      const slot = slotMatch ? normalizeSlot(slotMatch[1]) : null;

      if (LAYOUT_KEYWORDS.includes(kind) && kind !== 'container') {
        const cmd = `layout ${kind}${label ? ` as "${label}"` : ''}`;
        if (slot) {
          commands.push(`in ${slot}: ${cmd}`);
        } else {
          commands.push(cmd);
        }
      } else {
        const cmd = `add ${kind}${label ? ` "${label}"` : ''}`;
        if (slot) {
          commands.push(`in ${slot}: ${cmd}`);
        } else {
          commands.push(cmd);
        }
      }
      return commands;
    }
  }

  // Detect "style it/this/selected <tokens>"
  if (/\b(?:style|make\s+it|set\s+style)\b/.test(lower)) {
    const tokenMatch = sentence.match(/\b(?:style|make\s+it|set\s+style)\s+(.+)/i);
    if (tokenMatch) {
      const tokens = tokenMatch[1].trim();
      commands.push(`style selected ${tokens}`);
      return commands;
    }
  }

  // Detect navigation: "go into" / "enter" / "go inside"
  if (/\b(?:go\s+into|enter|go\s+inside|open)\b/.test(lower)) {
    const target = nextQuoted();
    commands.push(target ? `enter "${target}"` : 'enter');
    return commands;
  }

  // Detect "go back" / "exit" / "go up"
  if (/\b(?:go\s+back|exit|go\s+up|leave)\b/.test(lower)) {
    commands.push('exit');
    return commands;
  }

  // Detect "select <thing>"
  if (/\b(?:select|click|pick|choose)\b/.test(lower)) {
    const target = nextQuoted();
    if (target) {
      commands.push(`select "${target}"`);
      return commands;
    }
  }

  // Detect "delete/remove <thing>"
  if (/\b(?:delete|remove|destroy)\b/.test(lower)) {
    const target = nextQuoted();
    commands.push(target ? `delete "${target}"` : 'delete selected');
    return commands;
  }

  // Detect "undo" / "redo"
  if (/\bundo\b/.test(lower)) { commands.push('undo'); return commands; }
  if (/\bredo\b/.test(lower)) { commands.push('redo'); return commands; }

  // Detect compound: "Put a menu on the left with Home and Settings"
  const compoundMatch = lower.match(/\b(?:put|add)\s+(?:a\s+)?(\w+)\s+(?:on|in)\s+(?:the\s+)?(\w+)\s+with\s+(.+)/);
  if (compoundMatch) {
    const [_, kind, slot, rest] = compoundMatch;
    const normalSlot = normalizeSlot(slot);
    if (KIND_KEYWORDS.includes(kind)) {
      const label = nextQuoted();
      commands.push(`in ${normalSlot}: add ${kind}${label ? ` "${label}"` : ''}`);

      // Parse "with X and Y and Z" as menu items or children
      const items = rest.split(/\s+and\s+/i);
      for (const item of items) {
        const trimmed = item.trim().replace(/[.!;]$/, '');
        if (trimmed) {
          const childKind = kind === 'menu' ? 'menuItem' : 'text';
          commands.push(`in ${normalSlot}: add ${childKind} "${trimmed}"`);
        }
      }
      return commands;
    }
  }

  return commands;
}

function normalizeSlot(word: string): string {
  const map: Record<string, string> = {
    left: 'left', right: 'main', main: 'main', content: 'content',
    center: 'content', sidebar: 'left', body: 'main',
  };
  return map[word.toLowerCase()] ?? word.toLowerCase();
}
