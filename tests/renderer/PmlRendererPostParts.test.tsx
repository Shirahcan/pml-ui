import React from 'react';
import { render } from '@testing-library/react';
import { PmlRenderer, type PmlHost, type PmlSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';

/**
 * Post layouts C2b (owner 2026-11-16): the post's header, cover, related guides and disclaimer drawn from its own
 * baked fields, so the designer shows the whole post. The package draws them for every product; a host may draw
 * its own instead.
 */
const site = { username: 'portify' } as PmlSite;
const resolved = {
  title: 'Canada Express Entry 2026: Eligibility, CRS and Draws',
  dek: 'Who can apply and what it costs.',
  category: { name: 'Express Entry', url: '/blog/category/express-entry' },
  tags: ['express entry', 'crs'],
  author_name: 'Portify Editorial Team',
  published_at: '2026-11-16T12:00:00Z',
  read_minutes: 12,
  reviewer: { name: 'Ada Okafor', licence: 'R000000', confirmed: true },
  last_verified_at: '2026-11-15',
  sources: [{ title: 'Express Entry', url: 'https://www.canada.ca/' }, { title: 'CRS', url: 'https://www.canada.ca/crs' }],
  cover: { url: 'https://example.test/cover.jpg', alt: 'Toronto skyline', caption: 'Toronto, Ontario.' },
  related: [{ title: 'Provincial Nominee Program', url: '/blog/pnp', category: 'PNP' }],
};

describe('PmlRenderer post parts', () => {
  it('draws the header from the post fields, with one level-1 heading, the byline, the badges and the tags', () => {
    const { container, getByRole, getByText } = render(<PmlRenderer nodes={[{ primitive: 'post_header', props: { resolved } } as PmlNode]} site={site} />);

    expect(getByRole('heading', { level: 1 }).textContent).toBe(resolved.title);
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(getByRole('navigation', { name: 'Breadcrumb' }).textContent).toBe('Home › Blog › Express Entry');
    expect(getByText('12 min read')).toBeTruthy();
    expect(getByText('By Portify Editorial Team')).toBeTruthy();
    expect(getByText(/Reviewed by Ada Okafor, RCIC R000000/)).toBeTruthy();
    expect(getByText('2 official sources')).toBeTruthy();
    expect(getByRole('list', { name: 'Tags' }).textContent).toBe('express entrycrs');
  });

  it('draws no reviewer badge when none was baked (pml-kit keeps only a confirmed reviewer)', () => {
    const { queryByText } = render(<PmlRenderer nodes={[{ primitive: 'post_header', props: { resolved: { ...resolved, reviewer: undefined } } } as PmlNode]} site={site} />);

    expect(queryByText(/Reviewed by/)).toBeNull();
  });

  it('says where the words come from when nothing is baked (the builder), never a blank band', () => {
    const { getByText, container } = render(
      <PmlRenderer nodes={[{ primitive: 'post_header', props: {} }, { primitive: 'post_cover', props: {} }, { primitive: 'post_related', props: { heading: 'Related guides' } }] as PmlNode[]} site={site} />,
    );

    expect(getByText(/breadcrumb, title, byline, read time, badges and tags show here/)).toBeTruthy();
    expect(getByText(/cover photo and its caption show here/)).toBeTruthy();
    expect(getByText(/three related published guides show here/)).toBeTruthy();
    expect(container.querySelectorAll('h1')).toHaveLength(0);
  });

  it('draws the cover, the related guides and the disclaimer', () => {
    const { getByAltText, getByText, getByRole } = render(
      <PmlRenderer
        nodes={[{ primitive: 'post_cover', props: { resolved, ratio: '4:3' } }, { primitive: 'post_related', props: { resolved, heading: 'Related guides' } }, { primitive: 'post_disclaimer', props: { text: 'General information, not legal advice.' } }] as PmlNode[]}
        site={site}
      />,
    );

    expect((getByAltText('Toronto skyline') as HTMLImageElement).style.aspectRatio).toBe('4 / 3');
    expect(getByText('Toronto, Ontario.')).toBeTruthy();
    expect(getByRole('link', { name: 'Provincial Nominee Program' }).getAttribute('href')).toBe('/blog/pnp');
    expect(getByText('General information, not legal advice.')).toBeTruthy();
  });

  it('lets a host draw a post part itself', () => {
    const host: PmlHost = { elements: { post_header: () => <p data-testid="own">the host's header</p> } };
    const { getByTestId, queryByRole } = render(<PmlRenderer nodes={[{ primitive: 'post_header', props: { resolved } } as PmlNode]} site={site} host={host} />);

    expect(getByTestId('own')).toBeTruthy();
    expect(queryByRole('heading', { level: 1 })).toBeNull();
  });
});
