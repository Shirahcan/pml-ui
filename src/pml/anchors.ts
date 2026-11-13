import type { RichTextNode } from '../richText/RichText';

import type { PmlNode } from './primitives';

/**
 * Linkable anchors (PML v2 S1-02). An author may set `anchor=` on a heading or a container; it
 * becomes the element's `id`. A heading WITHOUT one gets an anchor derived from its text, so a link
 * like `#documents-you-need` and the table of contents work on every page without extra authoring.
 * Headings written as Markdown inside prose (`## Fees`) get one too (S1-06): long-form pages are
 * mostly prose, and a table of contents that skipped them would be empty.
 *
 * Explicit anchors are reserved first (the compiler guarantees they are unique), then derived ones
 * are de-duplicated around them in document order: "Fees", "Fees" -> `fees`, `fees-2`.
 */

/** The same shape the server accepts (PrimitiveSchema::ANCHOR): a render-side guard, never trusted input. */
const ANCHOR = /^[a-z][a-z0-9-]{0,63}$/;

/** A string that is safe to use as an element id, or undefined. */
export function anchorId(value: unknown): string | undefined {
  return typeof value === 'string' && ANCHOR.test(value) ? value : undefined;
}

/** "Documents you'll need (2026)" -> "documents-you-ll-need-2026". Always a valid anchor. */
export function slugify(text: string): string {
  const base = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56)
    .replace(/-+$/g, '');

  if (base === '') return 'section';

  return /^[a-z]/.test(base) ? base : `s-${base}`;
}

/** The plain text of a rich-text node (a heading's words). */
function docText(node: RichTextNode): string {
  if (node.type === 'text') return node.text ?? '';

  return (node.content ?? []).map(docText).join('');
}

/**
 * The page's nodes with a derived `anchor` on every heading that has text and no anchor of its own,
 * including Markdown headings inside prose (as a render-only `attrs.anchor`). Pure: returns new
 * nodes, never mutates the input (a cached snapshot is shared across requests).
 */
export function withDerivedAnchors(nodes: PmlNode[]): PmlNode[] {
  const used = new Set<string>();

  const reserve = (list: PmlNode[]): void => {
    for (const node of list) {
      const explicit = anchorId(node.props?.anchor);
      if (explicit) used.add(explicit);
      if (node.children) reserve(node.children);
    }
  };

  const unique = (base: string): string => {
    let candidate = base;

    for (let i = 2; used.has(candidate); i += 1) {
      candidate = `${base}-${i}`;
    }

    used.add(candidate);

    return candidate;
  };

  const deriveDoc = (doc: RichTextNode): RichTextNode => {
    if (doc.type === 'heading') {
      const text = docText(doc).trim();

      return text === '' ? doc : { ...doc, attrs: { ...doc.attrs, anchor: unique(slugify(text)) } };
    }

    return doc.content ? { ...doc, content: doc.content.map(deriveDoc) } : doc;
  };

  const derive = (list: PmlNode[]): PmlNode[] =>
    list.map((node) => {
      let next = node;
      const text = node.props?.text;

      if (node.primitive === 'heading' && !anchorId(node.props?.anchor) && typeof text === 'string' && text.trim() !== '') {
        next = { ...node, props: { ...node.props, anchor: unique(slugify(text)) } };
      }

      const doc = node.props?.doc;
      if (node.primitive === 'rich_text' && doc && typeof doc === 'object') {
        next = { ...next, props: { ...next.props, doc: deriveDoc(doc as RichTextNode) } };
      }

      return node.children ? { ...next, children: derive(node.children) } : next;
    });

  reserve(nodes);

  return derive(nodes);
}

export interface OutlineEntry {
  level: number;
  text: string;
  anchor: string;
}

/**
 * The page's headings in document order (S1-06), from nodes that already went through
 * {@link withDerivedAnchors}: heading primitives and Markdown headings inside prose.
 */
export function pageOutline(nodes: PmlNode[]): OutlineEntry[] {
  const out: OutlineEntry[] = [];

  const walkDoc = (doc: RichTextNode): void => {
    if (doc.type === 'heading') {
      const anchor = anchorId(doc.attrs?.anchor);
      const text = docText(doc).trim();

      if (anchor && text) out.push({ level: Number(doc.attrs?.level ?? 2), text, anchor });

      return;
    }

    (doc.content ?? []).forEach(walkDoc);
  };

  const walk = (list: PmlNode[]): void => {
    for (const node of list) {
      const anchor = anchorId(node.props?.anchor);
      const text = node.props?.text;

      if (node.primitive === 'heading' && anchor && typeof text === 'string' && text.trim() !== '') {
        out.push({ level: Number(node.props?.level ?? 2), text: text.trim(), anchor });
      }

      const doc = node.props?.doc;
      if (node.primitive === 'rich_text' && doc && typeof doc === 'object') walkDoc(doc as RichTextNode);

      if (node.children) walk(node.children);
    }
  };

  walk(nodes);

  return out;
}
