import React from 'react';
import { render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlExpr } from '../../src/pml/expressions';
import type { PmlNode } from '../../src/pml/primitives';
import type { Node } from '../../src/psl';

/**
 * PML v3 L4 through the real renderer: a paragraph draws its word runs and inline elements as phrasing
 * content (no <div> inside the <p>, even in the builder), and rich text draws the document the server
 * compiled from its Markdown with each `{...}` atom read in the page scope.
 */
const site = { theme: {} } as unknown as PublicSite;
const at = { line: 1, col: 1 };
const read = (dotted: string): PmlExpr => {
  const [first, ...rest] = dotted.split('.');
  const ast = rest.reduce<Node>((object, name) => ({ ...at, type: 'Member', object, name }) as Node, { ...at, type: 'Identifier', name: first } as Node);

  return { $expr: dotted, ast };
};
const natives = { owner: { kind: 'consultant', name: 'Jane Doe', registered_name: 'Jane Doe' }, site: { username: 'jane-doe', pages: [] }, page: null };
const run = (value: unknown): PmlNode => ({ primitive: 'text', props: { value } });

const paragraph: PmlNode = {
  primitive: 'p',
  children: [
    run('Book a call with '),
    { primitive: 'strong', children: [run(read('owner.name'))] },
    run(', '),
    { primitive: 'link', props: { href: '#fees' }, children: [run('see the fees')] },
    run(' or press '),
    { primitive: 'keyboard', children: [run('Ctrl')] },
    { primitive: 'br' },
    { primitive: 'code', props: { text: 'a < b' } },
  ],
};

describe('PmlRenderer words (PML v3 L4)', () => {
  it('draws a paragraph of runs and inline elements with their real tags', () => {
    const { container } = render(<PmlRenderer nodes={[paragraph]} site={site} natives={natives} />);
    const p = container.querySelector('p') as HTMLElement;

    expect(p.textContent).toBe('Book a call with Jane Doe, see the fees or press Ctrla < b');
    expect(p.querySelector('strong')?.textContent).toBe('Jane Doe');
    expect(p.querySelector('a')?.getAttribute('href')).toBe('#fees');
    expect(p.querySelector('kbd')?.textContent).toBe('Ctrl');
    expect(p.querySelector('br')).not.toBeNull();
    expect(p.querySelector('code')?.textContent).toBe('a < b');
    expect(p.querySelector('div')).toBeNull();
  });

  it('keeps a paragraph free of <div>s in the builder, where every child is marked', () => {
    const { container } = render(<PmlRenderer nodes={[paragraph]} site={site} natives={natives} builderHints pathRoot={[0]} />);
    const p = container.querySelector('p') as HTMLElement;

    expect(p.querySelector('div')).toBeNull();
    expect(p.querySelectorAll('span[data-pml-path]').length).toBeGreaterThan(0);
  });

  it('draws rich text with each {...} atom read in the page scope, keeping its marks', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Made by ' },
            { type: 'expr', attrs: { expr: 'owner.name', ast: read('owner.name').ast }, marks: [{ type: 'bold' }] },
            { type: 'text', text: '.' },
          ],
        },
      ],
    };
    const { container } = render(<PmlRenderer nodes={[{ primitive: 'rich_text', props: { markdown: 'Made by **{owner.name}**.', doc } }]} site={site} natives={natives} />);

    expect(container.textContent).toContain('Made by Jane Doe.');
    expect(container.querySelector('strong')?.textContent).toBe('Jane Doe');
  });
});
