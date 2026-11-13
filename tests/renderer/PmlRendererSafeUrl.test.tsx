import React from 'react';
import { render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';

/**
 * The renderer must never sink an unsanitized URL. This guards the live gap that existed before P2b
 * (a button `href` went straight to the DOM) and the contract the later PSL binding leans on.
 */
const site = { theme: {} } as unknown as PublicSite;

function renderNode(node: PmlNode) {
  return render(<PmlRenderer nodes={[node]} site={site} />).container;
}

describe('PmlRenderer sanitizes URL sinks', () => {
  it('neutralizes a javascript: button href to #', () => {
    const c = renderNode({ primitive: 'button', props: { label: 'Click', href: 'javascript:alert(1)' } });
    expect(c.querySelector('a')!.getAttribute('href')).toBe('#');
  });

  it('passes a normal https button href through', () => {
    const c = renderNode({ primitive: 'button', props: { label: 'Book', href: 'https://example.com/book' } });
    expect(c.querySelector('a')!.getAttribute('href')).toBe('https://example.com/book');
  });

  it('keeps a relative button href', () => {
    const c = renderNode({ primitive: 'button', props: { label: 'About', href: '/about' } });
    expect(c.querySelector('a')!.getAttribute('href')).toBe('/about');
  });

  it('neutralizes a javascript: image src to #', () => {
    const c = renderNode({ primitive: 'image', props: { src: 'javascript:alert(1)', alt: 'x' } });
    expect(c.querySelector('img')!.getAttribute('src')).toBe('#');
  });

  it('renders nothing for a video id with a smuggled query', () => {
    const c = renderNode({ primitive: 'video', props: { provider: 'youtube', id: 'abc?evil=1' } });
    expect(c.querySelector('iframe')).toBeNull();
  });

  it('renders a valid video id into the provider embed URL', () => {
    const c = renderNode({ primitive: 'video', props: { provider: 'youtube', id: 'dQw4w9WgXcQ' } });
    const iframe = c.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute('src')).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
  });
});
