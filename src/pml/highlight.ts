/**
 * A lexical highlighter for PML source (and the PSL inside a `<script>`).
 *
 * This is a HIGHLIGHTER, not a parser: it is deliberately lexical and resilient. It never throws,
 * and its token values ALWAYS concatenate back to the exact input - that identity is what keeps a
 * transparent-textarea overlay's caret aligned with the coloured text underneath it. Half-typed,
 * unterminated, or invalid source still tokenises (an open quote simply colours the rest as a string
 * until it is closed, the way every code editor behaves).
 *
 * The token classes mirror what actually parses on the backend so the colours never lie:
 *  - PML markup: {@see PmlScanner} - tags, attribute names, `"strings"`, `{state.x}` (reactive) vs
 *    `{consultant.x}`/`{site.x}` (publish-baked) bindings, and `import ... from "@site/..."`.
 *  - PSL inside `<script>`: {@see \App\Services\Sites\Psl\Lexer} - keywords, the reserved `state`
 *    root, numbers, double-quoted strings, `//` and slash-star comments, and the operator set
 *    (including `++` / `--`).
 */

export type PmlTokenType =
  | 'plain' // prose, whitespace, unknown chars, bare identifiers
  | 'punct' // structural punctuation: < > / = { } ( ) [ ] , ; .
  | 'tag' // an element / component name
  | 'attr' // an attribute name (including on-*, if, else-if, else, each, key)
  | 'string' // a "..." string (attribute values and PSL strings)
  | 'number' // a numeric literal
  | 'keyword' // a PSL keyword, a bare true/false, or import/from
  | 'state' // the reserved reactive `state` root
  | 'binding' // the non-state part of a brace / baked binding path
  | 'operator' // a PSL operator
  | 'comment' // a PSL // or slash-star comment
  | 'error'; // an unquoted attribute value: PML v3 takes key="value" or key={...} only

export interface PmlToken {
  type: PmlTokenType;
  value: string;
}

/** PSL reserved words. Mirrors Psl\Lexer::KEYWORDS (true/false/null included as keywords). */
const PSL_KEYWORDS = new Set([
  'const', 'let', 'function', 'if', 'else', 'for', 'in', 'while',
  'return', 'break', 'continue', 'true', 'false', 'null',
]);

/** PSL two-char operators. Mirrors Psl\Lexer::TWO_CHAR (matched before the one-char set). */
const PSL_TWO_CHAR = ['==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '++', '--'];

const isWs = (c: string): boolean => c === ' ' || c === '\t' || c === '\r' || c === '\n';
const isAlpha = (c: string): boolean => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z');
const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isIdentStart = (c: string): boolean => isAlpha(c) || c === '_';
const isIdentPart = (c: string): boolean => isIdentStart(c) || isDigit(c);
// A tag / attribute name is kebab or snake: an alpha start then [alnum-_]*.
const isNamePart = (c: string): boolean => isIdentPart(c) || c === '-';
// The characters an unquoted attribute value (an error) stops on. Mirrors PmlScanner::readBareword.
const BAREWORD_STOP = ' \t\r\n>/"{}=';

/**
 * Tokenise PML source into a flat, gap-free list of coloured spans. Concatenating every token's
 * `value` in order reproduces `source` exactly.
 */
export function tokenizePml(source: string): PmlToken[] {
  const out: PmlToken[] = [];
  const n = source.length;
  let i = 0;

  // Same-type adjacent spans are merged, so a run of prose or whitespace is one token, not many.
  const push = (type: PmlTokenType, value: string): void => {
    if (value === '') return;
    const last = out[out.length - 1];
    if (last && last.type === type) last.value += value;
    else out.push({ type, value });
  };

  const readWs = (): void => {
    const start = i;
    while (i < n && isWs(source[i])) i++;
    push('plain', source.slice(start, i));
  };

  // A tag / attribute name, coloured as `kind`. Returns the raw text (may be '' if none is present,
  // in which case the caller still guarantees progress via the surrounding punctuation).
  const readName = (kind: PmlTokenType): string => {
    const start = i;
    if (i < n && isAlpha(source[i])) {
      i++;
      while (i < n && isNamePart(source[i])) i++;
    }
    const name = source.slice(start, i);
    push(kind, name);

    return name;
  };

  // A "..." string (attribute value or PSL string). Consumes to the closing quote or EOF; an
  // unterminated string colours to EOF, the way editors do until you close it.
  const readString = (): void => {
    const start = i;
    i++; // opening quote
    while (i < n) {
      const c = source[i];
      if (c === '\\' && i + 1 < n) {
        i += 2;
        continue;
      }
      i++;
      if (c === '"') break;
    }
    push('string', source.slice(start, i));
  };

  // Split a binding path so the reactive `state` root is coloured distinctly from the rest, exactly
  // as the runtime distinguishes state (client-side) from consultant./site. (publish-baked).
  const emitPath = (path: string): void => {
    if (/^state(?![A-Za-z0-9_])/.test(path)) {
      push('state', 'state');
      push('binding', path.slice(5));
    } else {
      push('binding', path);
    }
  };

  // A `{path}` brace binding. Mirrors PmlScanner::readBinding (path is [alnum_.], with optional
  // inner whitespace).
  const readBinding = (): void => {
    push('punct', '{');
    i++;
    const ws1 = i;
    while (i < n && isWs(source[i])) i++;
    push('plain', source.slice(ws1, i));

    const pStart = i;
    while (i < n && (isIdentPart(source[i]) || source[i] === '.')) i++;
    emitPath(source.slice(pStart, i));

    const ws2 = i;
    while (i < n && isWs(source[i])) i++;
    push('plain', source.slice(ws2, i));

    if (i < n && source[i] === '}') {
      push('punct', '}');
      i++;
    }
  };

  const scanImport = (): void => {
    push('keyword', 'import');
    i += 'import'.length;
    readWs();
    readName('plain'); // the local handle is an identifier, not a tag
    readWs();
    if (source.startsWith('from', i)) {
      push('keyword', 'from');
      i += 'from'.length;
      readWs();
    }
    if (i < n && source[i] === '"') readString();
  };

  const scanCloseTag = (): void => {
    push('punct', '</');
    i += 2;
    readWs();
    readName('tag');
    readWs();
    if (i < n && source[i] === '>') {
      push('punct', '>');
      i++;
    }
  };

  const scanOpenTag = (): { name: string; selfClosed: boolean } => {
    push('punct', '<');
    i++;
    const name = readName('tag');
    let selfClosed = false;

    while (i < n) {
      readWs();
      if (i >= n) break;

      if (source.startsWith('/>', i)) {
        push('punct', '/>');
        i += 2;
        selfClosed = true;
        break;
      }
      if (source[i] === '>') {
        push('punct', '>');
        i++;
        break;
      }
      if (source[i] === '/') {
        // A stray slash inside a tag: keep it visible and make progress.
        push('punct', '/');
        i++;
        continue;
      }
      if (isAlpha(source[i])) {
        readName('attr');
        readWs();
        if (i < n && source[i] === '=') {
          push('punct', '=');
          i++;
          readWs();
          if (i < n && source[i] === '"') {
            readString();
          } else if (i < n && source[i] === '{') {
            readBinding();
          } else {
            // An unquoted value is a syntax error since PML v3 (owner 2026-11-10): colour it so the
            // person sees it before Apply, which would refuse it with "Put the value in double quotes".
            const s = i;
            while (i < n && !BAREWORD_STOP.includes(source[i])) i++;
            push('error', source.slice(s, i));
          }
        }
        continue;
      }

      // Anything else inside a tag: consume one char so the scan always terminates.
      push('plain', source[i]);
      i++;
    }

    return { name, selfClosed };
  };

  // The PSL body of a `<script>`, tokenised until the matching `</script>`. The close tag itself is
  // read by the caller (scanCloseTag), so this stops right before it.
  const readScriptBody = (): void => {
    while (i < n) {
      const c = source[i];

      if (c === '<' && source[i + 1] === '/' && /^<\/\s*script\s*>/i.test(source.slice(i))) return;

      if (isWs(c)) {
        const s = i;
        while (i < n && isWs(source[i])) i++;
        push('plain', source.slice(s, i));
        continue;
      }
      if (c === '/' && source[i + 1] === '/') {
        const s = i;
        while (i < n && source[i] !== '\n') i++;
        push('comment', source.slice(s, i));
        continue;
      }
      if (c === '/' && source[i + 1] === '*') {
        const s = i;
        i += 2;
        while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
        if (i < n) i += 2;
        push('comment', source.slice(s, i));
        continue;
      }
      if (c === '"') {
        readString();
        continue;
      }
      if (isDigit(c)) {
        const s = i;
        while (i < n && isDigit(source[i])) i++;
        if (i < n && source[i] === '.' && isDigit(source[i + 1])) {
          i++;
          while (i < n && isDigit(source[i])) i++;
        }
        push('number', source.slice(s, i));
        continue;
      }
      if (isIdentStart(c)) {
        const s = i;
        i++;
        while (i < n && isIdentPart(source[i])) i++;
        const word = source.slice(s, i);
        if (word === 'state') push('state', word);
        else if (PSL_KEYWORDS.has(word)) push('keyword', word);
        else push('plain', word);
        continue;
      }

      const two = source.slice(i, i + 2);
      if (PSL_TWO_CHAR.includes(two)) {
        push('operator', two);
        i += 2;
        continue;
      }
      if ('+-*/%=<>!?:'.includes(c)) {
        push('operator', c);
        i++;
        continue;
      }
      if ('(){}[],.;'.includes(c)) {
        push('punct', c);
        i++;
        continue;
      }

      push('plain', c);
      i++;
    }
  };

  // Leading imports (with the whitespace around them) come before any content. Mirrors
  // PmlScanner::scanImports: `import` must be a whole word (followed by whitespace).
  for (;;) {
    const wsStart = i;
    while (i < n && isWs(source[i])) i++;
    if (source.startsWith('import', i) && isWs(source[i + 'import'.length] ?? ' ')) {
      push('plain', source.slice(wsStart, i));
      scanImport();
    } else {
      i = wsStart;
      break;
    }
  }

  // Content: tags (a `<script>` switches into PSL) and the prose between them.
  while (i < n) {
    // A PML `<!-- ... -->` comment is coloured as one comment span (the same class PSL comments use)
    // so the overlay dims it and the editor can detect a comment line for the Scaffold pill. Checked
    // before tag handling because `<!--` also starts with `<` (scanOpenTag would mis-read it).
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4);
      const stop = end === -1 ? n : end + 3; // an unterminated comment colours to EOF, editor-style
      push('comment', source.slice(i, stop));
      i = stop;
      continue;
    }

    if (source[i] === '<') {
      if (source[i + 1] === '/') {
        scanCloseTag();
        continue;
      }
      const { name, selfClosed } = scanOpenTag();
      if (name === 'script' && !selfClosed) {
        readScriptBody();
        if (source.startsWith('</', i)) scanCloseTag();
      }
      // Inline code and rich text keep their bodies verbatim (PML v3 L4): a `<` in them is a character,
      // never a tag, exactly as PmlScanner reads them.
      if ((name === 'code' || name === 'rich-text' || name === 'pre') && !selfClosed) {
        const close = source.slice(i).search(new RegExp(`</\\s*${name}\\s*>`, 'i'));
        const stop = close === -1 ? n : i + close;
        push('plain', source.slice(i, stop));
        i = stop;
        if (source.startsWith('</', i)) scanCloseTag();
      }
      continue;
    }

    const s = i;
    while (i < n && source[i] !== '<') i++;
    push('plain', source.slice(s, i));
  }

  return out;
}
