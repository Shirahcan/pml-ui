import React from 'react';
import { render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';

const site = { theme: {} } as unknown as PublicSite;

function renderNode(node: PmlNode) {
  const { container } = render(<PmlRenderer nodes={[node]} site={site} />);
  return container;
}

describe('PML container flex placement', () => {
  it('applies justify on a box', () => {
    const c = renderNode({
      primitive: 'box',
      props: { direction: 'row' },
      style: { justify: 'between' },
      children: [{ primitive: 'text', props: { value: 'a' } }],
    });
    expect(c.querySelector('.justify-between')).not.toBeNull();
  });

  it('lets align_items override the default row centering', () => {
    const c = renderNode({
      primitive: 'box',
      props: { direction: 'row' },
      style: { align_items: 'end' },
      children: [{ primitive: 'text', props: { value: 'a' } }],
    });
    expect(c.querySelector('.items-end')).not.toBeNull();
    // The hardcoded default must step aside so the two items-* classes do not collide.
    expect(c.querySelector('.items-center')).toBeNull();
  });

  it('keeps items-center as the default for a row with no align_items', () => {
    const c = renderNode({
      primitive: 'box',
      props: { direction: 'row' },
      children: [{ primitive: 'text', props: { value: 'a' } }],
    });
    expect(c.querySelector('.items-center')).not.toBeNull();
  });

  it('does not force items-center on a column', () => {
    const c = renderNode({
      primitive: 'box',
      props: { direction: 'column' },
      children: [{ primitive: 'text', props: { value: 'a' } }],
    });
    expect(c.querySelector('.items-center')).toBeNull();
  });

  it('applies justify + align on a nav landmark (the nav-layout fix)', () => {
    const c = renderNode({
      primitive: 'nav',
      props: { direction: 'row' },
      style: { justify: 'center', align_items: 'baseline' },
      children: [{ primitive: 'button', props: { label: 'Home', href: '/' } }],
    });
    const nav = c.querySelector('nav');
    expect(nav).not.toBeNull();
    expect(nav!.className).toContain('justify-center');
    expect(nav!.className).toContain('items-baseline');
    expect(nav!.className).not.toContain('items-center');
  });
});
