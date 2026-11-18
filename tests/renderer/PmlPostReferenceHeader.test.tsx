import React from 'react';
import { render } from '@testing-library/react';

import type { PmlNode } from '../../src/pml/primitives';
import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';

const site: PublicSite = {};
const longDate = (iso: string) => new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
/** What a reader reads: the page's words, without the renderer's own style sheet. */
const words = (c: HTMLElement): string => {
  const copy = c.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('style').forEach((s) => s.remove());

  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
};

/** The reference studio's header, piece by piece (owner 2026-11-17: "this must be gotten right!"). */
const header = (resolved: Record<string, unknown>): PmlNode[] =>
  [
    { primitive: 'post_breadcrumbs', props: { resolved } },
    { primitive: 'post_category', props: { resolved } },
    { primitive: 'post_title', props: { resolved } },
    { primitive: 'post_dek', props: { resolved } },
    { primitive: 'post_meta', props: {}, children: [{ primitive: 'post_author', props: { resolved } }, { primitive: 'post_date', props: { kind: 'verified', resolved } }] },
    { primitive: 'post_badges', props: {}, children: [{ primitive: 'post_reviewer_badge', props: { resolved } }, { primitive: 'post_sources_badge', props: { resolved } }] },
    { primitive: 'post_cover', props: { resolved } },
  ] as unknown as PmlNode[];

const full = {
  title: 'Canada Express Entry 2026: Eligibility, CRS and Draws',
  dek: 'Who can apply, how the new CRS rules change your score, and what it costs.',
  category: { name: 'Express Entry' },
  home_url: 'https://portify.example/',
  blog_url: 'https://portify.example/blog',
  author_name: 'Portify Editorial Team',
  last_verified_at: '2026-11-16T12:00:00Z',
  reviewer: { name: 'Ada Okafor', licence: 'R000000' },
  source_domains: ['canada.ca', 'cic.gc.ca'],
};

describe('the reference header', () => {
  it("draws the post's own details exactly as the reference does", () => {
    const { container: c } = render(<PmlRenderer nodes={header(full)} site={site} />);

    const nav = c.querySelector('nav[aria-label="Breadcrumb"]') as HTMLElement;
    expect(nav.textContent).toBe('Home › Blog › Express Entry');
    expect([...nav.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['https://portify.example/', 'https://portify.example/blog']);
    expect(nav.style.fontSize).toBe('12.5px');

    const pill = [...c.querySelectorAll('span')].find((s) => s.textContent === 'Express Entry' && !s.closest('nav')) as HTMLElement;
    expect([pill.style.fontSize, pill.style.textTransform, pill.style.borderRadius, pill.style.padding]).toEqual(['11px', 'uppercase', '999px', '3px 10px']);
    // It hugs its words: in the header's stack it ran edge to edge as a bar (2026-11-18).
    expect(pill.style.width).toBe('fit-content');

    const h1 = c.querySelector('h1') as HTMLElement;
    expect(h1.textContent).toBe(full.title);
    expect([h1.style.fontSize, h1.style.fontWeight, h1.style.letterSpacing]).toEqual(['38px', '800', '-.025em']);

    expect(words(c)).toContain(full.dek);
    expect(words(c)).toContain('By Portify Editorial Team');
    expect(words(c)).toContain(`Last verified ${longDate(full.last_verified_at)}`);
    expect(words(c)).toContain('Reviewed by Ada Okafor, RCIC R000000');
    expect(words(c)).toContain('Sources: canada.ca, cic.gc.ca');
    // The byline's values are bold ink.
    expect([...c.querySelectorAll('b')].map((b) => b.textContent)).toEqual(['Portify Editorial Team', longDate(full.last_verified_at)]);
  });

  it('on the public page an empty header draws nothing (no placeholder ever reaches a reader)', () => {
    const { container: c } = render(<PmlRenderer nodes={header({})} site={site} />);

    expect(words(c)).toBe('Home › Blog');
    expect(c.querySelector('h1')).toBeNull();
    expect(c.querySelector('figure')).toBeNull();
  });

  it("on the canvas an empty header shows the reference's grey placeholders, in each piece's own shape", () => {
    const { container: c } = render(<PmlRenderer nodes={header({ author_name: 'Portify Editorial Team' })} site={site} builderHints />);
    const text = words(c);

    for (const placeholder of [
      'Home › Blog › Category',
      'Add title',
      'Add a one-line dek under the title',
      'By Portify Editorial Team',
      'Last verified not set',
      'Reviewed by RCIC not set',
      'Sources: none yet',
      'Featured image',
      'No image yet. Choose one from the image bank.',
      'Add a caption',
    ]) {
      expect(text).toContain(placeholder);
    }
    const h1 = c.querySelector('h1') as HTMLElement;
    expect([h1.textContent, h1.style.color]).toEqual(['Add title', 'rgb(160, 168, 184)']);
  });
});

describe("a template's bracketed example words", () => {
  const nodes = [{ primitive: 'p', children: [{ primitive: 'text', props: { value: '[The direct answer, in under 50 words.]' } }] }] as unknown as PmlNode[];

  it('read as grey placeholders on the canvas', () => {
    const { container } = render(<PmlRenderer nodes={nodes} site={site} builderHints />);
    const run = [...container.querySelectorAll('span, p')].find((e) => e.textContent === '[The direct answer, in under 50 words.]' && (e as HTMLElement).style.color) as HTMLElement;

    expect(run.style.color).toBe('rgb(160, 168, 184)');
  });

  it('are never restyled on the public page', () => {
    const { container } = render(<PmlRenderer nodes={nodes} site={site} />);

    expect([...container.querySelectorAll('[style]')].some((e) => (e as HTMLElement).style.color === 'rgb(160, 168, 184)')).toBe(false);
  });
});
