import React from 'react';
import { render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';

// Minimal site stand-in: the renderer only reads theme vars off it, and spans do not touch those.
const site = { theme: {} } as unknown as PublicSite;

function renderGrid(node: PmlNode) {
  const { container } = render(<PmlRenderer nodes={[node]} site={site} />);
  return container;
}

describe('grid col/row spans', () => {
  it('wraps a spanning child with the responsive span class', () => {
    const c = renderGrid({
      primitive: 'grid',
      props: { columns: '3', gap: 'md' },
      children: [
        { primitive: 'heading', props: { text: 'Wide', level: '2' }, style: { col_span: '2', row_span: '2' } },
      ],
    });

    expect(c.querySelector('.md\\:col-span-2')).not.toBeNull();
    expect(c.querySelector('.md\\:row-span-2')).not.toBeNull();
  });

  it('clamps a col_span that exceeds the column count to full width', () => {
    const c = renderGrid({
      primitive: 'grid',
      props: { columns: '2' },
      children: [
        { primitive: 'heading', props: { text: 'Too wide', level: '2' }, style: { col_span: '4' } },
      ],
    });

    // 4 clamps to the grid's 2 columns.
    expect(c.querySelector('.md\\:col-span-2')).not.toBeNull();
    expect(c.querySelector('.md\\:col-span-4')).toBeNull();
  });

  it('does not wrap a child with no span', () => {
    const c = renderGrid({
      primitive: 'grid',
      props: { columns: '2' },
      children: [{ primitive: 'heading', props: { text: 'Plain', level: '2' } }],
    });

    expect(c.querySelector('[class*="col-span"]')).toBeNull();
  });
});
