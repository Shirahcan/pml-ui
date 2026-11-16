import React from 'react';
import { render, waitFor } from '@testing-library/react';

import { PmlCard } from '../../src/card/PmlCard';
import { CARD_READY_SELECTOR, cardNodes } from '../../src/card/cardFrame';
import type { PmlSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';

/** The card renderer (E1b): the page renderer inside a fixed 1200x630 frame, the card subset, the ready mark. */
const site = {} as PmlSite;
const heading: PmlNode = { primitive: 'heading', props: { text: 'Spring LMIA webinar', level: 1 } };

/** A card marks itself ready after its fonts and pictures load; a test ends only once that update has landed. */
const settled = (container: HTMLElement) => waitFor(() => expect(container.querySelector(CARD_READY_SELECTOR)).not.toBeNull());

describe('PmlCard', () => {
  it('draws the card at exactly 1200x630, scaled from the full-size frame', async () => {
    const { container } = render(<PmlCard nodes={[heading]} site={site} scale={0.5} />);
    const outer = container.firstElementChild as HTMLElement;
    const frame = container.querySelector('[data-pml-card]') as HTMLElement;

    expect([outer.style.width, outer.style.height]).toEqual(['600px', '315px']);
    expect([frame.style.width, frame.style.height]).toEqual(['1200px', '630px']);
    expect(frame.style.transform).toBe('scale(0.5)');
    // Card-sized type: the page's scale variable is set on the frame.
    expect(frame.style.getPropertyValue('--site-type-scale')).toBe('1.8');
    expect(frame.textContent).toContain('Spring LMIA webinar');
    await settled(container);
  });

  it('draws nothing outside the card subset', async () => {
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
    await settled(container);
  });

  describe('a card with a picture (0.6.3)', () => {
    const logo: PmlNode = { primitive: 'image', props: { src: 'https://cdn.test/logo.png', alt: '', size: 'logo' } };
    const pictureState = (naturalWidth: number) => {
      Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
      Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => naturalWidth });
    };

    afterEach(() => {
      delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).complete;
      delete (HTMLImageElement.prototype as unknown as Record<string, unknown>).naturalWidth;
    });

    it('is ready once the picture has loaded', async () => {
      pictureState(120);
      const { container } = render(<PmlCard nodes={[logo, heading]} site={site} />);

      await settled(container);
    });

    it('is NEVER ready when the picture failed, so a snapshot cannot store the card without it', async () => {
      pictureState(0);
      const { container } = render(<PmlCard nodes={[logo, heading]} site={site} />);

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(container.querySelector('img')).not.toBeNull();
      expect(container.querySelector(CARD_READY_SELECTOR)).toBeNull();
    });

    it('draws a logo-size picture by height at its own width, not squeezed into the 48px xs slot', async () => {
      pictureState(120);
      const { container } = render(<PmlCard nodes={[logo, heading]} site={site} />);
      const img = container.querySelector('img') as HTMLImageElement;

      expect(img.className).toContain('h-10');
      expect(img.className).toContain('w-auto');
      expect(img.closest('figure')?.className).not.toContain('max-w-[48px]');
      await settled(container);
    });
  });

  it('marks itself ready only after its fonts and pictures resolve', async () => {
    const { container } = render(<PmlCard nodes={[heading]} site={site} />);

    await waitFor(() => expect(container.querySelector(CARD_READY_SELECTOR)).not.toBeNull());
  });

  it('fills the frame with its top-level box and leaves pages alone', async () => {
    const { container } = render(<PmlCard nodes={[heading]} site={site} />);
    const frame = container.querySelector('[data-pml-card]') as HTMLElement;
    const rules = frame.querySelector('style')?.textContent ?? '';

    expect(frame.style.display).toBe('flex');
    expect(rules).toContain('[data-pml-card]>*:not(style):not([data-card-guides]){flex:1 1 auto;min-height:0!important');
    // Every rule is scoped to the card frame, so a page drawn by the same renderer is untouched.
    expect(rules.split('}').filter(Boolean).every((rule) => rule.trim().startsWith('[data-pml-card]'))).toBe(true);
    await settled(container);
  });

  it('shows the builder guides only when asked', async () => {
    const plain = render(<PmlCard nodes={[heading]} site={site} />).container;
    const guided = render(<PmlCard nodes={[heading]} site={site} overlay />).container;

    expect(plain.querySelector('[data-card-guides]')).toBeNull();
    expect(guided.querySelector('[data-card-guides]')).not.toBeNull();
    await settled(plain);
    await settled(guided);
  });
});
