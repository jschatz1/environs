// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenType =
  | 'IDENT' | 'STRING' | 'NUMBER' | 'BOOLEAN'
  | 'COLON' | 'SEMI' | 'SLASH' | 'HASH' | 'EQUALS'
  | 'LBRACE' | 'RBRACE' | 'LBRACKET' | 'RBRACKET' | 'COMMA'
  | 'FLAG'  // --something
  | 'NEWLINE' | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    // Whitespace (skip, but not newlines)
    if (ch === ' ' || ch === '\t') { i++; continue; }

    // Newline
    if (ch === '\n') { tokens.push({ type: 'NEWLINE', value: '\n', pos: i }); i++; continue; }
    if (ch === '\r') {
      if (input[i + 1] === '\n') i++;
      tokens.push({ type: 'NEWLINE', value: '\n', pos: i }); i++; continue;
    }

    // Comment — consume rest of line
    if (ch === '#' && (tokens.length === 0 || tokens[tokens.length - 1].type === 'NEWLINE' || tokens[tokens.length - 1].type === 'SEMI')) {
      const start = i;
      while (i < input.length && input[i] !== '\n') i++;
      tokens.push({ type: 'IDENT', value: '#comment', pos: start });
      continue;
    }
    if (ch === '/' && input[i + 1] === '/') {
      const start = i;
      while (i < input.length && input[i] !== '\n') i++;
      tokens.push({ type: 'IDENT', value: '#comment', pos: start });
      continue;
    }

    // Flags --something
    if (ch === '-' && input[i + 1] === '-') {
      const start = i;
      i += 2;
      while (i < input.length && /[a-zA-Z0-9_-]/.test(input[i])) i++;
      tokens.push({ type: 'FLAG', value: input.slice(start, i), pos: start });
      continue;
    }

    // Single-char symbols
    if (ch === ':') { tokens.push({ type: 'COLON', value: ':', pos: i }); i++; continue; }
    if (ch === ';') { tokens.push({ type: 'SEMI', value: ';', pos: i }); i++; continue; }
    if (ch === '/') { tokens.push({ type: 'SLASH', value: '/', pos: i }); i++; continue; }
    if (ch === '#') { tokens.push({ type: 'HASH', value: '#', pos: i }); i++; continue; }
    if (ch === '=') { tokens.push({ type: 'EQUALS', value: '=', pos: i }); i++; continue; }
    if (ch === '{') { tokens.push({ type: 'LBRACE', value: '{', pos: i }); i++; continue; }
    if (ch === '}') { tokens.push({ type: 'RBRACE', value: '}', pos: i }); i++; continue; }
    if (ch === '[') { tokens.push({ type: 'LBRACKET', value: '[', pos: i }); i++; continue; }
    if (ch === ']') { tokens.push({ type: 'RBRACKET', value: ']', pos: i }); i++; continue; }
    if (ch === ',') { tokens.push({ type: 'COMMA', value: ',', pos: i }); i++; continue; }

    // Triple-quote raw string: """..."""
    if (ch === '"' && input[i + 1] === '"' && input[i + 2] === '"') {
      const start = i;
      i += 3; // skip opening """
      // Skip one leading newline if present
      if (i < input.length && input[i] === '\n') i++;
      else if (i < input.length && input[i] === '\r' && input[i + 1] === '\n') i += 2;
      let s = '';
      while (i < input.length) {
        if (input[i] === '"' && input[i + 1] === '"' && input[i + 2] === '"') break;
        s += input[i];
        i++;
      }
      if (i < input.length) i += 3; // skip closing """
      // Trim one trailing newline
      if (s.endsWith('\r\n')) s = s.slice(0, -2);
      else if (s.endsWith('\n')) s = s.slice(0, -1);
      tokens.push({ type: 'STRING', value: s, pos: start });
      continue;
    }

    // Strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let s = '';
      while (i < input.length && input[i] !== quote) {
        if (input[i] === '\\' && i + 1 < input.length) {
          i++;
          const esc = input[i];
          if (esc === 'n') s += '\n';
          else if (esc === 't') s += '\t';
          else if (esc === 'r') s += '\r';
          else s += esc;
        } else {
          s += input[i];
        }
        i++;
      }
      if (i < input.length) i++; // skip closing quote
      tokens.push({ type: 'STRING', value: s, pos: i });
      continue;
    }

    // Numbers (including negative)
    if (/[0-9]/.test(ch) || (ch === '-' && i + 1 < input.length && /[0-9]/.test(input[i + 1]))) {
      const start = i;
      if (ch === '-') i++;
      while (i < input.length && /[0-9]/.test(input[i])) i++;
      if (i < input.length && input[i] === '.') {
        i++;
        while (i < input.length && /[0-9]/.test(input[i])) i++;
      }
      const numStr = input.slice(start, i);
      // Check if this is boolean-like (shouldn't be, but just in case)
      tokens.push({ type: 'NUMBER', value: numStr, pos: start });
      continue;
    }

    // Identifiers (including booleans) — also handle leading hyphen for
    // Tailwind negative classes like -z-10, -translate-x-1/2
    if (/[a-zA-Z_]/.test(ch) || (ch === '-' && i + 1 < input.length && /[a-zA-Z]/.test(input[i + 1]))) {
      const start = i;
      while (i < input.length && /[a-zA-Z0-9_\-.]/.test(input[i])) i++;
      const word = input.slice(start, i);
      if (word === 'true' || word === 'false') {
        tokens.push({ type: 'BOOLEAN', value: word, pos: start });
      } else {
        tokens.push({ type: 'IDENT', value: word, pos: start });
      }
      continue;
    }

    // ? as help alias
    if (ch === '?') { tokens.push({ type: 'IDENT', value: 'help', pos: i }); i++; continue; }

    // Unknown char — skip
    i++;
  }

  tokens.push({ type: 'EOF', value: '', pos: i });
  return tokens;
}

// ---------------------------------------------------------------------------
// AST types
// ---------------------------------------------------------------------------

export interface ParsedProgram {
  lines: ParsedLine[];
}

export interface ParsedLine {
  statements: ParsedStatement[];
}

export interface ParsedStatement {
  scope?: ParsedSlotPath;
  command: ParsedCommand;
}

export type ParsedCommand =
  | { type: 'add'; kind: string; label?: string; as?: string; style?: ParsedStyleToken[]; options?: ParsedOption[] }
  | { type: 'layout'; layoutType: string; options?: ParsedOption[]; as?: string; style?: ParsedStyleToken[] }
  | { type: 'style'; target?: ParsedTarget; tokens: ParsedStyleToken[] }
  | { type: 'set'; target?: ParsedTarget; props: ParsedPropAssign[] }
  | { type: 'place'; node: ParsedTarget; slotPath: ParsedSlotPath; order?: number }
  | { type: 'move'; node: ParsedTarget; slotPath: ParsedSlotPath; order?: number }
  | { type: 'select'; target: ParsedTarget }
  | { type: 'enter'; target?: ParsedTarget }
  | { type: 'exit'; count: number }
  | { type: 'show'; target?: ParsedTarget; flags: string[] }
  | { type: 'list'; kind: string; scope?: string }
  | { type: 'rename'; target: ParsedTarget; name: string }
  | { type: 'delete'; target: ParsedTarget; flags: string[] }
  | { type: 'dup'; target: ParsedTarget; as?: string; flags: string[] }
  | { type: 'undo'; count: number }
  | { type: 'redo'; count: number }
  | { type: 'export'; kind: string; target: string; path?: string }
  | { type: 'import'; kind: string; source: string; data?: any }
  | { type: 'help'; topic?: string }
  | { type: 'scriptSet'; target?: ParsedTarget; source?: string }
  | { type: 'scriptEnd' }
  | { type: 'scriptShow'; target?: ParsedTarget }
  | { type: 'scriptClear'; target?: ParsedTarget }
  | { type: 'fsmDefine'; name: string; initialState: string }
  | { type: 'fsmState'; fsmName: string; stateName: string; transitions: { event: string; target: string }[] }
  | { type: 'fsmShow'; name?: string }
  | { type: 'fsmDelete'; name: string }
  | { type: 'fsmList' }
  | { type: 'routeAdd'; name: string; pattern: string }
  | { type: 'routeRemove'; name: string }
  | { type: 'routeGoto'; path: string; replace?: boolean }
  | { type: 'routeList' }
  | { type: 'routeWhere' }
  | { type: 'screenSet'; routeName: string; nodeName: string }
  | { type: 'historyCompact'; mode: 'preview' | 'apply' }
  | { type: 'macroDefine'; name: string; from: string }
  | { type: 'macroParams'; name: string; params: string[] }
  | { type: 'macroShow'; name: string }
  | { type: 'macroList' }
  | { type: 'macroDelete'; name: string }
  | { type: 'use'; name: string; bindings: { key: string; value: any }[] }
  | { type: 'comment'; text: string }
  | { type: 'error'; message: string; input: string };

export interface ParsedTarget {
  kind: 'keyword' | 'id' | 'name' | 'path';
  value: string;
  path?: string[];
}

export interface ParsedSlotPath {
  anchor: string | string[]; // "scope" | "selected" | "root" | path segments
  slot?: string;
}

export interface ParsedStyleToken {
  key: string;
  value?: string | number;
}

export interface ParsedOption {
  key: string;
  value?: string | number | boolean;
}

export interface ParsedPropAssign {
  key: string;
  value: any;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token { return this.tokens[this.pos] ?? { type: 'EOF', value: '', pos: -1 }; }
  private advance(): Token { return this.tokens[this.pos++] ?? { type: 'EOF', value: '', pos: -1 }; }
  private check(type: TokenType): boolean { return this.peek().type === type; }
  private checkValue(value: string): boolean { return this.peek().value === value; }

  private expect(type: TokenType): Token {
    if (this.check(type)) return this.advance();
    throw new Error(`Expected ${type} but got ${this.peek().type} "${this.peek().value}" at pos ${this.peek().pos}`);
  }

  private match(type: TokenType): Token | null {
    if (this.check(type)) return this.advance();
    return null;
  }

  private matchValue(value: string): boolean {
    if (this.checkValue(value)) { this.advance(); return true; }
    return false;
  }

  private atEnd(): boolean { return this.peek().type === 'EOF'; }
  private atLineEnd(): boolean {
    const t = this.peek().type;
    return t === 'NEWLINE' || t === 'EOF' || t === 'SEMI';
  }

  // Top-level
  parseProgram(): ParsedProgram {
    const lines: ParsedLine[] = [];
    while (!this.atEnd()) {
      if (this.check('NEWLINE')) { this.advance(); continue; }
      lines.push(this.parseLine());
    }
    return { lines };
  }

  private parseLine(): ParsedLine {
    const statements: ParsedStatement[] = [];
    statements.push(this.parseStatement());
    while (this.match('SEMI')) {
      if (this.atLineEnd() || this.atEnd()) break;
      statements.push(this.parseStatement());
    }
    this.match('NEWLINE');
    return { statements };
  }

  private parseStatement(): ParsedStatement {
    // Check for scope prefix: "in <slot_path>:"
    if (this.checkValue('in')) {
      const saved = this.pos;
      try {
        this.advance(); // consume 'in'
        const slotPath = this.parseSlotPath();
        this.expect('COLON');
        const command = this.parseCommand();
        return { scope: slotPath, command };
      } catch {
        this.pos = saved;
      }
    }
    return { command: this.parseCommand() };
  }

  private parseCommand(): ParsedCommand {
    const tok = this.peek();

    if (tok.value === '#comment') {
      this.advance();
      return { type: 'comment', text: '' };
    }

    switch (tok.value) {
      case 'add': return this.parseAdd();
      case 'layout': return this.parseLayout();
      case 'style': return this.parseStyle();
      case 'set': return this.parseSet();
      case 'place': return this.parsePlace();
      case 'move': return this.parseMove();
      case 'select': return this.parseSelect();
      case 'enter': return this.parseEnter();
      case 'exit': return this.parseExit();
      case 'show': return this.parseShow();
      case 'list': return this.parseList();
      case 'rename': return this.parseRename();
      case 'delete': return this.parseDelete();
      case 'dup': case 'duplicate': return this.parseDup();
      case 'undo': return this.parseUndo();
      case 'redo': return this.parseRedo();
      case 'export': return this.parseExport();
      case 'import': return this.parseImport();
      case 'help': return this.parseHelp();
      case 'script': return this.parseScript();
      case 'fsm': return this.parseFSM();
      case 'route': return this.parseRoute();
      case 'screen': return this.parseScreen();
      case 'history': return this.parseHistory();
      case 'macro': return this.parseMacro();
      case 'use': return this.parseUse();
      default:
        this.advance();
        return { type: 'error', message: `Unknown command: ${tok.value}`, input: tok.value };
    }
  }

  // ---- Add ----
  private parseAdd(): ParsedCommand {
    this.advance(); // consume 'add'
    if (this.atLineEnd()) return { type: 'help', topic: 'add' };
    const kind = this.expect('IDENT').value;
    let label: string | undefined;
    if (this.check('STRING')) label = this.advance().value;

    let as_: string | undefined;
    let style: ParsedStyleToken[] | undefined;
    const options: ParsedOption[] = [];

    while (!this.atLineEnd()) {
      if (this.checkValue('as') || this.checkValue('named')) {
        this.advance();
        as_ = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
      } else if (this.checkValue('style')) {
        this.advance();
        style = this.parseTokenList();
      } else {
        break;
      }
    }

    return { type: 'add', kind, label, as: as_, style, options };
  }

  // ---- Layout ----
  private parseLayout(): ParsedCommand {
    this.advance(); // consume 'layout'
    if (this.atLineEnd()) return { type: 'help', topic: 'layout' };
    const layoutType = this.expect('IDENT').value;
    const options: ParsedOption[] = [];
    let as_: string | undefined;
    let style: ParsedStyleToken[] | undefined;

    while (!this.atLineEnd()) {
      if (this.checkValue('as') || this.checkValue('named')) {
        this.advance();
        as_ = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        continue;
      }
      if (this.checkValue('style')) {
        this.advance();
        style = this.parseTokenList();
        break; // style consumes rest
      }
      // Try parsing option: ident=value or ident
      if (this.check('IDENT')) {
        const key = this.advance().value;
        if (this.match('EQUALS')) {
          const val = this.parseOptionValue();
          options.push({ key, value: val });
        } else {
          options.push({ key });
        }
        continue;
      }
      break;
    }

    return { type: 'layout', layoutType, options, as: as_, style };
  }

  // ---- Style ----
  private parseStyle(): ParsedCommand {
    this.advance(); // consume 'style'
    if (this.atLineEnd()) return { type: 'help', topic: 'style' };
    let target: ParsedTarget | undefined;

    // Keywords and #id are unambiguously targets
    if (this.checkValue('selected') || this.checkValue('scope') || this.checkValue('root') || this.check('HASH')) {
      target = this.parseTarget();
    }
    // Bare IDENT: could be a target name or a style token.
    // Disambiguate: if the IDENT is followed by another token (IDENT, HASH, or key:value),
    // it's a target — because `style <name>` alone with zero tokens is useless.
    else if (this.check('IDENT')) {
      const saved = this.pos;
      const candidateName = this.advance().value;
      // Check if there's a colon right after (key:value token like tone:primary)
      if (this.check('COLON')) {
        // It's a token like "tone:primary", rewind
        this.pos = saved;
      } else if (this.atLineEnd()) {
        // Only one word — treat as a token, rewind
        this.pos = saved;
      } else {
        // Name followed by more tokens — it's a target
        // Check for path continuation
        if (this.check('SLASH')) {
          this.pos = saved;
          target = this.parseTarget();
        } else {
          target = { kind: 'name', value: candidateName };
        }
      }
    }

    const tokens = this.parseTokenList();
    return { type: 'style', target, tokens };
  }

  // ---- Set ----
  private parseSet(): ParsedCommand {
    this.advance(); // consume 'set'
    if (this.atLineEnd()) return { type: 'help', topic: 'set' };
    let target: ParsedTarget | undefined;
    if (this.checkValue('selected') || this.checkValue('scope') || this.checkValue('root') || this.check('HASH')) {
      target = this.parseTarget();
    }
    // Bare IDENT: target name if followed by another IDENT (the prop=value)
    else if (this.check('IDENT')) {
      const saved = this.pos;
      const candidateName = this.advance().value;
      if (this.check('EQUALS')) {
        // It's prop=value, not a target — rewind
        this.pos = saved;
      } else if (this.check('IDENT')) {
        // Name followed by prop — it's a target
        target = { kind: 'name', value: candidateName };
      } else {
        this.pos = saved;
      }
    }

    const props: ParsedPropAssign[] = [];
    while (!this.atLineEnd()) {
      if (this.check('IDENT')) {
        const key = this.advance().value;
        this.expect('EQUALS');
        const value = this.parsePropValue();
        props.push({ key, value });
      } else {
        break;
      }
    }

    return { type: 'set', target, props };
  }

  // ---- Place ----
  private parsePlace(): ParsedCommand {
    this.advance(); // consume 'place'
    if (this.atLineEnd()) return { type: 'help', topic: 'place' };
    const node = this.parseTarget();
    this.expectValue('in');
    const slotPath = this.parseSlotPath();
    let order: number | undefined;
    if (this.checkValue('order')) {
      this.advance();
      order = Number(this.expect('NUMBER').value);
    }
    return { type: 'place', node, slotPath, order };
  }

  // ---- Move ----
  private parseMove(): ParsedCommand {
    this.advance(); // consume 'move'
    if (this.atLineEnd()) return { type: 'help', topic: 'move' };
    const node = this.parseTarget();
    this.expectValue('to');
    const slotPath = this.parseSlotPath();
    let order: number | undefined;
    if (this.checkValue('order')) {
      this.advance();
      order = Number(this.expect('NUMBER').value);
    }
    return { type: 'move', node, slotPath, order };
  }

  // ---- Select ----
  private parseSelect(): ParsedCommand {
    this.advance();
    if (this.atLineEnd()) return { type: 'help', topic: 'select' };
    const target = this.parseTarget();
    return { type: 'select', target };
  }

  // ---- Enter ----
  private parseEnter(): ParsedCommand {
    this.advance();
    let target: ParsedTarget | undefined;
    if (!this.atLineEnd()) target = this.parseTarget();
    return { type: 'enter', target };
  }

  // ---- Exit ----
  private parseExit(): ParsedCommand {
    this.advance();
    let count = 1;
    if (this.check('NUMBER')) count = Number(this.advance().value);
    return { type: 'exit', count };
  }

  // ---- Show ----
  private parseShow(): ParsedCommand {
    this.advance();
    let target: ParsedTarget | undefined;
    const flags: string[] = [];

    if (!this.atLineEnd() && !this.check('FLAG')) {
      target = this.parseTarget();
    }
    while (this.check('FLAG')) {
      flags.push(this.advance().value);
    }
    return { type: 'show', target, flags };
  }

  // ---- List ----
  private parseList(): ParsedCommand {
    this.advance();
    let kind = 'nodes';
    let scope: string | undefined;
    if (this.check('IDENT')) kind = this.advance().value;
    if (this.check('IDENT')) scope = this.advance().value;
    return { type: 'list', kind, scope };
  }

  // ---- Rename ----
  private parseRename(): ParsedCommand {
    this.advance();
    if (this.atLineEnd()) return { type: 'help', topic: 'rename' };
    const target = this.parseTarget();
    const name = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
    return { type: 'rename', target, name };
  }

  // ---- Delete ----
  private parseDelete(): ParsedCommand {
    this.advance();
    if (this.atLineEnd()) return { type: 'help', topic: 'delete' };
    const target = this.parseTarget();
    const flags: string[] = [];
    while (this.check('FLAG')) flags.push(this.advance().value);
    return { type: 'delete', target, flags };
  }

  // ---- Dup ----
  private parseDup(): ParsedCommand {
    this.advance();
    if (this.atLineEnd()) return { type: 'help', topic: 'dup' };
    const target = this.parseTarget();
    let as_: string | undefined;
    const flags: string[] = [];
    while (!this.atLineEnd()) {
      if (this.checkValue('as') || this.checkValue('named')) {
        this.advance();
        as_ = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
      } else if (this.check('FLAG')) {
        flags.push(this.advance().value);
      } else break;
    }
    return { type: 'dup', target, as: as_, flags };
  }

  // ---- Undo/Redo ----
  private parseUndo(): ParsedCommand {
    this.advance();
    let count = 1;
    if (this.check('NUMBER')) count = Number(this.advance().value);
    return { type: 'undo', count };
  }
  private parseRedo(): ParsedCommand {
    this.advance();
    let count = 1;
    if (this.check('NUMBER')) count = Number(this.advance().value);
    return { type: 'redo', count };
  }

  // ---- Export ----
  private parseExport(): ParsedCommand {
    this.advance();
    let kind = 'log';
    let target = 'console';
    let path: string | undefined;
    if (this.check('IDENT')) kind = this.advance().value;
    if (this.check('IDENT')) {
      target = this.advance().value;
      if (target === 'file' && this.check('STRING')) {
        path = this.advance().value;
      }
    }
    return { type: 'export', kind, target, path };
  }

  // ---- Import ----
  private parseImport(): ParsedCommand {
    this.advance();
    let kind = 'log';
    let source = 'clipboard';
    let data: any;
    if (this.check('IDENT')) kind = this.advance().value;
    if (this.check('IDENT')) {
      source = this.advance().value;
      if (source === 'inline') {
        data = this.parseJSON();
      } else if (source === 'file' && this.check('STRING')) {
        data = this.advance().value;
      }
    }
    return { type: 'import', kind, source, data };
  }

  // ---- Help ----
  private parseHelp(): ParsedCommand {
    this.advance();
    let topic: string | undefined;
    if (this.check('IDENT')) topic = this.advance().value;
    // Consume any remaining words on the line so they don't leak as separate commands
    while (!this.atLineEnd() && (this.check('IDENT') || this.check('STRING') || this.check('FLAG'))) {
      this.advance();
    }
    return { type: 'help', topic };
  }

  // ---- Script ----
  private parseScript(): ParsedCommand {
    this.advance(); // consume 'script'
    if (this.atLineEnd()) return { type: 'help', topic: 'script' };
    const sub = this.expect('IDENT').value;
    switch (sub) {
      case 'set': {
        let target: ParsedTarget | undefined;
        if (!this.atLineEnd()) target = this.parseTarget();
        let source: string | undefined;
        if (this.check('STRING')) {
          source = this.advance().value;
        }
        return { type: 'scriptSet', target, source };
      }
      case 'end':
        return { type: 'scriptEnd' };
      case 'show': {
        let target: ParsedTarget | undefined;
        if (!this.atLineEnd()) target = this.parseTarget();
        return { type: 'scriptShow', target };
      }
      case 'clear': {
        let target: ParsedTarget | undefined;
        if (!this.atLineEnd()) target = this.parseTarget();
        return { type: 'scriptClear', target };
      }
      default:
        return { type: 'error', message: `Unknown script subcommand: ${sub}`, input: `script ${sub}` };
    }
  }

  // ---- FSM ----
  private parseFSM(): ParsedCommand {
    this.advance(); // consume 'fsm'
    if (this.atLineEnd()) return { type: 'help', topic: 'fsm' };
    const sub = this.expect('IDENT').value;
    switch (sub) {
      case 'define': {
        const name = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        this.expectValue('initial');
        const initialState = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        return { type: 'fsmDefine', name, initialState };
      }
      case 'state': {
        const fsmName = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        const stateName = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        const transitions: { event: string; target: string }[] = [];
        while (this.checkValue('on') && !this.atLineEnd()) {
          this.advance(); // consume 'on'
          const event = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
          const target = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
          transitions.push({ event, target });
        }
        return { type: 'fsmState', fsmName, stateName, transitions };
      }
      case 'show': {
        let name: string | undefined;
        if (!this.atLineEnd()) {
          name = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        }
        return { type: 'fsmShow', name };
      }
      case 'delete': {
        const name = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        return { type: 'fsmDelete', name };
      }
      case 'list':
        return { type: 'fsmList' };
      default:
        return { type: 'error', message: `Unknown fsm subcommand: ${sub}`, input: `fsm ${sub}` };
    }
  }

  // ---- Route ----
  private parseRoute(): ParsedCommand {
    this.advance(); // consume 'route'
    if (this.atLineEnd()) return { type: 'help', topic: 'route' };
    const sub = this.expect('IDENT').value;
    switch (sub) {
      case 'add': {
        const name = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        const pattern = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        return { type: 'routeAdd', name, pattern };
      }
      case 'remove': {
        const name = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        return { type: 'routeRemove', name };
      }
      case 'goto': {
        const path = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        let replace = false;
        if (this.check('FLAG') && this.peek().value === '--replace') {
          this.advance();
          replace = true;
        }
        return { type: 'routeGoto', path, replace };
      }
      case 'list':
        return { type: 'routeList' };
      case 'where':
        return { type: 'routeWhere' };
      default:
        return { type: 'error', message: `Unknown route subcommand: ${sub}`, input: `route ${sub}` };
    }
  }

  // ---- Screen ----
  private parseScreen(): ParsedCommand {
    this.advance(); // consume 'screen'
    if (this.atLineEnd()) return { type: 'help', topic: 'screen' };
    const sub = this.expect('IDENT').value;
    switch (sub) {
      case 'set': {
        const routeName = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        const nodeName = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        return { type: 'screenSet', routeName, nodeName };
      }
      default:
        return { type: 'error', message: `Unknown screen subcommand: ${sub}`, input: `screen ${sub}` };
    }
  }

  // ---- History ----
  private parseHistory(): ParsedCommand {
    this.advance(); // consume 'history'
    if (this.atLineEnd()) return { type: 'help', topic: 'history' };
    const sub = this.expect('IDENT').value;
    switch (sub) {
      case 'compact': {
        let mode: 'preview' | 'apply' = 'preview';
        if (this.check('FLAG')) {
          const flag = this.advance().value;
          if (flag === '--apply') mode = 'apply';
          // --preview is the default, no change needed
        }
        return { type: 'historyCompact', mode };
      }
      default:
        return { type: 'error', message: `Unknown history subcommand: ${sub}`, input: `history ${sub}` };
    }
  }

  // ---- Macro ----
  private parseMacro(): ParsedCommand {
    this.advance(); // consume 'macro'
    if (this.atLineEnd()) return { type: 'help', topic: 'macro' };
    const sub = this.expect('IDENT').value;
    switch (sub) {
      case 'define': {
        const name = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        this.expectValue('from');
        const from = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        return { type: 'macroDefine', name, from };
      }
      case 'params': {
        const name = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        const params: string[] = [];
        while (!this.atLineEnd()) {
          if (this.check('IDENT')) {
            params.push(this.advance().value);
          } else if (this.check('STRING')) {
            params.push(this.advance().value);
          } else break;
        }
        return { type: 'macroParams', name, params };
      }
      case 'show': {
        const name = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        return { type: 'macroShow', name };
      }
      case 'list':
        return { type: 'macroList' };
      case 'delete': {
        const name = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
        return { type: 'macroDelete', name };
      }
      default:
        return { type: 'error', message: `Unknown macro subcommand: ${sub}`, input: `macro ${sub}` };
    }
  }

  // ---- Use ----
  private parseUse(): ParsedCommand {
    this.advance(); // consume 'use'
    if (this.atLineEnd()) return { type: 'help', topic: 'use' };
    const name = this.check('STRING') ? this.advance().value : this.expect('IDENT').value;
    const bindings: { key: string; value: any }[] = [];
    while (!this.atLineEnd()) {
      if (this.check('IDENT')) {
        const key = this.advance().value;
        if (this.match('EQUALS')) {
          const value = this.parsePropValue();
          bindings.push({ key, value });
        } else {
          // bare key with no value — treat as true
          bindings.push({ key, value: true });
        }
      } else break;
    }
    return { type: 'use', name, bindings };
  }

  // ---- Shared pieces ----

  private parseTarget(): ParsedTarget {
    // #id
    if (this.check('HASH')) {
      this.advance();
      const id = this.expect('IDENT').value;
      return { kind: 'id', value: id };
    }

    // keywords
    const kw = this.peek().value;
    if (kw === 'selected' || kw === 'scope' || kw === 'root') {
      this.advance();
      // Could be a path: selected/foo
      if (this.check('SLASH')) {
        return this.continuePath([kw]);
      }
      return { kind: 'keyword', value: kw };
    }

    // String name
    if (this.check('STRING')) {
      return { kind: 'name', value: this.advance().value };
    }

    // Ident — could be name or start of path
    if (this.check('IDENT')) {
      const name = this.advance().value;
      if (this.check('SLASH')) {
        return this.continuePath([name]);
      }
      return { kind: 'name', value: name };
    }

    throw new Error(`Expected target at pos ${this.peek().pos}`);
  }

  private continuePath(segments: string[]): ParsedTarget {
    while (this.match('SLASH')) {
      if (this.check('HASH')) {
        this.advance();
        segments.push('#' + this.expect('IDENT').value);
      } else if (this.check('STRING')) {
        segments.push(this.advance().value);
      } else if (this.check('IDENT')) {
        segments.push(this.advance().value);
      } else break;
    }
    return { kind: 'path', value: segments.join('/'), path: segments };
  }

  private parseSlotPath(): ParsedSlotPath {
    // Could be: "left" (bare slot on scope), "AppShell/left" (path + slot), "scope/main", etc.
    const first = this.peek();

    // keyword anchor
    if (first.value === 'selected' || first.value === 'scope' || first.value === 'root') {
      this.advance();
      if (this.check('SLASH')) {
        this.advance();
        if (this.check('IDENT') || this.check('STRING')) {
          const slot = this.advance().value;
          return { anchor: first.value, slot };
        }
      }
      return { anchor: first.value };
    }

    // Ident — could be bare slot name or path
    if (this.check('IDENT') || this.check('STRING')) {
      const name = this.advance().value;
      if (this.check('SLASH')) {
        this.advance();
        // Could be more path segments
        const segments = [name];
        while (true) {
          if (this.check('IDENT') || this.check('STRING')) {
            segments.push(this.advance().value);
          } else break;
          if (!this.check('SLASH')) break;
          this.advance();
        }
        // Last segment is the slot name
        const slot = segments.pop()!;
        if (segments.length === 0) {
          return { anchor: 'scope', slot };
        }
        return { anchor: segments, slot };
      }
      // Bare slot name on scope
      return { anchor: 'scope', slot: name };
    }

    throw new Error(`Expected slot path at pos ${this.peek().pos}`);
  }

  private parseTokenList(): ParsedStyleToken[] {
    const tokens: ParsedStyleToken[] = [];
    while (!this.atLineEnd()) {
      if (this.check('FLAG')) break; // flags are not tokens
      if (this.checkValue('as') || this.checkValue('named')) break;

      if (this.check('IDENT')) {
        const key = this.advance().value;
        if (this.check('COLON')) {
          this.advance();
          // Value: could be string, number, or ident
          if (this.check('STRING')) {
            tokens.push({ key, value: this.advance().value });
          } else if (this.check('NUMBER')) {
            let val = this.advance().value;
            // Consume bracket notation following number (e.g. arbitrary Tailwind values)
            val = this.consumeStyleBrackets(val);
            tokens.push({ key, value: val });
          } else if (this.check('IDENT')) {
            let value = this.advance().value;
            // Consume bracket notation (e.g. tw:max-w-[60ch])
            value = this.consumeStyleBrackets(value);
            // Continue reading colon-separated segments for multi-part tokens
            // like tw:hover:scale-105, tw:md:flex, tw:hover:shadow-xl
            value = this.consumeStyleColonContinuation(value);
            // Consume slash-opacity (e.g. tw:bg-slate-950/55)
            value = this.consumeStyleSlash(value);
            tokens.push({ key, value });
          } else {
            tokens.push({ key });
          }
        } else {
          tokens.push({ key });
        }
      } else {
        break;
      }
    }
    return tokens;
  }

  /** Consume :IDENT/:NUMBER continuations for Tailwind modifier chains */
  private consumeStyleColonContinuation(value: string): string {
    while (this.check('COLON')) {
      const savedPos = this.pos;
      this.advance(); // consume ':'
      if (this.check('IDENT')) {
        let segment = this.advance().value;
        segment = this.consumeStyleBrackets(segment);
        value += ':' + segment;
      } else if (this.check('NUMBER')) {
        value += ':' + this.advance().value;
      } else {
        this.pos = savedPos; // rewind — colon belongs to something else
        break;
      }
    }
    // After all colon segments, check for slash-opacity
    value = this.consumeStyleSlash(value);
    return value;
  }

  /** Consume /NUMBER or /IDENT for Tailwind opacity values like bg-slate-950/55 */
  private consumeStyleSlash(value: string): string {
    if (this.check('SLASH')) {
      const savedPos = this.pos;
      this.advance(); // consume '/'
      if (this.check('NUMBER')) {
        value += '/' + this.advance().value;
      } else if (this.check('IDENT')) {
        value += '/' + this.advance().value;
      } else {
        this.pos = savedPos; // rewind — slash is a path separator
      }
    }
    return value;
  }

  /** Consume [...] bracket notation for arbitrary Tailwind values like max-w-[60ch] */
  private consumeStyleBrackets(value: string): string {
    if (this.check('LBRACKET')) {
      this.advance(); // consume '['
      let inner = '';
      while (!this.atLineEnd() && !this.check('RBRACKET')) {
        inner += this.advance().value;
      }
      if (this.check('RBRACKET')) {
        this.advance(); // consume ']'
      }
      value += '[' + inner + ']';
    }
    return value;
  }

  private parseOptionValue(): string | number | boolean {
    if (this.check('STRING')) return this.advance().value;
    if (this.check('NUMBER')) {
      const num = this.advance().value;
      // Handle compound values like "2xl", "3xl", "5xl" where the tokenizer
      // splits the number and identifier suffix into separate tokens.
      // But don't consume the IDENT if it's actually the next option key
      // (i.e. followed by '=') or a keyword like 'style', 'as', 'named'.
      if (this.check('IDENT')) {
        const nextNext = this.tokens[this.pos + 1];
        const nextVal = this.peek().value;
        const isNextKey = nextNext?.type === 'EQUALS';
        const isKeyword = nextVal === 'style' || nextVal === 'as' || nextVal === 'named';
        if (!isNextKey && !isKeyword) {
          const suffix = this.advance().value;
          return num + suffix;
        }
      }
      return Number(num);
    }
    if (this.check('BOOLEAN')) return this.advance().value === 'true';
    if (this.check('IDENT')) return this.advance().value;
    throw new Error(`Expected option value at pos ${this.peek().pos}`);
  }

  private parsePropValue(): any {
    if (this.check('LBRACE') || this.check('LBRACKET')) return this.parseJSON();
    if (this.check('STRING')) return this.advance().value;
    if (this.check('NUMBER')) {
      const num = this.advance().value;
      // Handle compound values like "2xl" where tokenizer splits number + ident.
      // But don't consume the IDENT if it's actually the next prop key
      // (i.e. followed by '=').
      if (this.check('IDENT')) {
        const nextNext = this.tokens[this.pos + 1];
        if (nextNext?.type !== 'EQUALS') {
          const suffix = this.advance().value;
          return num + suffix;
        }
      }
      return Number(num);
    }
    if (this.check('BOOLEAN')) return this.advance().value === 'true';
    if (this.check('IDENT')) return this.advance().value;
    throw new Error(`Expected prop value at pos ${this.peek().pos}`);
  }

  private parseJSON(): any {
    if (this.check('LBRACE')) return this.parseJSONObject();
    if (this.check('LBRACKET')) return this.parseJSONArray();
    if (this.check('STRING')) return this.advance().value;
    if (this.check('NUMBER')) return Number(this.advance().value);
    if (this.check('BOOLEAN')) return this.advance().value === 'true';
    if (this.checkValue('null')) { this.advance(); return null; }
    throw new Error(`Expected JSON value at pos ${this.peek().pos}`);
  }

  private parseJSONObject(): Record<string, any> {
    this.expect('LBRACE');
    const obj: Record<string, any> = {};
    if (!this.check('RBRACE')) {
      do {
        const key = this.expect('STRING').value;
        this.expect('COLON');
        obj[key] = this.parseJSON();
      } while (this.match('COMMA'));
    }
    this.expect('RBRACE');
    return obj;
  }

  private parseJSONArray(): any[] {
    this.expect('LBRACKET');
    const arr: any[] = [];
    if (!this.check('RBRACKET')) {
      do {
        arr.push(this.parseJSON());
      } while (this.match('COMMA'));
    }
    this.expect('RBRACKET');
    return arr;
  }

  private expectValue(value: string): void {
    if (this.peek().value === value) { this.advance(); return; }
    throw new Error(`Expected "${value}" but got "${this.peek().value}" at pos ${this.peek().pos}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseExplicit(input: string): ParsedProgram {
  const tokens = tokenize(input);
  const parser = new Parser(tokens);
  try {
    return parser.parseProgram();
  } catch (err: any) {
    return {
      lines: [{
        statements: [{
          command: { type: 'error', message: err.message, input }
        }]
      }]
    };
  }
}
