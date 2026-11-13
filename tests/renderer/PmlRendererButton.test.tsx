import React from 'react';
import { render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';

/**
 * A button renders as a navigation LINK (<a>) only when it has an href. A labelled button with NO
 * href is an ACTION button (it triggers a <script> via an on-<event> handler, never navigates) and
 * MUST render a real <button> - otherwise a script-trigger button could never appear on the page.
 * This guards the live gap that hid every hrefless interactive button (surfaced by the Code-view
 * round-trip work: `<button label="Welcome" on-click="toggleWelcome"/>` rendered nothing).
 */
const site = { theme: {} } as unknown as PublicSite;

function renderNode(node: PmlNode) {
  return render(<PmlRenderer nodes={[node]} site={site} />).container;
}

describe('PmlRenderer button: link vs action', () => {
  it('renders an <a> for a button that has an href', () => {
    const c = renderNode({ primitive: 'button', props: { label: 'Book', href: '/book' } });
    const a = c.querySelector('a');
    expect(a).not.toBeNull();
    expect(a!.textContent).toBe('Book');
    expect(c.querySelector('button')).toBeNull();
  });

  it('renders a real <button> for a labelled action button with NO href', () => {
    const c = renderNode({
      primitive: 'button',
      props: { label: 'Welcome' },
      on: { click: { $expr: 'toggleWelcome', ast: { type: 'Identifier', name: 'toggleWelcome', line: 1, col: 1 } as never } },
    });
    const btn = c.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute('type')).toBe('button');
    expect(btn!.textContent).toBe('Welcome');
    expect(c.querySelector('a')).toBeNull();
  });

  it('renders a <button> for a hrefless labelled button even without a handler', () => {
    const c = renderNode({ primitive: 'button', props: { label: 'Go' } });
    expect(c.querySelector('button')!.textContent).toBe('Go');
  });

  it('renders nothing for a button with no label', () => {
    const c = renderNode({ primitive: 'button', props: { href: '/x' } });
    expect(c.querySelector('a')).toBeNull();
    expect(c.querySelector('button')).toBeNull();
  });
});
