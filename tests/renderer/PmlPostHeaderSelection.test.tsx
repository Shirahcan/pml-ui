import React from 'react';
import { render } from '@testing-library/react';

import type { PmlNode } from '../../src/pml/primitives';
import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';

const site: PublicSite = {};

const resolved = {
  title: 'Canada Express Entry 2026',
  dek: 'Who can apply and what it costs.',
  category: { name: 'Express Entry' },
  author_name: 'Portify Editorial Team',
  last_verified_at: '2026-11-16T00:00:00Z',
  reviewer: { name: 'Ada Okafor', licence: 'R000000' },
  source_domains: ['canada.ca'],
};

/** The Classic header as the template places it: a box holding each piece, the byline and the badges rows. */
const header: PmlNode = {
  primitive: 'box',
  children: [
    { primitive: 'post_breadcrumbs', props: { resolved } },
    { primitive: 'post_category', props: { resolved } },
    { primitive: 'post_title', props: { resolved } },
    { primitive: 'post_dek', props: { resolved } },
    { primitive: 'post_meta', children: [{ primitive: 'post_author', props: { resolved } }, { primitive: 'post_date', props: { kind: 'verified', resolved } }] },
    { primitive: 'post_badges', children: [{ primitive: 'post_reviewer_badge', props: { resolved } }, { primitive: 'post_sources_badge', props: { resolved } }] },
  ],
} as PmlNode;

/** What a click on the drawn element resolves to: the nearest path holder, as the canvas finds it. */
const holderOf = (el: Element | null): string | null => el?.closest('[data-pml-path]')?.getAttribute('data-pml-path') ?? null;

describe('a header piece is its own element on the canvas', () => {
  it('each piece and each row child carries its own path, so a click selects the piece, not the box', () => {
    const { container } = render(<PmlRenderer nodes={[header]} site={site} builderHints pathRoot={[0]} />);

    expect(holderOf(container.querySelector('nav[aria-label="Breadcrumb"]'))).toBe('0.0');
    expect(holderOf(Array.from(container.querySelectorAll('span')).find((s) => s.textContent === 'Express Entry' && !s.closest('nav')) ?? null)).toBe('0.1');
    expect(holderOf(container.querySelector('h1'))).toBe('0.2');
    expect(holderOf(Array.from(container.querySelectorAll('p')).find((p) => p.textContent?.startsWith('Who can apply')) ?? null)).toBe('0.3');
    const author = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === 'By Portify Editorial Team') ?? null;
    expect(holderOf(author)).toBe('0.4.0');
    const reviewer = Array.from(container.querySelectorAll('span')).find((s) => s.textContent?.startsWith('Reviewed by')) ?? null;
    expect(holderOf(reviewer)).toBe('0.5.0');
  });

  const toc = {
    primitive: 'toc',
    props: { title: 'On this page' },
    children: [
      { primitive: 'toc_item', props: { label: 'Who can apply', target: 'who-can-apply' } },
      { primitive: 'toc_item', props: { label: 'Fees', target: 'fees' } },
    ],
  } as unknown as PmlNode;

  it('each link a table of contents holds is its own element on the canvas', () => {
    const { container } = render(<PmlRenderer nodes={[toc]} site={site} builderHints pathRoot={[5]} />);
    const items = [...container.querySelectorAll('nav li')];

    expect(items.map((li) => [li.getAttribute('data-pml-path'), li.hasAttribute('data-pml-self')])).toEqual([
      ['5.0', true],
      ['5.1', true],
    ]);
    expect(holderOf(container.querySelector('a[href="#fees"]'))).toBe('5.1');
  });

  it('a public table of contents carries no builder marks', () => {
    const { container } = render(<PmlRenderer nodes={[toc]} site={site} />);

    expect(container.querySelector('[data-pml-path]')).toBeNull();
  });
});
