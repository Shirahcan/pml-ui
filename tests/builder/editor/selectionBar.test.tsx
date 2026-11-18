import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { DocumentLayout, EditableDocumentAdapter } from '../../../src/builder/document';
import { canDelete, canReorder, reorder } from '../../../src/builder/editor/layoutParts';
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

    // It may go above the opening too (owner 2026-11-18: nothing is locked; the publish checks advise on order).
    expect((screen.getByRole('button', { name: 'Move this question section up' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Move this question section down' }));

    const next = change.mock.calls[0][0] as PmlNode[];
    expect(next.map((node) => node.comment ?? node.props?.text ?? node.primitive)).toEqual(['box', purpose.comment, 'What does it cost?', purpose.comment, 'Who can apply?', 'faq']);
    expect(select).toHaveBeenCalledWith([4]);
  });

  it('moves a nested repeat inside its parent, and removes it even at the template minimum (a publish check, not a lock)', () => {
    const change = vi.fn();
    render(<SelectionBar nodes={design} path={[5, 1]} layout={layout} change={change} select={() => undefined} />);

    // Two FAQ items and the template asks for two: removing one is still the admin's call (owner 2026-11-18).
    expect((screen.getByRole('button', { name: 'Remove this faq item' }) as HTMLButtonElement).disabled).toBe(false);
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

  it('a required, locked part that does not repeat still moves and can be removed (owner 2026-11-18)', () => {
    const change = vi.fn();
    render(<SelectionBar nodes={design} path={[0]} layout={layout} change={change} select={() => undefined} />);

    expect(screen.getByRole('toolbar').textContent).toContain('01 · Opening');
    expect((screen.getByRole('button', { name: 'Move this opening down' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Remove this opening' }));
    expect((change.mock.calls[0][0] as PmlNode[]).some((node) => node.part === 'header')).toBe(false);
  });
});

describe('what may be deleted, by the layout', () => {
  it('every element may be deleted, required and locked parts and the pieces inside them included (owner 2026-11-18)', () => {
    for (const path of [[0], [0, 0], [2], [5, 0], [1]]) expect(canDelete(design, layout, path)).toBe(true);
  });

  it('every element may be moved and dragged', () => {
    for (const path of [[0], [0, 0], [2], [1]]) expect(canReorder(design, layout, path)).toBe(true);
  });
});

describe("reordering lives in the bar and the panel, never under the slide-in (owner 2026-11-17)", () => {
  const withFree = [...design, { primitive: 'heading', props: { text: 'An extra note', level: 2 } }] as unknown as PmlNode[];
  const open = () => {
    const adapter = {
      load: vi.fn(async () => ({ document: { nodes: withFree }, revision: 'd1', meta: { title: 'Work permits', slug: 'work-permits', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } })),
      saveDraft: vi.fn(async () => ({ revision: 'd2' })),
      preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes.filter((node) => !('comment' in node)), natives: null, error: null })),
      preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    } as unknown as EditableDocumentAdapter;
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'post' }} layout={layout} />);
  };

  it("draws no move or delete buttons in a section's top-right corner (the panel covered them)", async () => {
    open();
    fireEvent.click(await screen.findByRole('heading', { name: 'Who can apply?' }, { timeout: 3000 }));
    await screen.findByRole('toolbar', { name: 'Question section tools' }, { timeout: 3000 });

    for (const section of document.querySelectorAll('[data-pml-section]')) {
      expect(within(section as HTMLElement).queryByRole('button', { name: /^(Move up|Move down|Delete section)$/ })).toBeNull();
    }
  });

  it('the panel offers Move up / Move down by the same rule as the bar, and a move is made from it', async () => {
    open();
    fireEvent.click(await screen.findByRole('heading', { name: 'Who can apply?' }, { timeout: 3000 }));
    const position = await screen.findByRole('group', { name: 'Position' }, { timeout: 3000 });

    // A template part moves past the opening too (owner 2026-11-18: nothing is locked).
    expect((within(position).getByRole('button', { name: /Move up/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(within(position).getByRole('button', { name: /Move down/ }));

    await waitFor(() => {
      const order = [...document.querySelectorAll('[data-pml-section] h2')].map((h) => h.textContent);
      expect(order.indexOf('What does it cost?')).toBeLessThan(order.indexOf('Who can apply?'));
    });
  });

  it('an element alone in its parent has nowhere to move; every other one moves', async () => {
    open();
    fireEvent.click(await screen.findByRole('heading', { name: 'An extra note' }, { timeout: 3000 }));
    const bar = await screen.findByRole('toolbar', { name: 'Heading tools' }, { timeout: 3000 });
    expect((within(bar).getByRole('button', { name: 'Move this heading up' }) as HTMLButtonElement).disabled).toBe(false);

    // The title is the opening's only piece here: no sibling to change places with.
    fireEvent.click(screen.getByRole('heading', { level: 1, name: 'Work permits' }));
    await screen.findByRole('toolbar', { name: 'Title tools' }, { timeout: 3000 });
    expect(screen.queryByRole('group', { name: 'Position' })).toBeNull();
  });

  it('shows the bar for the element under the pointer, not only the selected one', async () => {
    open();
    fireEvent.mouseMove(await screen.findByRole('heading', { name: 'An extra note' }, { timeout: 3000 }));

    expect(await screen.findByRole('toolbar', { name: 'Heading tools' }, { timeout: 3000 })).toBeTruthy();
  });
});

describe('every element moves (owner 2026-11-18: no element is locked)', () => {
  const c = (n: number) => ({ comment: `Purpose: note ${n}.` });
  const q = (text: string) => ({ primitive: 'heading', part: 'section', props: { text, level: 2 } });
  // header, note, Q1, note, DATA, note, Q2, faq
  const page = [
    { primitive: 'box', part: 'header', children: [] },
    c(1),
    q('Q1'),
    c(2),
    { primitive: 'table', part: 'data', props: {} },
    c(3),
    q('Q2'),
    { primitive: 'faq', part: 'faq', children: [] },
  ] as unknown as PmlNode[];
  const ranges: DocumentLayout = {
    parts: [
      { key: 'header', label: 'Opening', kind: 'header', required: true, locked: true },
      { key: 'section', label: 'Question section', kind: 'repeat', min: 1 },
      { key: 'data', label: 'Data table', kind: 'fill', moves_within: 'section' },
      { key: 'faq', label: 'FAQ', kind: 'faq' },
    ],
  };
  const words = (nodes: PmlNode[]) => nodes.map((n) => n.comment ?? n.props?.text ?? n.part);

  it('a block with a range may leave it: the publish checks advise, the designer never refuses', () => {
    const up = reorder(page, ranges, [4], -1)!;

    expect(words(up.nodes)).toEqual(['header', 'Purpose: note 1.', 'data', 'Purpose: note 2.', 'Q1', 'Purpose: note 3.', 'Q2', 'faq']);
    expect(up.path).toEqual([2]);
  });

  it('a step skips the comments (they draw nothing), so every click visibly moves the element', () => {
    const down = reorder(page, ranges, [2], 1)!;

    expect(words(down.nodes).slice(0, 5)).toEqual(['header', 'Purpose: note 1.', 'data', 'Purpose: note 2.', 'Q1']);
    expect(down.path).toEqual([4]);
  });

  it('a required, locked part moves too, and stops only at an edge', () => {
    expect(reorder(page, ranges, [0], 1)!.path).toEqual([2]);
    expect(reorder(page, ranges, [0], -1)).toBeNull();
    expect(reorder(page, ranges, [7], 1)).toBeNull();
  });
});

describe("the hover bar over words (owner 2026-11-17: over text it never showed, and it flickered)", () => {
  it("hovering a paragraph's words shows the PARAGRAPH's bar, visible, and moving onto its empty space keeps it", async () => {
    const words = [{ primitive: 'p', children: [{ primitive: 'text', props: { value: 'Most people with a job offer can apply.' } }] }] as unknown as PmlNode[];
    const adapter = {
      load: vi.fn(async () => ({ document: { nodes: words }, revision: 'd1', meta: { title: 'A post', slug: 'a-post', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } })),
      saveDraft: vi.fn(async () => ({ revision: 'd2' })),
      preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
      preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    } as unknown as EditableDocumentAdapter;
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'post' }} />);

    // The pointer over the words lands on the run's own marker, which draws no box.
    const text = await screen.findByText('Most people with a job offer can apply.', {}, { timeout: 3000 });
    fireEvent.mouseMove(text);
    const bar = await screen.findByRole('toolbar', { name: 'Paragraph tools' }, { timeout: 3000 });
    expect((bar.parentElement as HTMLElement).style.visibility).toBe('visible');

    fireEvent.mouseMove(text.closest('p') as HTMLElement);
    expect(screen.getByRole('toolbar', { name: 'Paragraph tools' })).toBe(bar);
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
