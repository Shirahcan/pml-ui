import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { PageLayers } from '../../src/builder/editor/PageLayers';
import { TocRebuild } from '../../src/builder/editor/TocRebuild';
import type { PmlNode } from '../../src/pml/primitives';
import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';

const site: PublicSite = {};
const draw = (nodes: PmlNode[]) => render(<PmlRenderer nodes={nodes} site={site} />).container;
/** What a reader reads: the page's words, without the renderer's own style sheet. */
const words = (c: HTMLElement): string => {
  const copy = c.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('style').forEach((s) => s.remove());

  return copy.textContent ?? '';
};
const longDate = (iso: string) => new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

const resolved = {
  title: 'Who can apply for a work permit',
  dek: 'Most people with a job offer can apply.',
  blog_url: '/blog',
  category: { name: 'Work and LMIA', url: '/blog/category/work' },
  author_name: 'Lara Taj',
  published_at: '2026-11-17T10:00:00Z',
  updated_at: '2026-11-20T10:00:00Z',
  read_minutes: 6,
  tags: ['Work permits', 'LMIA'],
};

/** The Classic template's post pieces (owner 2026-11-17, T1), one element each, from the post's baked details. */
describe('post pieces', () => {
  it("draws each piece from the post's own details", () => {
    const c = draw([
      { primitive: 'post_breadcrumbs', props: { resolved } },
      { primitive: 'post_title', props: { resolved } },
      { primitive: 'post_dek', props: { resolved } },
      {
        primitive: 'post_meta',
        props: {},
        children: [
          { primitive: 'post_author', props: { resolved } },
          { primitive: 'post_date', props: { kind: 'updated', resolved } },
          { primitive: 'post_read_time', props: { resolved } },
          { primitive: 'post_reviewer', props: { resolved } },
        ],
      },
      { primitive: 'post_tags', props: { resolved } },
    ] as unknown as PmlNode[]);

    expect(c.querySelector('nav[aria-label="Breadcrumb"]')?.textContent).toBe('Home › Blog › Work and LMIA');
    expect(c.querySelector('h1')?.textContent).toBe('Who can apply for a work permit');
    expect(words(c)).toContain('Most people with a job offer can apply.');
    expect(words(c)).toContain('By Lara Taj');
    expect(words(c)).toContain(`Updated ${longDate('2026-11-20T10:00:00Z')}`);
    expect(words(c)).toContain('6 min read');
    // No reviewer confirmed this version: nothing may claim a review on the page.
    expect(words(c)).not.toContain('Reviewed by');
    expect([...c.querySelectorAll('ul[aria-label="Tags"] li')].map((li) => li.textContent)).toEqual(['Work permits', 'LMIA']);
  });

  it('a piece with nothing to show draws nothing on the page', () => {
    const c = draw([
      { primitive: 'post_title', props: { resolved: {} } },
      { primitive: 'post_tags', props: { resolved: {} } },
      { primitive: 'post_summary', props: { resolved: {} } },
      { primitive: 'post_sources', props: { resolved: {} } },
    ] as unknown as PmlNode[]);

    expect(words(c).trim()).toBe('');
  });

  it("draws the post's summary under the title and its sources linked (owner 2026-11-18)", () => {
    const answer = 'Most graduates of an eligible program can apply within 180 days of their final marks.';
    const c = draw([
      { primitive: 'post_summary', props: { resolved: { answer } } },
      { primitive: 'post_sources', props: { resolved: { sources: [
        { label: 'IRCC: Post-graduation work permit', url: 'https://www.canada.ca/pgwp' },
        { label: 'Not a web address', url: 'javascript:alert(1)' },
      ] } } },
    ] as unknown as PmlNode[]);

    expect(words(c)).toContain(answer);
    const links = [...c.querySelectorAll('section[aria-label="Sources"] a')] as HTMLAnchorElement[];
    expect(links.map((a) => [a.textContent, a.getAttribute('href'), a.getAttribute('rel')])).toEqual([
      ['IRCC: Post-graduation work permit', 'https://www.canada.ca/pgwp', 'noopener noreferrer'],
    ]);
  });

  it('a summary filled on the canvas keeps its accent and raises no style error (0.7.84)', () => {
    const errors: unknown[][] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { errors.push(args); });
    const empty = [{ primitive: 'post_summary', props: {} }] as unknown as PmlNode[];
    const filled = [{ primitive: 'post_summary', props: { resolved: { answer: 'Apply online before your permit expires.' } } }] as unknown as PmlNode[];

    const view = render(<PmlRenderer nodes={empty} site={site} builderHints />);
    view.rerender(<PmlRenderer nodes={filled} site={site} builderHints />);
    spy.mockRestore();

    expect(errors.filter((e) => String(e[0]).includes('style property'))).toEqual([]);
    const block = view.container.querySelector('p')?.parentElement as HTMLElement;
    expect(block.style.borderLeft).toContain('3px solid');
    expect(block.style.borderTop).toBe('');
  });

  it('on the canvas an empty summary or sources list says where its words come from', () => {
    const c = render(<PmlRenderer nodes={[{ primitive: 'post_summary', props: {} }, { primitive: 'post_sources', props: {} }] as unknown as PmlNode[]} site={site} builderHints />).container;

    expect(words(c)).toContain('Add the post’s summary in Post details');
    expect(words(c)).toContain('once each figure in Post details has its source');
  });

  it('a contents list holding items lists exactly those', () => {
    const c = draw([
      {
        primitive: 'toc',
        props: { title: 'In this guide' },
        children: [
          { primitive: 'toc_item', props: { label: 'Who can apply', target: 'who-can-apply' } },
          { primitive: 'toc_item', props: { label: 'Fees', target: '#fees' } },
        ],
      },
    ] as unknown as PmlNode[]);

    expect([...c.querySelectorAll('nav a')].map((a) => [a.textContent, a.getAttribute('href')])).toEqual([
      ['Who can apply', '#who-can-apply'],
      ['Fees', '#fees'],
    ]);
  });

  it('a cover is never taller than 420px', () => {
    const c = draw([{ primitive: 'post_cover', props: { resolved: { cover: { url: 'https://img.test/c.jpg', alt: 'A worker' } } } }] as unknown as PmlNode[]);

    expect((c.querySelector('img') as HTMLImageElement).style.maxHeight).toBe('420px');
  });
});

describe('notes in Layers', () => {
  it("shows a template's comment as a note, never as an element", () => {
    render(
      <PageLayers
        nodes={[{ comment: 'The title comes from the post’s Title field.' } as PmlNode, { primitive: 'heading', props: { text: 'Who can apply', level: 2 } } as PmlNode]}
        selectedPath={null}
        onSelect={() => undefined}
        onMoved={() => undefined}
      />,
    );

    expect(screen.getByRole('note').textContent).toBe('The title comes from the post’s Title field.');
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});

describe('a contents list rebuilt from the headings', () => {
  it("refills its items from the page's level-2 headings, with the page's anchors", () => {
    const onChange = vi.fn();
    const toc = { primitive: 'toc', props: {}, children: [{ primitive: 'toc_item', props: { label: 'Old', target: 'old' } }] } as unknown as PmlNode;
    const page = [
      toc,
      { primitive: 'heading', props: { text: 'Who can apply', level: 2 } },
      { primitive: 'heading', props: { text: 'A detail', level: 3 } },
      { primitive: 'heading', props: { text: 'Fees', level: 2 } },
    ] as unknown as PmlNode[];
    render(<TocRebuild node={toc} pageNodes={page} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /Rebuild from the headings/ }));
    const next = onChange.mock.calls[0][0] as PmlNode;
    expect((next.children ?? []).map((item) => item.props)).toEqual([
      { label: 'Who can apply', target: 'who-can-apply' },
      { label: 'Fees', target: 'fees' },
    ]);
  });
});
