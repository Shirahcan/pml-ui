import { pathExpr } from '../../src/pml/expressions';
import { docToParagraph, EXPR_NODE, keepUids, paragraphToDoc, wordsKey } from '../../src/pml/paragraphDoc';
import type { PmlNode } from '../../src/pml/primitives';

/**
 * A paragraph's words <-> the visual editor (PML v3 L6): what maps, maps both ways without loss; what has no
 * editor form keeps the paragraph out of the editor (it opens in the Code view, untouched).
 */
const run = (value: unknown): PmlNode => ({ primitive: 'text', props: { value } }) as PmlNode;
const el = (primitive: string, children: PmlNode[], props?: Record<string, unknown>): PmlNode => ({ primitive, ...(props ? { props } : {}), children }) as PmlNode;

describe('paragraphDoc', () => {
  const paragraph: PmlNode[] = [
    run('Book a call with '),
    el('strong', [run(pathExpr('owner.name'))]),
    run(', read '),
    el('link', [run('the '), el('emphasis', [run('fees')])], { href: '#fees' }),
    run(' or run '),
    { primitive: 'code', props: { text: 'a < b' } } as PmlNode,
    { primitive: 'br' } as PmlNode,
    run('today.'),
  ];

  it('turns runs, marks, page data and line breaks into the editor document', () => {
    const doc = paragraphToDoc(paragraph);
    const content = doc?.content?.[0]?.content ?? [];

    expect(content.map((n) => n.type)).toEqual(['text', EXPR_NODE, 'text', 'text', 'text', 'text', 'text', 'hardBreak', 'text']);
    expect(content[1].marks).toEqual([{ type: 'bold' }]);
    expect((content[1].attrs?.expr as { $expr: string }).$expr).toBe('owner.name');
    expect(content[4].marks).toEqual([{ type: 'link', attrs: { href: '#fees' } }, { type: 'italic' }]);
    expect(content[6].marks).toEqual([{ type: 'code' }]);
  });

  it('writes the same paragraph back', () => {
    expect(docToParagraph(paragraphToDoc(paragraph)!)).toEqual(paragraph);
  });

  it('merges side-by-side runs and nests marks in one order', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a' },
            { type: 'text', text: 'b' },
            { type: 'text', text: 'c', marks: [{ type: 'italic' as const }, { type: 'bold' as const }] },
            { type: 'text', text: 'd', marks: [{ type: 'bold' as const }] },
          ],
        },
      ],
    };

    expect(docToParagraph(doc)).toEqual([run('ab'), el('strong', [el('emphasis', [run('c')]), run('d')])]);
  });

  it('keeps out a paragraph with something the editor cannot hold', () => {
    expect(paragraphToDoc([run('A '), el('mark', [run('highlight')])])).toBeNull();
    expect(paragraphToDoc([{ primitive: 'text', props: { value: 'styled' }, style: { text_color: 'accent' } } as PmlNode])).toBeNull();
  });

  // 2026-11-11: the page stamps ids on the inline elements the editor writes; comparing with them in reset
  // the editor on every key (the caret jumped to the end), and each key renumbered the elements.
  it('reads its own words back as unchanged when the page has only added ids', () => {
    const written = docToParagraph(paragraphToDoc(paragraph)!);
    const stamped = written.map((node) => (node.primitive === 'text' ? node : { ...node, uid: 'abcd1234' }));

    expect(wordsKey(stamped)).toBe(wordsKey(written));
    expect(wordsKey([run('Book a call')])).not.toBe(wordsKey([run('Book a call.')]));
  });

  it('gives each element back the id it had before the edit, and none to a new one', () => {
    const before: PmlNode[] = [run('Hi '), { ...el('strong', [run('there')]), uid: 'strong01' }, run(' and '), { ...el('emphasis', [run('you')]), uid: 'emph0001' }];
    const typed = docToParagraph(
      paragraphToDoc([run('Hi '), el('strong', [run('there!')]), run(' and '), el('emphasis', [run('you')]), run(' '), el('strong', [run('new')])])!,
    );

    const kept = keepUids(typed, before);

    expect(kept.map((n) => n.uid)).toEqual([undefined, 'strong01', undefined, 'emph0001', undefined, undefined]);
    expect(kept[1].children).toEqual([run('there!')]);
  });
});
