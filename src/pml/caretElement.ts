/**
 * Which element of PML source the caret sits in, by its permanent id (`uid`), so the Studio's Code view
 * can select it and the options panel shows its settings, exactly as a click on the canvas does
 * (owner 2026-11-09: the Code view keeps the Studio's options panel).
 *
 * A small scanner, not a parser: it walks tags up to the caret with a stack, honours quoted values and
 * `{ ... }` expressions (either may hold a `>`), skips comments and a `<script>` body (PSL compares with
 * `<`), and answers the nearest enclosing element that has an id. Malformed source answers what it can.
 */

interface Open {
  name: string;
  uid: string | null;
}

// Quoted (how the serialiser writes every value since PML v3) or bare (typed by hand; Apply refuses it, but
// the caret still finds its element while the person is fixing it).
const UID = /\buid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'/>]+))/;

/** The end of a tag that starts at `from` (the index of its `<`), past quotes and braces; -1 if unclosed. */
function tagEnd(source: string, from: number): number {
  let quote: string | null = null;
  let braces = 0;

  for (let i = from + 1; i < source.length; i++) {
    const c = source[i];

    if (quote !== null) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '{') {
      braces++;
    } else if (c === '}') {
      braces = Math.max(0, braces - 1);
    } else if (c === '>' && braces === 0) {
      return i;
    }
  }

  return -1;
}

function nearest(stack: Open[]): string | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].uid) return stack[i].uid;
  }

  return null;
}

export function elementAtCaret(source: string, caret: number): string | null {
  const stack: Open[] = [];
  let i = 0;

  while (i < source.length && i < caret) {
    if (source[i] !== '<') {
      i++;
      continue;
    }

    if (source.startsWith('<!--', i)) {
      const close = source.indexOf('-->', i + 4);

      if (close === -1 || close + 3 > caret) return nearest(stack);
      i = close + 3;
      continue;
    }

    const end = tagEnd(source, i);

    if (end === -1) return nearest(stack);

    const tag = source.slice(i, end + 1);
    const closing = tag.startsWith('</');
    const name = (/^<\/?\s*([A-Za-z][\w-]*)/.exec(tag)?.[1] ?? '').toLowerCase();

    if (name === '') {
      i = end + 1;
      continue;
    }

    if (closing) {
      // The caret inside a closing tag belongs to the element it closes.
      if (caret <= end) return nearest(stack);
      const at = stack.map((open) => open.name).lastIndexOf(name);

      if (at !== -1) stack.length = at;
      i = end + 1;
      continue;
    }

    const match = UID.exec(tag);
    const open: Open = { name, uid: match ? (match[1] ?? match[2] ?? match[3] ?? null) : null };
    const selfClosing = /\/\s*>$/.test(tag);

    if (caret <= end) return open.uid ?? nearest(stack);

    if (!selfClosing) {
      if (name === 'script') {
        // A script body is code, not tags: jump to its end.
        const close = source.toLowerCase().indexOf('</script', end + 1);

        if (close === -1 || close > caret) return open.uid ?? nearest(stack);
        i = close;
        continue;
      }

      stack.push(open);
    }

    i = end + 1;
  }

  return nearest(stack);
}

/** Where an element's tag starts in the source (1-based line and column), or null when it is not there. */
export function lineOfElement(source: string, uid: string): { line: number; col: number } | null {
  const escaped = uid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp(`\\buid\\s*=\\s*(?:"${escaped}"|'${escaped}'|${escaped}(?=[\\s/>]))`).exec(source);

  if (!found) return null;

  const tagStart = source.lastIndexOf('<', found.index);
  const before = source.slice(0, tagStart === -1 ? found.index : tagStart);
  const lines = before.split('\n');

  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}
