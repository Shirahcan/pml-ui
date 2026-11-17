import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import type { DocumentLayout, EditableDocumentAdapter } from '../../../src/builder/document';
import { canDelete, canReorder } from '../../../src/builder/editor/layoutParts';
import { PageEditor } from '../../../src/builder/editor/PageEditor';
import { SelectionBar } from '../../../src/builder/editor/SelectionBar';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;

const question = (text: string) => ({ primitive: 'heading', part: 'question', props: { text, level: 2 } });
const purpose = { comment: 'Purpose: a question readers ask.' };

/** Two question sections, each after its Purpose note, and an FAQ holding two repeat items (nested). */
const design = [
  { primitive: 'box', part: 'header', children: [{ primitive: 'post_title', props: { resolved: { title: 'Work permits' } } }] },
  purpose,
  question('Who can apply?'),
  purpose,
  question('What does it cost?'),
  {
    primitive: 'faq',
    part: 'faq',
    children: [
      { primitive: 'faq_item', part: 'faq_item', props: { question: 'Can I work while I wait?' } },
      { primitive: 'faq_item', part: 'faq_item', props: { question: 'How long does it take?' } },
    ],
  },
] as unknown as PmlNode[];

const layout: DocumentLayout = {
  parts: [
    { key: 'header', label: 'Opening', kind: 'header', required: true, locked: true },
    { key: 'question', label: 'Question section', kind: 'repeat', min: 1, max: 8 },
    { key: 'faq', label: 'FAQ', kind: 'faq', required: true },
    { key: 'faq_item', label: 'FAQ item', kind: 'repeat', min: 2, max: 6 },
  ],
};

describe('the selection bar (owner 2026-11-17, the reference studio)', () => {
  it('names the selected part with its number, and hands the assistant a scoped ask without calling anything', () => {
    const onAsk = vi.fn();
    render(<SelectionBar nodes={design} path={[2]} layout={layout} change={() => undefined} select={() => undefined} onAsk={onAsk} />);
    const bar = screen.getByRole('toolbar', { name: 'Question section tools' });

    expect(bar.textContent).toContain('03 · Question section · 1 of 2');
    fireEvent.click(within(bar).getByRole('button', { name: /AI write/ }));
    fireEvent.click(within(bar).getByRole('button', { name: /AI suggest/ }));
    expect(onAsk.mock.calls.map(([ask]) => [ask.kind, ask.path, ask.label])).toEqual([
      ['write', [2], 'Question section'],
      ['suggest', [2], 'Question section'],
    ]);
  });

  it('offers no assistant asks when the host has none', () => {
    render(<SelectionBar nodes={design} path={[2]} layout={layout} change={() => undefined} select={() => undefined} />);

    expect(screen.queryByRole('button', { name: /AI write/ })).toBeNull();
  });

  it('moves a repeat instance by swapping it with the next one, so each Purpose note stays put', () => {
    const change = vi.fn();
    const select = vi.fn();
    render(<SelectionBar nodes={design} path={[2]} layout={layout} change={change} select={select} />);

    expect((screen.getByRole('button', { name: 'Move this question section up' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Move this question section down' }));

    const next = change.mock.calls[0][0] as PmlNode[];
    expect(next.map((node) => node.comment ?? node.props?.text ?? node.primitive)).toEqual(['box', purpose.comment, 'What does it cost?', purpose.comment, 'Who can apply?', 'faq']);
    expect(select).toHaveBeenCalledWith([4]);
  });

  it('moves a nested repeat inside its parent, and keeps it at its minimum', () => {
    const change = vi.fn();
    render(<SelectionBar nodes={design} path={[5, 1]} layout={layout} change={change} select={() => undefined} />);

    // Two FAQ items, and the template needs two: none may go.
    expect((screen.getByRole('button', { name: 'Remove this faq item' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Move this faq item up' }));
    const faq = (change.mock.calls[0][0] as PmlNode[])[5];
    expect(faq.children?.map((item) => item.props?.question)).toEqual(['How long does it take?', 'Can I work while I wait?']);
  });

  it("offers no assistant asks on a post piece: its words are the post's fields, not design text", () => {
    const pieces = [{ primitive: 'post_title', props: { resolved: { title: 'Work permits' } } }] as unknown as PmlNode[];
    render(<SelectionBar nodes={pieces} path={[0]} change={() => undefined} select={() => undefined} onAsk={vi.fn()} />);

    expect(screen.getByRole('toolbar').textContent).toContain('01 · Title');
    expect(screen.queryByRole('button', { name: /AI write/ })).toBeNull();
  });

  it('offers no assistant asks on the opening either: a block made only of post pieces', () => {
    render(<SelectionBar nodes={design} path={[0]} layout={layout} change={() => undefined} select={() => undefined} onAsk={vi.fn()} />);

    expect(screen.getByRole('toolbar').textContent).toContain('01 · Opening');
    expect(screen.queryByRole('button', { name: /AI write/ })).toBeNull();
  });

  it("follows the host's own rule when it gives one (its assistant drafts the title, not the author)", () => {
    const pieces = [{ primitive: 'post_title', props: {} }, { primitive: 'post_author', props: {} }] as unknown as PmlNode[];
    const canAsk = (node: PmlNode) => node.primitive === 'post_title';
    const { unmount } = render(<SelectionBar nodes={pieces} path={[0]} change={() => undefined} select={() => undefined} onAsk={vi.fn()} canAsk={canAsk} />);
    expect(screen.getByRole('button', { name: /AI write/ })).toBeTruthy();
    unmount();

    render(<SelectionBar nodes={pieces} path={[1]} change={() => undefined} select={() => undefined} onAsk={vi.fn()} canAsk={canAsk} />);
    expect(screen.queryByRole('button', { name: /AI write/ })).toBeNull();
  });

  it('shows no repeat controls for a part that does not repeat', () => {
    render(<SelectionBar nodes={design} path={[0]} layout={layout} change={() => undefined} select={() => undefined} />);

    expect(screen.getByRole('toolbar').textContent).toContain('01 · Opening');
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });
});

describe('what may be deleted, by the layout', () => {
  it('an element follows its OWN part first, nested repeats included; inside a locked part nothing goes', () => {
    expect(canDelete(design, layout, [0])).toBe(false); // the opening: required and locked
    expect(canDelete(design, layout, [0, 0])).toBe(false); // the title, inside the locked opening
    expect(canDelete(design, layout, [2])).toBe(true); // two questions, one is enough
    expect(canDelete(design, layout, [5, 0])).toBe(false); // two FAQ items, two are needed
    expect(canDelete(design, layout, [1])).toBe(true); // a note is no part
  });

  it('a template part, and anything inside a locked part, keeps its place; everything else moves freely', () => {
    expect(canReorder(design, layout, [0])).toBe(false); // the opening
    expect(canReorder(design, layout, [0, 0])).toBe(false); // the title inside the locked opening
    expect(canReorder(design, layout, [2])).toBe(false); // a question section moves only with its bar's Up / Down
    expect(canReorder(design, layout, [1])).toBe(true); // a note
  });
});

describe("a template part keeps its place on the canvas (ab's Loop 2: the cover offered Move up / Move down)", () => {
  it('a part offers no frame moves; an element the author added freely still moves', async () => {
    const withFree = [...design, { primitive: 'heading', props: { text: 'An extra note', level: 2 } }] as unknown as PmlNode[];
    const adapter = {
      load: vi.fn(async () => ({ document: { nodes: withFree }, revision: 'd1', meta: { title: 'Work permits', slug: 'work-permits', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } })),
      saveDraft: vi.fn(async () => ({ revision: 'd2' })),
      preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes.filter((node) => !('comment' in node)), natives: null, error: null })),
      preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    } as unknown as EditableDocumentAdapter;
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'post' }} layout={layout} />);

    fireEvent.click(await screen.findByRole('heading', { name: 'Who can apply?' }, { timeout: 3000 }));
    await screen.findByRole('toolbar', { name: 'Question section tools' }, { timeout: 3000 });
    expect(screen.queryByRole('button', { name: 'Move up' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move down' })).toBeNull();

    fireEvent.click(screen.getByRole('heading', { name: 'An extra note' }));
    expect(await screen.findByRole('button', { name: 'Move up' }, { timeout: 3000 })).toBeTruthy();
  });
});

describe('the bar on the canvas', () => {
  it('draws over the selected section and reaches the host', async () => {
    const onAskAssistant = vi.fn();
    const adapter = {
      load: vi.fn(async () => ({ document: { nodes: design }, revision: 'd1', meta: { title: 'Work permits', slug: 'work-permits', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } })),
      saveDraft: vi.fn(async () => ({ revision: 'd2' })),
      preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes.filter((node) => !('comment' in node)), natives: null, error: null })),
      preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    } as unknown as EditableDocumentAdapter;
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'post' }} layout={layout} onAskAssistant={onAskAssistant} />);

    fireEvent.click(await screen.findByRole('heading', { name: 'Who can apply?' }, { timeout: 3000 }));
    const bar = await screen.findByRole('toolbar', { name: 'Question section tools' }, { timeout: 3000 });
    fireEvent.click(within(bar).getByRole('button', { name: /AI suggest/ }));

    expect(onAskAssistant).toHaveBeenCalledWith(expect.objectContaining({ kind: 'suggest', path: [2], label: 'Question section' }));
  });
});
