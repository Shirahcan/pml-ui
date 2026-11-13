import type { RichTextNode } from '../../src/richText/RichText';

import { expandRichAtoms, plainWords } from '../../src/pml/richValues';

/**
 * Rich text by its declared kind (component props p10). Owner, 2026-11-11: formatting only a body that is ONE
 * `{...}` is too restrictive; the containing element knows what kind of data it reads.
 */
const atom = (expr: string, kind?: string): RichTextNode => ({ type: 'expr', attrs: { expr, ast: { type: 'Identifier', name: expr }, ...(kind ? { kind } : {}) } });
const para = (...content: RichTextNode[]): RichTextNode => ({ type: 'paragraph', content });
const doc = (...content: RichTextNode[]): RichTextNode => ({ type: 'doc', content });

const values: Record<string, unknown> = {
  answer: 'Pick **one** plan. See [fees](/fees).',
  steps: 'First:\n\n- book\n- {pay}',
  bio: 'Plain **page** data',
  count: 3,
};
const read = (attrs: Record<string, unknown>) => values[String(attrs.expr)];

describe('expandRichAtoms', () => {
  it('draws a lone rich-text value as its blocks', () => {
    const out = expandRichAtoms(doc(para(atom('steps', 'rich_text'))), read)!;

    expect(out.content!.map((n) => n.type)).toEqual(['paragraph', 'bulletList']);
    // A value is only Markdown: its braces stay words.
    expect(JSON.stringify(out)).toContain('{pay}');
    expect(JSON.stringify(out)).not.toContain('"type":"expr"');
  });

  it('formats a rich-text value inside a sentence, keeping the sentence around it', () => {
    const out = expandRichAtoms(doc(para({ type: 'text', text: 'Answer: ' }, atom('answer', 'rich_text'))), read)!;
    const runs = out.content![0].content!;

    expect(runs[0].text).toBe('Answer: ');
    expect(runs.find((r) => r.marks?.some((m) => m.type === 'bold'))?.text).toBe('one');
    expect(runs.find((r) => r.marks?.some((m) => m.type === 'link'))?.marks?.find((m) => m.type === 'link')?.attrs?.href).toBe('/fees');
  });

  it('leaves an untagged value (page data) and a value that is not words to the usual reading', () => {
    const out = expandRichAtoms(doc(para(atom('bio')), para(atom('count', 'rich_text'))), read)!;

    expect(out.content![0].content![0].type).toBe('expr');
    expect(out.content![1].content![0].type).toBe('expr');
  });
});

describe('plainWords', () => {
  it('reads a rich-text value as its words, for a heading or a label', () => {
    expect(plainWords(String(values.answer))).toBe('Pick one plan. See fees.');
  });
});
