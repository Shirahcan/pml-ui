import React from 'react';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;
import { fireEvent, render, screen } from '@testing-library/react';

import type { EditableDocumentAdapter } from '../../../src/builder/document';
import { InlineTextOverlay } from '../../../src/builder/editor/InlineTextOverlay';
import { PageEditor } from '../../../src/builder/editor/PageEditor';
import { FieldControl } from '../../../src/builder/editor/settingsFields';
import type { PmlNode } from '../../../src/language';
import { isBracketedExample } from '../../../src/pml/examples';
import { PmlRenderer } from '../../../src/renderer/PmlRenderer';

const GREY = 'rgb(160, 168, 184)';
const rect = { top: 0, left: 0, width: 300, height: 30 };

/** Owner 2026-11-17: a template's example words must never take "tremendous effort to remove or replace". */
describe("a template's bracketed example words", () => {
  it('are recognised only when a value is wholly one example', () => {
    expect(isBracketedExample('[A question readers ask, as they would ask it]')).toBe(true);
    expect(isBracketedExample('  [Column]  ')).toBe(true);
    expect(isBracketedExample('Who can apply [in 2026]')).toBe(false);
    expect(isBracketedExample('[One] and [two]')).toBe(false);
    expect(isBracketedExample(null)).toBe(false);
  });

  it('read grey on the canvas wherever they sit, and are never restyled for readers', () => {
    const nodes = [
      { primitive: 'heading', props: { text: '[A question readers ask, as they would ask it]', level: 2 } },
      { primitive: 'faq', props: { heading: 'Frequently asked questions' }, children: [{ primitive: 'faq_item', props: { question: '[A question readers ask]' }, children: [] }] },
      { primitive: 'table', props: { caption: '[Table: what it compares, and as of when]' }, children: [] },
      { primitive: 'toc', props: { title: 'On this page' }, children: [{ primitive: 'toc_item', props: { label: '[A question readers ask]', target: 'q1' } }] },
    ] as unknown as PmlNode[];

    const canvas = render(<PmlRenderer nodes={nodes} site={{}} builderHints />);
    expect((canvas.getByRole('heading', { level: 2, name: /A question readers ask, as/ }) as HTMLElement).style.color).toBe(GREY);
    expect((canvas.getByText('[A question readers ask]', { selector: 'summary span, span' }) as HTMLElement).style.color).toBe(GREY);
    expect((canvas.container.querySelector('caption') as HTMLElement).style.color).toBe(GREY);
    expect((canvas.container.querySelector('nav a') as HTMLElement).style.color).toBe(GREY);
    canvas.unmount();

    const page = render(<PmlRenderer nodes={nodes} site={{}} />);
    expect([...page.container.querySelectorAll('[style]')].some((e) => (e as HTMLElement).style.color === GREY)).toBe(false);
  });
});

describe('the in-place box over an example', () => {
  it('opens empty with the example as its placeholder; what is typed replaces it in one go', () => {
    const onCommit = vi.fn();
    render(<InlineTextOverlay edit={{ path: [2], field: 'text', value: '[A question readers ask]', rect, font: {} }} onCommit={onCommit} onCancel={() => undefined} />);
    const box = screen.getByRole('textbox', { name: 'Edit this text' }) as HTMLTextAreaElement;

    expect([box.value, box.placeholder]).toEqual(['', '[A question readers ask]']);
    fireEvent.change(box, { target: { value: 'Who can apply?' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('Who can apply?');
  });

  it('left empty, keeps the example: the slot stays unfilled, never blank', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    render(<InlineTextOverlay edit={{ path: [2], field: 'text', value: '[A question readers ask]', rect, font: {} }} onCommit={onCommit} onCancel={onCancel} />);

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Edit this text' }), { key: 'Enter' });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("a settings field holding an example", () => {
  const field = { key: 'text', label: 'Text', kind: 'text' as const };

  it('shows the example as its placeholder; typing replaces it; emptying it puts the example back', () => {
    const onChange = vi.fn();
    const { rerender } = render(<FieldControl field={field} value="[A question readers ask]" onChange={onChange} />);
    const input = screen.getByLabelText('Text') as HTMLInputElement;

    expect([input.value, input.placeholder]).toEqual(['', '[A question readers ask]']);
    fireEvent.change(input, { target: { value: 'W' } });
    expect(onChange).toHaveBeenLastCalledWith('W');

    rerender(<FieldControl field={field} value="W" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('[A question readers ask]');
  });

  it('a field with real words empties as before', () => {
    const onChange = vi.fn();
    render(<FieldControl field={field} value="Who can apply?" onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Text'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith('');
  });
});

describe('a paragraph that is only an example, edited where it sits', () => {
  it('opens the plain box empty with the example as its placeholder, and what is typed becomes the paragraph', async () => {
    const design = [{ primitive: 'p', children: [{ primitive: 'text', props: { value: '[Hook, paragraph 1: who this is for.]' } }] }] as unknown as PmlNode[];
    const adapter = {
      load: vi.fn(async () => ({ document: { nodes: design }, revision: 'd1', meta: { title: 'A post', slug: 'a-post', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } })),
      saveDraft: vi.fn(async () => ({ revision: 'd2' })),
      preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
      preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    } as unknown as EditableDocumentAdapter;
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'post' }} quickEdit />);

    fireEvent.doubleClick(await screen.findByText('[Hook, paragraph 1: who this is for.]', {}, { timeout: 3000 }));
    const box = (await screen.findByRole('textbox', { name: 'Edit this text' })) as HTMLTextAreaElement;
    expect([box.value, box.placeholder]).toEqual(['', '[Hook, paragraph 1: who this is for.]']);

    fireEvent.change(box, { target: { value: 'Most people with a job offer can apply.' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(await screen.findByText('Most people with a job offer can apply.', {}, { timeout: 3000 })).toBeTruthy();
  });
});
