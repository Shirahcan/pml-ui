import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { DocumentLayout, EditableDocumentAdapter } from '../../../src/builder/document';
import { PageEditor } from '../../../src/builder/editor/PageEditor';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;

const resolved = { title: 'Work permits', author_name: 'Portify Editorial Team' };

/** A Classic post's opening: the header part (required), its notes, and one question (a repeat at its minimum). */
const design = [
  { primitive: 'box', part: 'header', children: [{ primitive: 'post_title', props: { resolved } }] },
  { comment: 'Purpose: the opening, built from the post’s own details.' },
  { comment: 'VERIFY: the fee is still $155 on canada.ca.' },
  { primitive: 'heading', part: 'question', props: { text: 'Who can apply?', level: 2 } },
] as unknown as PmlNode[];

const layout: DocumentLayout = {
  parts: [
    { key: 'header', label: 'Header', kind: 'header', required: true },
    { key: 'question', label: 'Question', kind: 'section', min: 1, max: 8 },
  ],
};

function fakeAdapter() {
  let n = 1;

  return {
    load: vi.fn(async () => ({ document: { nodes: design }, revision: 'd1', meta: { title: 'Work permits', slug: 'work-permits', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } })),
    saveDraft: vi.fn(async () => ({ revision: 'd2' })),
    // The real compile drops comments, so the canvas lines its previews up by the non-comment nodes.
    preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes.filter((node) => !('comment' in node)), natives: null, error: null })),
    preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    fields: {
      describe: vi.fn(async () => [
        { name: 'title', label: 'Title', kind: 'text', max: 200, group: { key: 'post', label: 'The post' } },
        { name: 'dek', label: 'Line under the title', kind: 'text', max: 500, group: { key: 'post', label: 'The post' } },
      ]),
      read: vi.fn(async () => ({ values: { title: 'Work permits', dek: '' }, revision: '1' })),
      write: vi.fn(async () => ({ revision: String(++n) })),
    },
  } as unknown as EditableDocumentAdapter & { preview: ReturnType<typeof vi.fn>; saveDraft: ReturnType<typeof vi.fn>; fields: { write: ReturnType<typeof vi.fn> } };
}

describe("a post piece's own panel (owner 2026-11-17: each section offers its own options)", () => {
  it('selecting the title opens its Title field; saving it writes the post, compiles the canvas again and tells the host', async () => {
    const adapter = fakeAdapter();
    const onFieldSaved = vi.fn();
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'post' }} layout={layout} profile="post" onFieldSaved={onFieldSaved} />);

    fireEvent.click(await screen.findByRole('heading', { level: 1, name: 'Work permits' }, { timeout: 3000 }));
    const panel = await screen.findByRole('complementary', { name: 'Title' }, { timeout: 3000 });
    const title = (await within(panel).findByLabelText('Title')) as HTMLInputElement;
    // Only the piece's own field: the line under the title is the other piece's.
    expect(within(panel).queryByLabelText('Line under the title')).toBeNull();

    const compiles = adapter.preview.mock.calls.length;
    fireEvent.change(title, { target: { value: 'Work permits in 2026' } });
    fireEvent.blur(title);

    await waitFor(() => expect(adapter.fields.write).toHaveBeenCalledWith('p1', 'title', 'Work permits in 2026', '1', expect.any(String)));
    await waitFor(() => expect(adapter.preview.mock.calls.length).toBeGreaterThan(compiles), { timeout: 3000 });
    // The host's own chrome (the top bar's title) reads it again.
    expect(onFieldSaved).toHaveBeenCalledWith('title');
  });

  it('a double-click on the title types it where it sits and saves it to the post, never to the design', async () => {
    const adapter = fakeAdapter();
    const onFieldSaved = vi.fn();
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'post' }} layout={layout} profile="post" onFieldSaved={onFieldSaved} />);

    fireEvent.doubleClick(await screen.findByRole('heading', { level: 1, name: 'Work permits' }, { timeout: 3000 }));
    const box = (await screen.findByRole('textbox', { name: 'Edit this text' })) as HTMLTextAreaElement;
    expect(box.value).toBe('Work permits');

    fireEvent.change(box, { target: { value: 'Work permits in 2026' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    // Written at the revision it was read at, so a change made elsewhere meanwhile is refused rather than overwritten.
    await waitFor(() => expect(adapter.fields.write).toHaveBeenCalledWith('p1', 'title', 'Work permits in 2026', '1', expect.any(String)));
    await waitFor(() => expect(onFieldSaved).toHaveBeenCalledWith('title'));
    expect(adapter.saveDraft).not.toHaveBeenCalled();
  });

  it('lets the host compile the canvas again after it changed a field itself, keeping the undo history', async () => {
    const adapter = fakeAdapter();
    let controls = null as import('../../../src/builder/editor/PageEditor').PageEditorControls | null;
    render(
      <PageEditor
        adapter={adapter}
        id="p1"
        labels={{ noun: 'post' }}
        layout={layout}
        renderControls={(c) => {
          controls = c;
          return null;
        }}
      />,
    );
    await screen.findByRole('heading', { level: 1, name: 'Work permits' }, { timeout: 3000 });
    await waitFor(() => expect(adapter.preview).toHaveBeenCalled());
    const compiles = adapter.preview.mock.calls.length;

    controls?.refreshPreview();
    await waitFor(() => expect(adapter.preview.mock.calls.length).toBeGreaterThan(compiles), { timeout: 3000 });
  });

  it("a post's designer draws the canvas in the blog reading look", async () => {
    const adapter = fakeAdapter();
    const withAnswer = [...design, { primitive: 'callout', props: { title: 'Short answer' }, children: [{ primitive: 'p', children: [{ primitive: 'text', props: { value: 'Most can.' } }] }] }];
    (adapter.load as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ document: { nodes: withAnswer }, revision: 'd1', meta: { title: 'Work permits', slug: 'work-permits', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } });
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'post' }} layout={layout} flavor="post" />);

    const key = await screen.findByText('Short answer', {}, { timeout: 3000 });
    expect((key as HTMLElement).style.textTransform).toBe('uppercase');
  });

  it('a required part, a locked part and a repeat at its minimum can all be deleted, and undo brings them back', async () => {
    // Owner 2026-11-18: "don't lock any element/component; admins should be able to modify/remove/etc every element".
    const adapter = fakeAdapter();
    let controls = null as import('../../../src/builder/editor/PageEditor').PageEditorControls | null;
    render(
      <PageEditor
        adapter={adapter}
        id="p1"
        labels={{ noun: 'post' }}
        layout={{ parts: layout.parts.map((part) => (part.key === 'header' ? { ...part, locked: true } : part)) }}
        renderControls={(c) => {
          controls = c;
          return null;
        }}
      />,
    );
    await screen.findByRole('heading', { level: 1, name: 'Work permits' }, { timeout: 3000 });

    fireEvent.click(screen.getByRole('button', { name: /Box, section 1/ }));
    const panel = await screen.findByRole('complementary', { name: 'Section settings' }, { timeout: 3000 });
    expect(within(panel).queryByText(/cannot be deleted/)).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Delete box' }));
    await waitFor(() => expect(screen.queryByRole('heading', { level: 1, name: 'Work permits' })).toBeNull());

    await act(async () => controls?.undo());
    expect(await screen.findByRole('heading', { level: 1, name: 'Work permits' }, { timeout: 3000 })).toBeTruthy();

    // The only question, and the template asks for at least one: still the admin's call.
    fireEvent.click(screen.getByRole('button', { name: /Heading, section 4/ }));
    const again = await screen.findByRole('complementary', { name: 'Section settings' }, { timeout: 3000 });
    fireEvent.click(within(again).getByRole('button', { name: 'Delete heading' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Who can apply?' })).toBeNull());
  });
});

describe('notes on the canvas', () => {
  it('draws the Purpose line quietly and a VERIFY check in amber, removed with one click', async () => {
    const adapter = fakeAdapter();
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'post' }} layout={layout} />);

    expect(await screen.findByText(/Purpose: the opening/, {}, { timeout: 3000 })).toBeTruthy();
    const check = screen.getByRole('note', { name: 'Check before publishing' });
    expect(check.textContent).toContain('the fee is still $155 on canada.ca.');

    fireEvent.click(within(check).getByRole('button', { name: 'Checked, remove note' }));

    await waitFor(() => expect(screen.queryByRole('note', { name: 'Check before publishing' })).toBeNull());
    expect(screen.getByText(/Purpose: the opening/)).toBeTruthy();
    await waitFor(() => expect(adapter.saveDraft).toHaveBeenCalled(), { timeout: 5000 });
    const saved = adapter.saveDraft.mock.calls.at(-1)?.[1] as { nodes: PmlNode[] };
    expect(saved.nodes.map((node) => node.comment ?? node.primitive)).toEqual(['box', 'Purpose: the opening, built from the post’s own details.', 'heading']);
  });
});
