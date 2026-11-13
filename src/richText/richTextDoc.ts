import type { RichTextNode } from './RichText';
import { PML_ENUMS } from '../pml/elements.generated';

/**
 * The bridge between Tiptap and the server's constrained AST.
 *
 * These lists MIRROR `BlockSchema::ALLOWED_NODES` / `ALLOWED_MARKS` / `ALLOWED_ATTRS` on
 * the backend. That duplication is deliberate and it is not a source-of-truth problem: the
 * server is the source of truth and rejects anything it does not recognise. This file
 * exists so the editor cannot PRODUCE something the server would reject, which would
 * otherwise show up as a mystifying 422 the consultant cannot act on.
 *
 * The concrete trap it closes: Tiptap's Link mark emits `rel` and `class` attributes by
 * default, and `ALLOWED_ATTRS['link']` is `['href', 'target']`. Without normalisation,
 * typing a single hyperlink into your About page makes it unsavable.
 */

const ALLOWED_NODES = new Set([
  'doc',
  'paragraph',
  'heading',
  'text',
  'hardBreak',
  'bulletList',
  'orderedList',
  'listItem',
  'blockquote',
  // PML v2 S1-05: a code block (plain text, a language label at most).
  'codeBlock',
]);

const ALLOWED_MARKS = new Set(['bold', 'italic', 'underline', 'link', 'code']);

const ALLOWED_ATTRS: Record<string, string[]> = {
  heading: ['level'],
  link: ['href', 'target'],
  orderedList: ['start'],
  codeBlock: ['language'],
};

/**
 * The labels a code block may carry; anything else is dropped. The ONE list, `code_language` in
 * backend/resources/pml/elements.json (shared with PML's `pre` and the server's Markdown fences).
 */
export const CODE_LANGUAGES: readonly string[] = PML_ENUMS.code_language;

/** Same rule as the server and the renderer: http(s), or an internal path. */
export function isSafeUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  const url = value.trim();
  if (url === '') return false;
  if (url.startsWith('//')) return false;
  if (url.startsWith('/')) return true;

  return /^https?:\/\//i.test(url);
}

function pickAttrs(type: string, attrs: unknown): Record<string, unknown> | undefined {
  if (!attrs || typeof attrs !== 'object') return undefined;

  const allowed = ALLOWED_ATTRS[type] ?? [];
  const out: Record<string, unknown> = {};

  for (const key of allowed) {
    const value = (attrs as Record<string, unknown>)[key];

    // Tiptap writes explicit nulls for unset attrs. A null `start` is not an attribute,
    // it is noise, and the server would have to reason about it.
    if (value === null || value === undefined) continue;

    out[key] = value;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Normalise a Tiptap document into something the server will accept.
 *
 * Unknown nodes are DROPPED here (the editor should never make one, so a drop is the
 * honest outcome), while the server REJECTS them (a stored document arriving from anywhere
 * else is a security event, not a formatting quirk). The asymmetry is intentional.
 */
export function toSafeDoc(input: unknown): RichTextNode {
  const node = normaliseNode(input);

  if (!node || node.type !== 'doc') {
    return { type: 'doc', content: [{ type: 'paragraph', content: [] }] };
  }

  return node;
}

function normaliseNode(input: unknown): RichTextNode | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Record<string, unknown>;
  const type = typeof raw.type === 'string' ? raw.type : '';

  if (!ALLOWED_NODES.has(type)) return null;

  const node: RichTextNode = { type };

  if (type === 'text') {
    node.text = typeof raw.text === 'string' ? raw.text : '';
  }

  const attrs = pickAttrs(type, raw.attrs);
  // The editor names a language however it was typed (```js); only a listed one survives, so the
  // server never refuses a code block over its label.
  if (attrs && type === 'codeBlock' && !CODE_LANGUAGES.includes(String(attrs.language))) delete attrs.language;
  if (attrs && Object.keys(attrs).length > 0) node.attrs = attrs;

  if (Array.isArray(raw.marks)) {
    const marks = raw.marks
      .map(normaliseMark)
      .filter((mark): mark is Mark => mark !== null);

    if (marks.length > 0) node.marks = marks;
  }

  if (Array.isArray(raw.content)) {
    const content = raw.content
      .map(normaliseNode)
      .filter((child): child is RichTextNode => child !== null);

    if (content.length > 0) node.content = content;
  }

  return node;
}

type Mark = NonNullable<RichTextNode['marks']>[number];

function normaliseMark(input: unknown): Mark | null {
  if (!input || typeof input !== 'object') return null;

  const raw = input as Record<string, unknown>;
  const type = typeof raw.type === 'string' ? raw.type : '';

  if (!ALLOWED_MARKS.has(type)) return null;

  const mark = { type } as Mark;

  if (type === 'link') {
    const attrs = pickAttrs('link', raw.attrs);
    const href = attrs?.href;

    // A link we cannot vouch for is not a link. Dropping the MARK (not the text) keeps
    // the consultant's words and loses only the unsafe href.
    if (!isSafeUrl(href)) return null;

    mark.attrs = { href: String(href).trim(), target: '_blank' };
  }

  return mark;
}

/** True when the document has no text in it. Used to decide whether a block is empty. */
export function isEmptyDoc(doc: RichTextNode | null | undefined): boolean {
  if (!doc) return true;

  let hasText = false;

  const walk = (node: RichTextNode): void => {
    if (hasText) return;

    if (node.type === 'text' && (node.text ?? '').trim() !== '') {
      hasText = true;

      return;
    }

    (node.content ?? []).forEach(walk);
  };

  walk(doc);

  return !hasText;
}
