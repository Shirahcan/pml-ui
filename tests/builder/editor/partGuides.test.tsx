import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import type { DocumentLayout } from '../../../src/builder/document';
import { PartGuides, wordCount } from '../../../src/builder/editor/PartGuides';
import type { PmlNode } from '../../../src/pml/primitives';

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
const text = (value: string) => ({ primitive: 'text', props: { value } }) as PmlNode;
const para = (value: string, part?: string) => ({ primitive: 'p', ...(part ? { part } : {}), children: [text(value)] }) as unknown as PmlNode;

const layout: DocumentLayout = {
  parts: [
    { key: 'hook', label: 'Hook', kind: 'fill', rules: { words: { min: 150, max: 200 } } },
    { key: 'section', label: 'Question section', kind: 'repeat', min: 2, starter: [{ primitive: 'box', props: {}, children: [para('[The question]')] } as unknown as PmlNode] },
    { key: 'answer', label: 'Short answer', kind: 'fill', rules: { words: { max: 50 } } },
    { key: 'faq', label: 'Frequently asked questions', kind: 'fill' },
    { key: 'faq-item', label: 'FAQ', kind: 'repeat', min: 1, max: 2, rules: { words: { min: 40, max: 75 } }, starter: [para('[A question] [Its answer]')] },
  ],
};

/** The layout's guides on the canvas (owner 2026-11-17, T2): counts against each part's rule, add and remove a repeat. */
describe('PartGuides', () => {
  it('counts words the way pml-kit does (every reader-facing string, not links or ids)', () => {
    expect(wordCount({ primitive: 'link', props: { href: 'https://x.test/a b', label: 'two words' } } as unknown as PmlNode)).toBe(2);
    expect(wordCount(para(words(7)))).toBe(7);
  });

  it("shows a part's count against its rule, green inside it and red outside", () => {
    const nodes = [para(words(142), 'hook')];
    render(<PartGuides nodes={nodes} index={0} layout={layout} change={() => undefined} />);

    const line = screen.getByText('142 words · aim 150 to 200');
    expect(line.className).toContain('#C62828');
  });

  it('leaves a nested part (a short answer inside a question section) to be counted under itself', () => {
    // Owner 2026-11-18: counts are "placed individually below each item": NestedPartCounters draws this one.
    const nodes = [{ primitive: 'box', part: 'section', children: [para('Who can apply?'), para(words(33), 'answer')] } as unknown as PmlNode, { primitive: 'box', part: 'section', children: [] } as unknown as PmlNode];
    render(<PartGuides nodes={nodes} index={0} layout={layout} change={() => undefined} />);

    expect(screen.queryByText(/33 words/)).toBeNull();
  });

  it('adds another section after the last one, from the starter, and removes the last only above the minimum', () => {
    const nodes = [{ primitive: 'box', part: 'section', children: [] } as unknown as PmlNode, { primitive: 'box', part: 'section', children: [] } as unknown as PmlNode, para('after')];
    const change = vi.fn();
    const { rerender } = render(<PartGuides nodes={nodes} index={1} layout={layout} change={change} />);

    // Two is the minimum: nothing to remove yet.
    expect(screen.queryByRole('button', { name: /Remove last question section/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Add question section/ }));
    const next = change.mock.calls[0][0] as PmlNode[];
    expect(next).toHaveLength(4);
    expect(next[2].children?.[0].children?.[0].props?.value).toBe('[The question]');
    expect(next[2].uid).toBeTruthy();
    expect(next[3].children?.[0].props?.value).toBe('after');

    // The guides draw only under the LAST instance.
    rerender(<PartGuides nodes={nodes} index={0} layout={layout} change={change} />);
    expect(screen.queryByRole('button', { name: /Add question section/ })).toBeNull();
  });

  it('adds and removes a nested repeat inside its container, within its max', () => {
    const faq = { primitive: 'box', part: 'faq', children: [para(words(45), 'faq-item')] } as unknown as PmlNode;
    const change = vi.fn();
    render(<PartGuides nodes={[faq]} index={0} layout={layout} change={change} />);

    fireEvent.click(screen.getByRole('button', { name: /Add faq/ }));
    const next = change.mock.calls[0][0] as PmlNode[];
    expect(next[0].children).toHaveLength(2);
    expect(next[0].children?.[1].part).toBe('faq-item');
  });

  it('offers no add at the maximum, only remove', () => {
    const faq = { primitive: 'box', part: 'faq', children: [para(words(45), 'faq-item'), para(words(50), 'faq-item')] } as unknown as PmlNode;
    const change = vi.fn();
    render(<PartGuides nodes={[faq]} index={0} layout={layout} change={change} />);

    expect(screen.queryByRole('button', { name: /Add faq/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Remove last faq/ }));
    expect((change.mock.calls[0][0] as PmlNode[])[0].children).toHaveLength(1);
  });
});
