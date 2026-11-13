import type { RichTextMark, RichTextNode } from '../richText/RichText';
import { isExpr, type PmlExpr } from './expressions';
import { isRunNode } from './nodeTree';
import type { PmlNode } from './primitives';

/**
 * A paragraph's words <-> the visual editor's one-paragraph document (PML v3 L6). A paragraph holds runs
 * and inline elements; the editor holds text with marks. The ones that map both ways:
 *
 *   word run -> text            strong -> bold          emphasis -> italic
 *   link href -> link mark      code -> code mark       br -> hard break
 *   {...} run -> a page-data chip (the `pmlExpr` atom), its expression kept whole
 *
 * Anything else (mark, small, a run with its own look or condition...) has no mark in the editor, so
 * `paragraphToDoc` returns null and the panel sends that paragraph to the Code view, untouched.
 */

/** The editor's atom for a `{...}` run: its expression kept whole, shown as a chip. */
export const EXPR_NODE = 'pmlExpr';

type MarkName = 'link' | 'bold' | 'italic';

/** Outermost first, so the same document always writes the same nesting. */
const MARK_ORDER: MarkName[] = ['link', 'bold', 'italic'];

const ELEMENT_FOR: Record<MarkName, string> = { link: 'link', bold: 'strong', italic: 'emphasis' };

function isPlain(node: PmlNode, allowed: string[]): boolean {
  const extra = Object.keys(node).filter((k) => !['primitive', 'props', 'children', 'uid'].includes(k));
  const props = Object.keys(node.props ?? {});

  return extra.length === 0 && props.every((p) => allowed.includes(p));
}

/** The paragraph's children as the editor's document, or null when one of them has no editor form. */
export function paragraphToDoc(children: PmlNode[]): RichTextNode | null {
  const content: RichTextNode[] = [];

  const walk = (nodes: PmlNode[], marks: RichTextMark[]): boolean => {
    for (const node of nodes) {
      const props = node.props ?? {};

      if (node.primitive === 'text' && isPlain(node, ['value'])) {
        if (isExpr(props.value)) {
          content.push({ type: EXPR_NODE, attrs: { expr: props.value }, ...(marks.length ? { marks: [...marks] } : {}) });
        } else if (typeof props.value === 'string' && props.value !== '') {
          content.push({ type: 'text', text: props.value, ...(marks.length ? { marks: [...marks] } : {}) });
        } else if (typeof props.value !== 'string') {
          return false;
        }
        continue;
      }

      if (node.primitive === 'br' && isPlain(node, [])) {
        content.push({ type: 'hardBreak' });
        continue;
      }

      if (node.primitive === 'code' && isPlain(node, ['text']) && typeof props.text === 'string') {
        if (props.text !== '') content.push({ type: 'text', text: props.text, marks: [...marks, { type: 'code' }] });
        continue;
      }

      if (node.primitive === 'strong' && isPlain(node, [])) {
        if (!walk(node.children ?? [], [...marks, { type: 'bold' }])) return false;
        continue;
      }

      if (node.primitive === 'emphasis' && isPlain(node, [])) {
        if (!walk(node.children ?? [], [...marks, { type: 'italic' }])) return false;
        continue;
      }

      if (node.primitive === 'link' && isPlain(node, ['href']) && typeof props.href === 'string') {
        if (!walk(node.children ?? [], [...marks, { type: 'link', attrs: { href: props.href } }])) return false;
        continue;
      }

      return false;
    }

    return true;
  };

  if (!walk(children, [])) return null;

  return { type: 'doc', content: [{ type: 'paragraph', content }] };
}

function markKey(mark: RichTextMark): string {
  return mark.type === 'link' ? `link:${mark.attrs?.href ?? ''}` : mark.type;
}

/** The editor's document back into a paragraph's children (every paragraph of it, joined by a line break). */
export function docToParagraph(doc: RichTextNode): PmlNode[] {
  const root: PmlNode[] = [];
  // The elements open right now, outermost first, with the mark each one stands for.
  const open: { key: string; children: PmlNode[] }[] = [];
  const target = () => (open.length > 0 ? open[open.length - 1].children : root);

  const inlineNodes: RichTextNode[] = [];
  (doc.content ?? []).forEach((block, i) => {
    if (i > 0) inlineNodes.push({ type: 'hardBreak' });
    inlineNodes.push(...(block.content ?? []));
  });

  for (const node of inlineNodes) {
    const marks = node.marks ?? [];
    const wanted = MARK_ORDER.flatMap((name) => marks.filter((m) => m.type === name));
    const isCode = marks.some((m) => m.type === 'code');

    // Close what this node is not inside, keep the shared outer part open.
    let keep = 0;

    while (keep < open.length && keep < wanted.length && open[keep].key === markKey(wanted[keep])) keep++;

    open.length = keep;

    for (const mark of wanted.slice(keep)) {
      const element: PmlNode = {
        primitive: ELEMENT_FOR[mark.type as MarkName] as PmlNode['primitive'],
        ...(mark.type === 'link' ? { props: { href: String(mark.attrs?.href ?? '') } } : {}),
        children: [],
      } as PmlNode;
      target().push(element);
      open.push({ key: markKey(mark), children: element.children as PmlNode[] });
    }

    if (node.type === 'hardBreak') {
      target().push({ primitive: 'br' } as PmlNode);
    } else if (node.type === EXPR_NODE && isExpr(node.attrs?.expr)) {
      target().push({ primitive: 'text', props: { value: node.attrs?.expr as PmlExpr } } as PmlNode);
    } else if (node.type === 'text' && typeof node.text === 'string' && node.text !== '') {
      target().push(isCode ? ({ primitive: 'code', props: { text: node.text } } as PmlNode) : ({ primitive: 'text', props: { value: node.text } } as PmlNode));
    }
  }

  // Two runs side by side are one run.
  const merge = (nodes: PmlNode[]): PmlNode[] =>
    nodes.reduce<PmlNode[]>((out, node) => {
      const prev = out[out.length - 1];

      if (node.children) node.children = merge(node.children);

      if (prev && prev.primitive === 'text' && node.primitive === 'text' && typeof prev.props?.value === 'string' && typeof node.props?.value === 'string') {
        out[out.length - 1] = { primitive: 'text', props: { value: prev.props.value + node.props.value } } as PmlNode;
      } else {
        out.push(node);
      }

      return out;
    }, []);

  return merge(root);
}

/**
 * The words without their element ids, for telling a real change from the editor's own echo: the page
 * stamps an id on every inline element the editor writes (ensureUids), and that is not a change of words.
 * Comparing with the ids in reset the editor on every key, so the caret jumped to the end (2026-11-11).
 */
export function wordsKey(children: PmlNode[]): string {
  return JSON.stringify(children, (key, value) => (key === 'uid' ? undefined : value));
}

/**
 * The editor knows marks, not elements, so the words it writes carry no ids. Give each element back the
 * id its counterpart had (the first bold keeps the first bold's id, and so on), so typing a letter does not
 * renumber the paragraph's elements; one the edit created gets a new id from the page.
 */
export function keepUids(next: PmlNode[], previous: PmlNode[]): PmlNode[] {
  const ids = new Map<string, string[]>();

  const collect = (nodes: PmlNode[]): void => {
    for (const node of nodes) {
      if (node.primitive && !isRunNode(node) && typeof node.uid === 'string') {
        ids.set(node.primitive, [...(ids.get(node.primitive) ?? []), node.uid]);
      }
      if (node.children) collect(node.children);
    }
  };

  const give = (nodes: PmlNode[]): PmlNode[] =>
    nodes.map((node) => {
      const id = node.primitive && !isRunNode(node) ? ids.get(node.primitive)?.shift() : undefined;
      const children = node.children ? give(node.children) : undefined;

      return { ...node, ...(id ? { uid: id } : {}), ...(children ? { children } : {}) };
    });

  collect(previous);

  return give(next);
}
