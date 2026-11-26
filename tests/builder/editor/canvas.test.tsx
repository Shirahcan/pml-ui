import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { BuilderHostProvider } from '../../../src/builder/editor/host';
import { PmlCanvas } from '../../../src/builder/editor/PmlCanvas';
import type { PmlNode } from '../../../src/language';

const page = [
  { primitive: 'box', props: {}, children: [{ primitive: 'heading', props: { text: 'Welcome', level: 1 } }] },
  { primitive: 'contact_form', props: {} },
] as unknown as PmlNode[];

const base = { site: {}, selectedIndex: null, viewport: 'desktop' as const, onMove: vi.fn(), onDelete: vi.fn() };

/** The canvas in the package (shared program E4a4e): the host's look, its words and its own elements. */
describe('PmlCanvas', () => {
  it('wears the host frame and says how to start in the host words', () => {
    const { container, rerender } = render(<PmlCanvas {...base} nodes={[]} compiled={[]} onSelect={vi.fn()} frame={{ className: 'site-fonts', style: { ['--site-accent' as string]: '#123456' } }} />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('site-fonts');
    // Its own stacking context: an element's bar never draws over the host's docked console (owner 2026-11-18).
    expect(root.className.split(/\s+/)).toContain('isolate');
    expect(root.getAttribute('style')).toContain('--site-accent: #123456');
    // A host's picture of the design finds it by this mark ("Compare with the picture", 0.7.105).
    expect(root.hasAttribute('data-pml-canvas')).toBe(true);
    expect(screen.getByText('Use Add a section in the Actions menu to start building.')).toBeTruthy();

    rerender(
      <BuilderHostProvider assistantName="Porter">
        <PmlCanvas {...base} nodes={[]} compiled={[]} onSelect={vi.fn()} />
      </BuilderHostProvider>,
    );
    expect(screen.getByText('Use Add a section in the Actions menu, or ask Porter, to start building.')).toBeTruthy();
  });

  it('draws each section through the renderer, the host drawing its own elements, and selects on click', () => {
    const onSelect = vi.fn();
    render(
      <BuilderHostProvider renderer={{ elements: { contact_form: () => <form aria-label="Host contact form" /> } }}>
        <PmlCanvas {...base} nodes={page} compiled={page} onSelect={onSelect} />
      </BuilderHostProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Welcome' })).toBeTruthy();
    expect(screen.getByRole('form', { name: 'Host contact form' })).toBeTruthy();

    fireEvent.click(screen.getByRole('heading', { name: 'Welcome' }));
    expect(onSelect).toHaveBeenCalledWith(0);
  });
});
