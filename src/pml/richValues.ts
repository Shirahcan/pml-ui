import type { RichTextMark, RichTextNode } from '../richText/RichText';
import { markdownToDoc } from '../richText/markdownDoc';

/**
 * A rich-text value drawn by its DECLARED kind (component props p10, 2026-11-11; owner: "pull context from the
 * containing element on what types/kinds of data to look for").
 *
 * The server tags a `{...}` that reads a rich-text setting or field (`{item.answer}` inside
 * `each={item in props.faq}`) with `kind: "rich_text"`, because only it knows the component's declarations. A
 * tagged value is Markdown and is formatted wherever it sits; anything untagged (page data, `state`) stays words.
 * A value is only ever Markdown here: `markdownToDoc` reads a `{...}` in it as text, so a value never runs.
 */

export const RICH_KIND = 'rich_text';

/** Whether a stored value or an atom's attrs say "this is rich text". */
export function isRichKind(value: unknown): boolean {
  return !!value && typeof value === 'object' && (value as { kind?: unknown }).kind === RICH_KIND;
}

/** A rich-text value's words without its markup, for a heading, a plain text or a label. */
export function plainWords(markdown: string): string {
  const out: string[] = [];
  const walk = (node: RichTextNode): void => {
    if (node.type === 'text') out.push(node.text ?? '');
    else if (node.type === 'hardBreak') out.push(' ');
    else {
      node.content?.forEach(walk);
      if (node.type !== 'doc') out.push(' ');
    }
  };

  walk(markdownToDoc(markdown));

  return out.join('').replace(/\s+/g, ' ').trim();
}

/** A sentence's own marks laid under the value's (a bold sentence stays bold around a link). */
function withMarks(node: RichTextNode, outer: RichTextMark[] | undefined): RichTextNode {
  if (!outer?.length || node.type !== 'text') return node;

  const own = node.marks ?? [];

  return { ...node, marks: [...own, ...outer.filter((mark) => !own.some((m) => m.type === mark.type))] };
}

/** A value's runs for the inside of a sentence: its bold, italic and links, blocks joined by a line break. */
function inlineRuns(markdown: string, outer: RichTextMark[] | undefined): RichTextNode[] {
  const out: RichTextNode[] = [];
  const walk = (node: RichTextNode): void => {
    for (const child of node.content ?? []) {
      if (child.type === 'text' || child.type === 'hardBreak') {
        out.push(withMarks(child, outer));
        continue;
      }

      if (out.length > 0 && ['paragraph', 'heading', 'codeBlock'].includes(child.type)) out.push({ type: 'hardBreak' });
      walk(child);
    }
  };

  walk(markdownToDoc(markdown));

  return out;
}

/**
 * The document with each tagged `{...}` drawn as the Markdown it reads: alone on its line, the value's blocks
 * (its paragraphs and lists); inside a sentence, its runs. `read` evaluates an atom's tree on the page; a value
 * that is not words leaves the atom as it was, so the usual reading draws it.
 */
export function expandRichAtoms(doc: RichTextNode | null | undefined, read: (attrs: Record<string, unknown>) => unknown): RichTextNode | null | undefined {
  if (!doc?.content) return doc;

  const text = (atom: RichTextNode): string | null => {
    const value = read(atom.attrs ?? {});

    return typeof value === 'string' ? value : null;
  };

  const walk = (node: RichTextNode): RichTextNode => {
    if (!node.content || node.type === 'codeBlock') return node;

    const content: RichTextNode[] = [];

    for (const child of node.content) {
      const lone = child.type === 'paragraph' && child.content?.length === 1 && child.content[0].type === 'expr' && isRichKind(child.content[0].attrs) && !child.content[0].marks?.length;
      const loneText = lone ? text(child.content![0]) : null;

      if (loneText !== null) {
        content.push(...(markdownToDoc(loneText).content ?? []));
        continue;
      }

      if (child.type === 'expr' && isRichKind(child.attrs)) {
        const value = text(child);

        content.push(...(value === null ? [child] : inlineRuns(value, child.marks)));
        continue;
      }

      content.push(walk(child));
    }

    return { ...node, content };
  };

  return walk(doc);
}
