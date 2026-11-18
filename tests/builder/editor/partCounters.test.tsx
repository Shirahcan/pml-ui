import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import type { DocumentLayout, EditableDocumentAdapter } from '../../../src/builder/document';
import { PageEditor } from '../../../src/builder/editor/PageEditor';
import { PartGuides } from '../../../src/builder/editor/PartGuides';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
const para = (value: string, part?: string) => ({ primitive: 'p', ...(part ? { part } : {}), children: [{ primitive: 'text', props: { value } }] }) as unknown as PmlNode;

const layout: DocumentLayout = {
  parts: [
    { key: 'hook', label: 'Hook', kind: 'fill', rules: { words: { min: 150, max: 200 } } },
    { key: 'faq', label: 'Frequently asked questions', kind: 'fill' },
    { key: 'faq-item', label: 'FAQ', kind: 'repeat', min: 1, max: 6, rules: { words: { min: 40, max: 60 } } },
  ],
};

/** Owner 2026-11-18: counters "should use appropriate left padding" and be "placed individually below each item". */
describe('where the word counts sit', () => {
  it("a section's own count sits in the section's content column, not at the canvas edge", () => {
    render(<PartGuides nodes={[para(words(74), 'hook')]} index={0} layout={layout} change={() => undefined} />);
    const column = screen.getByText('74 words · aim 150 to 200').parentElement as HTMLElement;

    for (const name of ['mx-auto', 'container', 'px-4']) expect(column.className).toContain(name);
  });

  it('each nested item is counted directly under itself, with room left under it on the canvas only', async () => {
    const faq = {
      primitive: 'box',
      part: 'faq',
      children: [para(words(45), 'faq-item'), para(words(61), 'faq-item')],
    } as unknown as PmlNode;
    const adapter = {
      load: vi.fn(async () => ({ document: { nodes: [faq] }, revision: 'd1', meta: { title: 'A post', slug: 'a-post', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } })),
      saveDraft: vi.fn(async () => ({ revision: 'd2' })),
      preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
      preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    } as unknown as EditableDocumentAdapter;
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'post' }} layout={layout} />);

    await waitFor(() => expect(document.querySelectorAll('[data-part-counter]')).toHaveLength(2), { timeout: 3000 });
    const counts = [...document.querySelectorAll('[data-part-counter]')].map((c) => [c.getAttribute('data-part-counter'), c.textContent]);
    expect(counts).toEqual([
      ['0.0', '45 words · aim 40 to 60'],
      ['0.1', '61 words · aim 40 to 60'],
    ]);
    // Each counted item keeps room under it so its count never sits on the next item's words.
    expect(document.querySelectorAll('[data-pml-counter-space]')).toHaveLength(2);
    // And none of them is stacked after the whole section any more.
    expect(screen.queryByText(/FAQ: \d+ words/)).toBeNull();
  });
});
