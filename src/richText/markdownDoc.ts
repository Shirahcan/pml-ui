import type { RichTextNode } from './RichText';
import { PML_ENUMS } from '../pml/elements.generated';

/**
 * Rich text's Markdown <-> the editor's document (PML v3 L6). Rich text stores the Markdown the author
 * wrote (owner decision 4A); the visual editor works on a document, so the panel converts both ways.
 *
 * `markdownToDoc` is a line-for-line port of the server's MarkdownToDoc (the ONE parser that decides how
 * the page draws), and `docToMarkdown` of its DocToMarkdown. A shared fixture
 * (backend/tests/fixtures/pml/markdown_doc_parity.json) is run through BOTH sides by a PHP test and a jest
 * test, so the two cannot drift: what the editor shows is what the page draws.
 *
 * The subset is the server's: headings 1-4, paragraphs, bullet / numbered lists, a one-paragraph quote, a
 * fenced code block, and the marks bold / italic / link / code. A `{...}` is just text here; the server
 * compiles it when the page is drawn.
 */

const FENCE = /^```\s*([A-Za-z0-9_+-]*)\s*$/;
const HEADING = /^(#{1,4})\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const ORDERED = /^\d+\.\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;

/** PHP's trim() set (space, tab, newlines, NUL, vertical tab), so both sides cut the same characters. */
function trim(s: string): string {
  return s.replace(/^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '');
}

function leadingWidth(line: string): number {
  return line.length - line.replace(/^[ \t]+/, '').length;
}

export function markdownToDoc(markdown: string): RichTextNode {
  const lines = markdown.split(/\r\n|\r|\n/);
  const n = lines.length;
  const content: RichTextNode[] = [];
  let para: string[] = [];
  let i = 0;

  const flushPara = () => {
    const text = trim(para.join(' '));

    if (text !== '') content.push({ type: 'paragraph', content: inline(text) });

    para = [];
  };

  while (i < n) {
    const line = lines[i];
    const t = trim(line);
    const fence = FENCE.exec(t);

    if (fence) {
      flushPara();
      const indent = line.length - line.replace(/^[ \t\n\r\0\x0B]+/, '').length;
      const [block, next] = readFence(lines, i + 1, fence[1].toLowerCase(), indent);
      content.push(block);
      i = next;
      continue;
    }

    if (t === '') {
      flushPara();
      i++;
      continue;
    }

    const heading = HEADING.exec(t);

    if (heading) {
      flushPara();
      content.push({ type: 'heading', attrs: { level: heading[1].length }, content: inline(trim(heading[2])) });
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(t)) {
      flushPara();
      const [list, next] = readList(lines, i, 'bullet');
      content.push(list);
      i = next;
      continue;
    }

    if (/^\d+\.\s+/.test(t)) {
      flushPara();
      const [list, next] = readList(lines, i, 'ordered');
      content.push(list);
      i = next;
      continue;
    }

    if (QUOTE.test(t)) {
      flushPara();
      const quoted: string[] = [];

      while (i < n) {
        const m = QUOTE.exec(trim(lines[i]));

        if (!m) break;

        quoted.push(m[1]);
        i++;
      }

      content.push({ type: 'blockquote', content: [{ type: 'paragraph', content: inline(trim(quoted.join(' '))) }] });
      continue;
    }

    para.push(t);
    i++;
  }

  flushPara();

  if (content.length === 0) content.push({ type: 'paragraph', content: [] });

  return { type: 'doc', content };
}

function readList(lines: string[], start: number, kind: 'bullet' | 'ordered'): [RichTextNode, number] {
  const pattern = kind === 'bullet' ? BULLET : ORDERED;
  const items: RichTextNode[] = [];
  let i = start;

  while (i < lines.length) {
    const t = trim(lines[i]);
    const m = t === '' ? null : pattern.exec(t);

    if (!m) break;

    items.push({ type: 'listItem', content: [{ type: 'paragraph', content: inline(trim(m[1])) }] });
    i++;
  }

  return [{ type: kind === 'bullet' ? 'bulletList' : 'orderedList', content: items }, i];
}

function readFence(lines: string[], start: number, language: string, indent: number): [RichTextNode, number] {
  const body: string[] = [];
  let i = start;

  while (i < lines.length && trim(lines[i]) !== '```') {
    const line = lines[i];
    body.push(line.slice(Math.min(indent, leadingWidth(line))));
    i++;
  }

  const text = body.join('\n');
  const known = (PML_ENUMS.code_language as readonly string[]).includes(language) ? language : null;

  return [{ type: 'codeBlock', attrs: { language: known }, content: text === '' ? [] : [{ type: 'text', text }] }, Math.min(lines.length, i + 1)];
}

/** The server's inline rules, byte for byte: `code`, [label](href), **bold**, *italic* / _italic_. */
function inline(text: string): RichTextNode[] {
  const nodes: RichTextNode[] = [];
  const len = text.length;
  let buf = '';
  let i = 0;

  const flush = () => {
    if (buf !== '') {
      nodes.push({ type: 'text', text: buf });
      buf = '';
    }
  };

  while (i < len) {
    if (text[i] === '`') {
      const close = text.indexOf('`', i + 1);

      if (close !== -1 && close > i + 1) {
        flush();
        nodes.push({ type: 'text', text: text.slice(i + 1, close), marks: [{ type: 'code' }] });
        i = close + 1;
        continue;
      }
    }

    if (text[i] === '[') {
      const rb = text.indexOf(']', i + 1);

      if (rb !== -1 && rb + 1 < len && text[rb + 1] === '(') {
        const rp = text.indexOf(')', rb + 2);

        if (rp !== -1) {
          flush();
          const label = text.slice(i + 1, rb);
          const href = text.slice(rb + 2, rp);
          nodes.push({ type: 'text', text: label !== '' ? label : href, marks: [{ type: 'link', attrs: { href } }] });
          i = rp + 1;
          continue;
        }
      }
    }

    if (text.slice(i, i + 2) === '**') {
      const close = text.indexOf('**', i + 2);

      if (close !== -1) {
        flush();
        nodes.push({ type: 'text', text: text.slice(i + 2, close), marks: [{ type: 'bold' }] });
        i = close + 2;
        continue;
      }
    }

    if (text[i] === '*' || text[i] === '_') {
      const close = text.indexOf(text[i], i + 1);

      if (close !== -1 && close > i + 1) {
        flush();
        nodes.push({ type: 'text', text: text.slice(i + 1, close), marks: [{ type: 'italic' }] });
        i = close + 1;
        continue;
      }
    }

    buf += text[i];
    i++;
  }

  flush();

  if (nodes.length === 0) nodes.push({ type: 'text', text: '' });

  return nodes;
}

/** The editor's document as the Markdown the server reads back to the same document. */
export function docToMarkdown(doc: RichTextNode): string {
  // An empty paragraph (the editor keeps one after a list, to type into) is no Markdown at all.
  return (doc.content ?? [])
    .map(block)
    .filter((b): b is string => b !== null && b !== '')
    .join('\n\n');
}

function block(node: RichTextNode): string | null {
  switch (node.type) {
    case 'heading': {
      const level = Math.max(1, Math.min(4, Number(node.attrs?.level ?? 1)));

      return `${'#'.repeat(level)} ${inlineMarkdown(node.content ?? [])}`;
    }

    case 'paragraph':
      return inlineMarkdown(node.content ?? []);

    case 'bulletList':
      return (node.content ?? []).map((item) => `- ${inlineMarkdown(item.content?.[0]?.content ?? [])}`).join('\n');

    case 'orderedList':
      return (node.content ?? []).map((item, i) => `${i + 1}. ${inlineMarkdown(item.content?.[0]?.content ?? [])}`).join('\n');

    case 'blockquote':
      return `> ${inlineMarkdown(node.content?.[0]?.content ?? [])}`;

    case 'codeBlock': {
      const language = typeof node.attrs?.language === 'string' ? node.attrs.language : '';
      const code = (node.content ?? []).map((t) => t.text ?? '').join('');

      return '```' + language + '\n' + code + '\n```';
    }

    default:
      return null;
  }
}

function inlineMarkdown(nodes: RichTextNode[]): string {
  return nodes
    .map((node) => {
      // A line break inside a paragraph is a space to Markdown here (the server joins a paragraph's lines).
      if (node.type === 'hardBreak') return ' ';

      const text = node.text ?? '';
      const marks = (node.marks ?? []).map((m) => m.type);
      const link = (node.marks ?? []).find((m) => m.type === 'link');

      if (link) return `[${text}](${link.attrs?.href ?? ''})`;
      if (marks.includes('code')) return '`' + text + '`';
      if (marks.includes('bold')) return `**${text}**`;
      if (marks.includes('italic')) return `*${text}*`;

      return text;
    })
    .join('');
}
