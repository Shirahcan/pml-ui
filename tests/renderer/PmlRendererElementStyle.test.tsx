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

describe('PML leaf-primitive style application', () => {
  it('lets a heading say its own weight (it was always semibold too, and lost to it)', () => {
    const own = renderNode({ primitive: 'heading', props: { text: 'Hire talent', level: 2 }, style: { font_weight: 'medium' } });
    const plain = renderNode({ primitive: 'heading', props: { text: 'Hire talent', level: 2 } });

    expect(own.querySelector('h2')!.className).toContain('font-medium');
    expect(own.querySelector('h2')!.className).not.toContain('font-semibold');
    expect(plain.querySelector('h2')!.className).toContain('font-semibold');
  });

  it('applies radius / shadow / palette colour / self-align to a button (the hero CTA)', () => {
    const c = renderNode({
      primitive: 'button',
      props: { label: 'Book a call', href: '/book' },
      style: { radius: 'full', shadow: 'md', text_color: 'on-accent', self_align: 'end' },
    });
    const a = c.querySelector('a');
    expect(a).not.toBeNull();
    expect(a!.className).toContain('shadow-md');
    expect(a!.className).toContain('rounded-full');
    expect(a!.className).toContain('text-[var(--site-accent-text)]');
    expect(a!.className).toContain('self-end');
  });

  it('applies a custom button colour inline', () => {
    const c = renderNode({
      primitive: 'button',
      props: { label: 'x', href: '/x' },
      style: { text_color_custom: '#123456' },
    });
    const a = c.querySelector('a') as HTMLAnchorElement;
    expect(a.style.color).toBe('rgb(18, 52, 86)');
  });

  it('applies typography tokens to a heading', () => {
    const c = renderNode({
      primitive: 'heading',
      props: { text: 'Big', level: '1' },
      style: { font_weight: 'bold', letter_spacing: 'wide' },
    });
    const h1 = c.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(h1!.className).toContain('font-bold');
    expect(h1!.className).toContain('tracking-wide');
  });

  it('applies border/margin tokens to an icon', () => {
    const c = renderNode({
      primitive: 'icon',
      props: { name: 'star' },
      style: { margin_y: 'md', self_align: 'center' },
    });
    const svg = c.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('class')).toContain('my-8');
    expect(svg!.getAttribute('class')).toContain('self-center');
  });
});
