import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { PANEL_MAX_WIDTH, PANEL_MIN_WIDTH, SlidePanel } from '../../../src/builder/editor/SlidePanel';

/** Owner 2026-11-18: "make side panel wider - especially the element options/config for better UX". */
describe('the slide-in panel width', () => {
  beforeEach(() => window.localStorage.clear());

  const open = (props: Partial<React.ComponentProps<typeof SlidePanel>> = {}) =>
    render(
      <SlidePanel open title="Title" onClose={() => undefined} {...props}>
        <p>Options</p>
      </SlidePanel>,
    );

  it('opens at its default width, never wider than the window', () => {
    open({ defaultWidth: 480 });

    expect((screen.getByRole('complementary', { name: 'Title' }) as HTMLElement).style.width).toBe('min(480px, 100vw)');
  });

  it('resizes from its left edge with the arrow keys, within its limits, and remembers the width per kind', () => {
    const { unmount } = open({ defaultWidth: 480, widthKey: 'test.element' });
    const edge = screen.getByRole('separator', { name: 'Resize the panel' });

    fireEvent.keyDown(edge, { key: 'ArrowLeft' });
    expect((screen.getByRole('complementary') as HTMLElement).style.width).toBe('min(504px, 100vw)');
    unmount();

    // The same kind opens at the width the person chose; another kind keeps its own.
    const again = open({ defaultWidth: 480, widthKey: 'test.element' });
    expect((screen.getByRole('complementary') as HTMLElement).style.width).toBe('min(504px, 100vw)');
    again.unmount();
    open({ defaultWidth: 420, widthKey: 'test.list' });
    expect((screen.getByRole('complementary') as HTMLElement).style.width).toBe('min(420px, 100vw)');
  });

  it('never goes below or above its limits', () => {
    window.localStorage.setItem('test.huge', '5000');
    const { unmount } = open({ widthKey: 'test.huge' });
    expect((screen.getByRole('complementary') as HTMLElement).style.width).toBe(`min(${PANEL_MAX_WIDTH}px, 100vw)`);
    unmount();

    window.localStorage.setItem('test.tiny', '10');
    open({ widthKey: 'test.tiny' });
    expect((screen.getByRole('complementary') as HTMLElement).style.width).toBe(`min(${PANEL_MIN_WIDTH}px, 100vw)`);
  });

  it('a press on its edge does not close it', () => {
    const onClose = vi.fn();
    open({ onClose });

    fireEvent.pointerDown(screen.getByRole('separator', { name: 'Resize the panel' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
