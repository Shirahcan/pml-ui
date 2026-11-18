import React from 'react';
import { render } from '@testing-library/react';

import { SectionFrame } from '../../src/renderer/SectionFrame';
import type { PmlNode } from '../../src/pml/primitives';

const cover = { primitive: 'post_cover', props: {} } as unknown as PmlNode;
const heading = { primitive: 'heading', props: { text: 'Hello', level: 2 } } as unknown as PmlNode;

/**
 * A section whose element draws nothing on a live page takes no room (owner 2026-11-18: a post without a cover left a
 * blank gap under its byline). The band carries a rule that hides it while its container is empty.
 */
describe('SectionFrame around an element that draws nothing', () => {
  it('leaves its container empty, which the band hides itself on', () => {
    const { container } = render(<SectionFrame node={cover} render={() => null} />);
    const band = container.firstElementChild as HTMLElement;
    const inner = band.firstElementChild as HTMLElement;

    expect(band.className).toContain('[&:has(>[data-pml-frame]:empty)]:hidden');
    expect(inner.matches(':empty')).toBe(true);
  });

  it('keeps a section that draws something, its container never empty', () => {
    const { container } = render(<SectionFrame node={heading} render={() => <h2>Hello</h2>} />);
    const inner = (container.firstElementChild as HTMLElement).firstElementChild as HTMLElement;

    expect(inner.matches(':empty')).toBe(false);
  });
});
