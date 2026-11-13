import React from 'react';
import { render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';

/**
 * B2: a first-class comment node ({comment: text}) never renders. The compiled tree already drops
 * comments, but the renderer also skips one directly, so any path that renders the stored AST is safe.
 */
const site = { theme: {} } as unknown as PublicSite;

describe('PmlRenderer: comment nodes', () => {
  it('renders no visible content for a lone comment node and does not crash', () => {
    const c = render(<PmlRenderer nodes={[{ comment: ' a note ' } as PmlNode]} site={site} />).container;

    // The renderer always emits a <MotionStyles> <style> tag, so the container is not literally empty;
    // what matters is that the comment produces NO visible element and NO text of its own.
    expect(c.querySelector('h1, h2, h3, h4, p, section, button, ul, ol, table, figure, hr, img')).toBeNull();
    expect(c.textContent).not.toContain('a note');
  });

  it('skips a comment and still renders its siblings', () => {
    const nodes: PmlNode[] = [
      { comment: ' hero below ' },
      { primitive: 'heading', props: { text: 'Study in Canada', level: 2 } },
    ];

    const c = render(<PmlRenderer nodes={nodes} site={site} />).container;

    expect(c.textContent).not.toContain('hero below');
    expect(c.querySelector('h2')?.textContent).toBe('Study in Canada');
  });

  it('skips a comment nested among children', () => {
    const nodes: PmlNode[] = [
      {
        primitive: 'box',
        children: [
          { comment: ' inner note ' },
          { primitive: 'heading', props: { text: 'Hi', level: 3 } },
        ],
      },
    ];

    const c = render(<PmlRenderer nodes={nodes} site={site} />).container;

    expect(c.textContent).not.toContain('inner note');
    expect(c.querySelector('h3')?.textContent).toBe('Hi');
  });
});
