import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';

/**
 * Carousels (owner 2026-11-08: "identify carousels on websites and not render them as a grid of items",
 * and "support auto, similar to the logos on vanhack"). `slides` draws a carousel with every slide and
 * its arrows; `auto=step` moves it on a timer; `auto=scroll` is an endless logo track; reduced motion
 * keeps both still.
 */
const site = { theme: {} } as unknown as PublicSite;

function row(props: Record<string, string>, count: number): PmlNode {
  return {
    primitive: 'box',
    props: { direction: 'row', ...props },
    children: Array.from({ length: count }, (_, i) => ({ primitive: 'text', props: { value: `Quote ${i + 1}` } })),
  } as PmlNode;
}

function setReducedMotion(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe('PmlRenderer carousels', () => {
  beforeEach(() => setReducedMotion(false));

  it('reads slides as the parser writes it (a number), not only as text', () => {
    const node = { ...row({}, 3), props: { direction: 'row', slides: 2 } } as unknown as PmlNode;
    const { getAllByRole } = render(<PmlRenderer nodes={[node]} site={site} />);

    expect(getAllByRole('group')).toHaveLength(3);
  });

  it('draws every slide as a slide with arrows, never a grid', () => {
    const { container, getByRole, getAllByRole } = render(<PmlRenderer nodes={[row({ slides: '2' }, 5)]} site={site} />);

    expect(getByRole('region', { name: 'Carousel' }).getAttribute('aria-roledescription')).toBe('carousel');
    expect(getAllByRole('group')).toHaveLength(5);
    expect(container.textContent).toContain('Quote 5');
    expect(container.querySelector('[class*="grid-cols"]')).toBeNull();
    expect(getByRole('button', { name: 'Next' })).toBeTruthy();
  });

  it('steps on its own with auto=step, and not while the pointer is on it', () => {
    vi.useFakeTimers();
    // jsdom draws nothing (every width is 0, so the track is always "at its end") and has no scrollTo.
    const scrollBy = vi.fn();
    Element.prototype.scrollBy = scrollBy as unknown as typeof Element.prototype.scrollBy;
    Element.prototype.scrollTo = scrollBy as unknown as typeof Element.prototype.scrollTo;
    const { getByRole } = render(<PmlRenderer nodes={[row({ slides: '1', auto: 'step' }, 3)]} site={site} />);

    act(() => vi.advanceTimersByTime(5100));
    expect(scrollBy).toHaveBeenCalledTimes(1);

    fireEvent.mouseEnter(getByRole('region', { name: 'Carousel' }));
    act(() => vi.advanceTimersByTime(10100));
    expect(scrollBy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('runs a logo track endlessly with auto=scroll, its copy hidden from screen readers, and still for reduced motion', () => {
    const { container } = render(<PmlRenderer nodes={[row({ auto: 'scroll' }, 3)]} site={site} />);
    expect(container.innerHTML).toContain('pml-marquee');
    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toContain('Quote 1');

    setReducedMotion(true);
    const still = render(<PmlRenderer nodes={[row({ auto: 'scroll' }, 3)]} site={site} />).container;
    expect(still.innerHTML).not.toContain('pml-marquee ');
    expect(still.textContent?.match(/Quote 1/g)).toHaveLength(1);
  });
});

describe('PmlRenderer display, carousel styles and placement (2026-11-08)', () => {
  beforeEach(() => setReducedMotion(false));

  function styled(style: Record<string, unknown>, count = 4): PmlNode {
    return { primitive: 'box', props: { direction: 'row' }, style, children: Array.from({ length: count }, (_, i) => ({ primitive: 'text', props: { value: `Card ${i + 1}` } })) } as PmlNode;
  }

  it('draws display=carousel from styles with dots that go to a page, and keeps a press on its controls to itself', () => {
    Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
    const outer = vi.fn();
    const { getAllByRole, getByRole } = render(
      <div onClick={outer}>
        <PmlRenderer nodes={[styled({ display: 'carousel', carousel_per_view: 2, carousel_controls: 'both' })]} site={site} />
      </div>,
    );

    expect(getAllByRole('group')).toHaveLength(4);
    fireEvent.click(getByRole('button', { name: 'Go to 2 of 2' }));
    expect(Element.prototype.scrollTo).toHaveBeenCalled();
    fireEvent.click(getByRole('button', { name: 'Next' }));
    expect(outer).not.toHaveBeenCalled();
  });

  it('draws display=grid and display=block boxes, and a scrolling carousel as a moving row', () => {
    const grid = render(<PmlRenderer nodes={[styled({ display: 'grid' })]} site={site} />).container;
    expect(grid.querySelector('[class*="grid-cols"]')).not.toBeNull();

    const block = render(<PmlRenderer nodes={[styled({ display: 'block' })]} site={site} />).container;
    expect(block.querySelector('.block')).not.toBeNull();

    const moving = render(<PmlRenderer nodes={[styled({ display: 'carousel', carousel_motion: 'scroll', carousel_speed: 'fast' })]} site={site} />).container;
    expect(moving.querySelector('[aria-roledescription="moving row"]')).not.toBeNull();
  });

  it('pins a sticky or fixed bar to its edge, and draws a fixed bar sticky inside the builder canvas', () => {
    const fixed = render(<PmlRenderer nodes={[styled({ placement: 'fixed', placement_edge: 'bottom' }, 1)]} site={site} />).container;
    expect(fixed.querySelector('.fixed.bottom-0')).not.toBeNull();

    const sticky = render(<PmlRenderer nodes={[styled({ placement: 'sticky', stacking: 'top' }, 1)]} site={site} />).container;
    expect(sticky.querySelector('.sticky.top-0.z-30')).not.toBeNull();

    const canvas = render(<PmlRenderer nodes={[styled({ placement: 'fixed' }, 1)]} site={site} builderHints />).container;
    expect(canvas.querySelector('.fixed')).toBeNull();
    expect(canvas.querySelector('.sticky')).not.toBeNull();
  });
});
