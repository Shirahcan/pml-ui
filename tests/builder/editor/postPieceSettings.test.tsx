import React from 'react';
import { render, screen } from '@testing-library/react';

import { PmlSettings } from '../../../src/builder/editor/PmlSettings';
import type { PmlNode } from '../../../src/language';
import { elementLabel, PML_SECTIONS } from '../../../src/language';

const PIECES = [
  ['post_breadcrumbs', 'Breadcrumbs'],
  ['post_category', 'Category'],
  ['post_title', 'Title'],
  ['post_dek', 'Line under the title'],
  ['post_meta', 'Byline'],
  ['post_author', 'Author'],
  ['post_date', 'Date'],
  ['post_read_time', 'Read time'],
  ['post_reviewer', 'Reviewer'],
  ['post_badges', 'Trust badges'],
  ['post_reviewer_badge', 'Reviewer badge'],
  ['post_sources_badge', 'Sources badge'],
  ['post_tags', 'Tags'],
] as const;

/**
 * Owner 2026-11-17: "This is what selecting them does - they're grouped inside a container". Selecting a header piece
 * showed "Section settings / This section cannot be edited here", because no piece had a catalog entry.
 */
describe('a post header piece selected on its own', () => {
  it.each(PIECES)('%s is named "%s" wherever the builder names it', (name, label) => {
    expect(elementLabel(name)).toBe(label);
  });

  it('opens its own panel, saying what it is', () => {
    render(<PmlSettings node={{ primitive: 'post_title', props: {} } as PmlNode} onChange={() => undefined} onDelete={() => undefined} />);

    expect(screen.getByRole('heading', { name: 'Title' })).toBeTruthy();
    expect(screen.getByText('The post’s title, as its main heading.')).toBeTruthy();
    expect(screen.queryByText('This section cannot be edited here.')).toBeNull();
  });

  it('a date says which date it shows', () => {
    render(<PmlSettings node={{ primitive: 'post_date', props: { kind: 'verified' } } as PmlNode} onChange={() => undefined} onDelete={() => undefined} />);

    expect(screen.getByText('Which date')).toBeTruthy();
  });

  it('stays inside the header: none is offered in the top-level Add menu', () => {
    const offered = new Set(PML_SECTIONS.map((entry) => entry.name));

    expect(PIECES.filter(([name]) => offered.has(name))).toEqual([]);
    expect(offered.has('post_date')).toBe(false);
  });
});
