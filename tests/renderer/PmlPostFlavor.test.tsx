import React from 'react';
import { render } from '@testing-library/react';

import type { PmlNode } from '../../src/pml/primitives';
import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';

const site: PublicSite = {};
const text = (value: string) => ({ primitive: 'text', props: { value } });

const answer = { primitive: 'callout', props: { title: 'Short answer' }, children: [{ primitive: 'p', children: [text('Most people with a job offer can apply.')] }] } as unknown as PmlNode;
const table = {
  primitive: 'table',
  props: { caption: 'Fees as of November 2026' },
  children: [
    { primitive: 'row', children: [{ primitive: 'cell', props: { header: true }, children: [text('Fee')] }, { primitive: 'cell', props: { header: true }, children: [text('Amount')] }] },
    { primitive: 'row', children: [{ primitive: 'cell', children: [text('Work permit')] }, { primitive: 'cell', children: [] }] },
  ],
} as unknown as PmlNode;
const faq = {
  primitive: 'faq',
  props: { heading: 'Frequently asked questions' },
  children: [{ primitive: 'faq_item', props: { question: 'Can I work while I wait?' }, children: [{ primitive: 'p', children: [text('Often, yes.')] }] }],
} as unknown as PmlNode;
const question = { primitive: 'heading', props: { text: 'Who can apply?', level: 2 } } as unknown as PmlNode;

/** Owner 2026-11-17: the post reads like the reference studio, and only a post: these primitives are shared by every site. */
describe('the blog reading look (flavor="post")', () => {
  it('draws a no-tone callout as the short answer: an indigo rule and a small uppercase key', () => {
    const { container } = render(<PmlRenderer nodes={[answer]} site={site} flavor="post" />);
    const box = container.querySelector('aside') as HTMLElement;
    const key = box.querySelector('span') as HTMLElement;

    expect(box.style.borderLeft).toContain('4px solid');
    expect(box.style.borderRadius).toBe('8px');
    expect([key.textContent, key.style.textTransform, key.style.fontSize]).toEqual(['Short answer', 'uppercase', '11px']);
    // No tone icon: the reference's answer is words only.
    expect(box.querySelector('svg')).toBeNull();
  });

  it('keeps a toned callout, and every callout on a page, as it was', () => {
    const toned = { ...answer, props: { ...answer.props, tone: 'warning' } } as PmlNode;

    for (const [nodes, flavor] of [[[toned], 'post'], [[answer], undefined]] as const) {
      const { container, unmount } = render(<PmlRenderer nodes={[...nodes]} site={site} flavor={flavor} />);

      expect((container.querySelector('aside') as HTMLElement).querySelector('svg')).not.toBeNull();
      unmount();
    }
  });

  it('draws a table as the reference card: bordered, its caption bold, header cells shaded', () => {
    const { container } = render(<PmlRenderer nodes={[table]} site={site} flavor="post" />);
    const card = container.querySelector('table')?.parentElement as HTMLElement;
    const th = container.querySelector('th') as HTMLElement;
    const td = container.querySelector('td') as HTMLElement;

    expect([card.style.borderRadius, card.style.overflowX]).toEqual(['8px', 'auto']);
    expect((container.querySelector('caption') as HTMLElement).style.fontWeight).toBe('700');
    expect([th.style.background, th.style.fontSize]).toEqual(['rgb(248, 250, 252)', '12.5px']);
    expect(td.style.padding).toBe('9px 14px');
  });

  it('a page table keeps its own look', () => {
    const { container } = render(<PmlRenderer nodes={[table]} site={site} />);

    expect((container.querySelector('td') as HTMLElement).className).toContain('px-3');
  });

  it('opens every FAQ answer on the canvas, and keeps the accordion for readers', () => {
    const canvas = render(<PmlRenderer nodes={[faq]} site={site} flavor="post" builderHints />);
    expect(canvas.container.querySelector('details')).toBeNull();
    expect(canvas.getByText('Often, yes.')).toBeTruthy();
    expect((canvas.getByRole('heading', { name: 'Frequently asked questions' }) as HTMLElement).style.fontSize).toBe('26px');
    canvas.unmount();

    const page = render(<PmlRenderer nodes={[faq]} site={site} flavor="post" />);
    expect(page.container.querySelector('details summary')?.textContent).toBe('Can I work while I wait?');
  });

  it('sets a question heading in the reference size unless the author set its own', () => {
    const plain = render(<PmlRenderer nodes={[question]} site={site} flavor="post" />);
    expect([(plain.getByRole('heading') as HTMLElement).style.fontSize, (plain.getByRole('heading') as HTMLElement).style.fontWeight]).toEqual(['26px', '800']);
    plain.unmount();

    const sized = render(<PmlRenderer nodes={[{ ...question, style: { heading_size: 'xl' } } as PmlNode]} site={site} flavor="post" />);
    expect((sized.getByRole('heading') as HTMLElement).style.fontSize).toBe('');
  });
});

describe('the one empty marker on the canvas', () => {
  const empty = { primitive: 'p', children: [text('')] } as unknown as PmlNode;

  it('stands in for an empty paragraph, which a reader never sees', () => {
    const canvas = render(<PmlRenderer nodes={[empty]} site={site} builderHints />);
    const mark = canvas.container.querySelector('[data-pml-empty]') as HTMLElement;

    expect(mark.textContent).toBe('Empty paragraph: select it to fill it in');
    expect([mark.style.borderRadius, mark.style.background]).toEqual(['10px', 'rgb(238, 238, 255)']);
    canvas.unmount();

    const page = render(<PmlRenderer nodes={[empty]} site={site} />);
    expect(page.container.querySelector('[data-pml-empty]')).toBeNull();
  });

  it('marks an empty table cell inside its row, and only on the canvas', () => {
    const canvas = render(<PmlRenderer nodes={[table]} site={site} builderHints />);
    expect(canvas.getByText('Empty cell')).toBeTruthy();
    canvas.unmount();

    const page = render(<PmlRenderer nodes={[table]} site={site} />);
    expect(page.queryByText('Empty cell')).toBeNull();
  });

  it('marks an empty post title in the same way, keeping its placeholder words', () => {
    const { container } = render(<PmlRenderer nodes={[{ primitive: 'post_title', props: { resolved: {} } } as PmlNode]} site={site} builderHints />);
    const h1 = container.querySelector('h1') as HTMLElement;

    expect([h1.textContent, h1.style.borderRadius, h1.style.background]).toEqual(['Add title', '10px', 'rgb(238, 238, 255)']);
  });
});
