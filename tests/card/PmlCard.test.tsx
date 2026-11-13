import React from 'react';
import { render, waitFor } from '@testing-library/react';

import { PmlCard } from '../../src/card/PmlCard';
import { CARD_READY_SELECTOR, cardNodes } from '../../src/card/cardFrame';
import type { PmlSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';

/** The card renderer (E1b): the page renderer inside a fixed 1200x630 frame, the card subset, the ready mark. */
const site = {} as PmlSite;
const heading: PmlNode = { primitive: 'heading', props: { text: 'Spring LMIA webinar', level: 1 } };

describe('PmlCard', () => {
  it('draws the card at exactly 1200x630, scaled from the full-size frame', () => {
    const { container } = render(<PmlCard nodes={[heading]} site={site} scale={0.5} />);
    const outer = container.firstElementChild as HTMLElement;
    const frame = container.querySelector('[data-pml-card]') as HTMLElement;

    expect([outer.style.width, outer.style.height]).toEqual(['600px', '315px']);
    expect([frame.style.width, frame.style.height]).toEqual(['1200px', '630px']);
    expect(frame.style.transform).toBe('scale(0.5)');
    expect(frame.textContent).toContain('Spring LMIA webinar');
  });

  it('draws nothing outside the card subset', () => {
    const nodes: PmlNode[] = [
      heading,
      { primitive: 'form', props: { key: 'ask' }, children: [{ primitive: 'field', props: { name: 'email', label: 'Email' } }] },
      { primitive: 'box', props: {}, children: [{ primitive: 'script', props: { source: 'let x = 1' } }, { primitive: 'text', props: { value: 'Kept' } }] },
    ];

    expect(cardNodes(nodes).map((n) => n.primitive)).toEqual(['heading', 'box']);
    expect(cardNodes(nodes)[1].children?.map((n) => n.primitive)).toEqual(['text']);

    const { container } = render(<PmlCard nodes={nodes} site={site} />);
    expect(container.querySelector('form')).toBeNull();
    expect(container.textContent).toContain('Kept');
  });

  it('marks itself ready only after its fonts and pictures resolve', async () => {
    const { container } = render(<PmlCard nodes={[heading]} site={site} />);

    await waitFor(() => expect(container.querySelector(CARD_READY_SELECTOR)).not.toBeNull());
  });

  it('shows the builder guides only when asked', () => {
    expect(render(<PmlCard nodes={[heading]} site={site} />).container.querySelector('[data-card-guides]')).toBeNull();
    expect(render(<PmlCard nodes={[heading]} site={site} overlay />).container.querySelector('[data-card-guides]')).not.toBeNull();
  });
});
