import React from 'react';
import { render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import { packageGridCols } from '../../src/renderer/modules/PmlPackages';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';

const site = { theme: {} } as unknown as PublicSite;

const grid: PmlNode = {
  primitive: 'grid',
  props: { columns: '3', gap: 'md' },
  children: [
    { primitive: 'text', props: { value: 'a' } },
    { primitive: 'text', props: { value: 'b' } },
    { primitive: 'text', props: { value: 'c' } },
  ],
};

describe('PML mobile-view preview collapses multi-column layouts', () => {
  it('keeps the md: column expansion on the live path (forceMobile off)', () => {
    const { container } = render(<PmlRenderer nodes={[grid]} site={site} />);
    expect(container.querySelector('.md\\:grid-cols-3')).not.toBeNull();
  });

  it('drops the md: column expansion in the Mobile-view preview (forceMobile on)', () => {
    const { container } = render(<PmlRenderer nodes={[grid]} site={site} forceMobile />);
    // The whole point of the fix: the grid honestly collapses to one column in the preview.
    expect(container.querySelector('.md\\:grid-cols-3')).toBeNull();
    expect(container.querySelector('.grid-cols-1')).not.toBeNull();
  });
});

describe('adaptive package columns', () => {
  it('adapts the column count to the number of packages', () => {
    expect(packageGridCols(1, false)).toBe('mx-auto max-w-md');
    expect(packageGridCols(2, false)).toBe('md:grid-cols-2');
    expect(packageGridCols(3, false)).toBe('md:grid-cols-2 lg:grid-cols-3');
    expect(packageGridCols(5, false)).toBe('md:grid-cols-2 lg:grid-cols-3');
  });

  it('collapses to a single column in the mobile preview regardless of count', () => {
    expect(packageGridCols(3, true)).toBe('');
    expect(packageGridCols(2, true)).toBe('');
    expect(packageGridCols(1, true)).toBe('mx-auto max-w-md');
  });
});
