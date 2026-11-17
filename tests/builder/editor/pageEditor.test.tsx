import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { EditableDocumentAdapter } from '../../../src/builder/document';
import { BuilderHostProvider } from '../../../src/builder/editor/host';
import { PageEditor } from '../../../src/builder/editor/PageEditor';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;

const design = [{ primitive: 'heading', props: { text: 'Who can apply', level: 2 } }] as unknown as PmlNode[];

function fakeAdapter(extra: Partial<EditableDocumentAdapter> = {}) {
  return {
    load: vi.fn(async () => ({ document: { nodes: design }, revision: 'd1', meta: { title: 'A post', slug: 'a-post', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } })),
    saveDraft: vi.fn(async () => ({ revision: 'd2' })),
    preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
    preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    publish: vi.fn(async () => ({ published: true as const, url: null })),
    ...extra,
  } as unknown as EditableDocumentAdapter & Record<string, ReturnType<typeof vi.fn>>;
}

/** The page editor on any document adapter (blog-on-growth-service S7a, shared program E4a4i). */
describe('PageEditor', () => {
  it('opens the document, draws it, and lists its layers when nothing is selected', async () => {
    render(<PageEditor adapter={fakeAdapter()} id="p1" labels={{ noun: 'post' }} />);

    expect(await screen.findByRole('heading', { name: 'Who can apply' }, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Layers and checks' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add a section/ })).toBeTruthy();
  });

  it('shows what a refused publish found', async () => {
    const adapter = fakeAdapter({
      publish: vi.fn(async () => ({ refused: { mayPublish: false, findings: [{ source: 'layout', severity: 'block' as const, rule: 'missing_part', message: 'The post needs its call to action.', excerpt: null, suggestion: null }] } })),
    });
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'post' }} />);

    const publish = await screen.findByRole('button', { name: /Publish/ });
    await act(async () => {
      fireEvent.click(publish);
    });
    expect(await screen.findByText('The post needs its call to action.')).toBeTruthy();
  });

  it('offers Throw away the draft only with a rollback port, and asks first', async () => {
    const { unmount } = render(<PageEditor adapter={fakeAdapter()} id="p1" />);
    await screen.findByRole('button', { name: /Publish/ });
    expect(screen.queryByRole('button', { name: /Throw away the draft/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Copy preview link/ })).toBeNull();
    unmount();

    const rollback = vi.fn(async () => ({ revision: 'd0' }));
    render(
      <BuilderHostProvider>
        <PageEditor adapter={fakeAdapter({ rollback })} id="p1" labels={{ noun: 'post', rolledBackMessage: 'The draft was thrown away.' }} />
      </BuilderHostProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Throw away the draft/ }));
    expect(await screen.findByRole('alertdialog', { name: 'Throw away the draft?' })).toBeTruthy();
    expect(rollback).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Throw it away' }));
    await waitFor(() => expect(rollback).toHaveBeenCalledWith('p1'));
  });

  it('says it could not open the document and tries again', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ document: { nodes: design }, revision: 'd1', meta: {} });
    render(
      <BuilderHostProvider onError={() => undefined}>
        <PageEditor adapter={fakeAdapter({ load } as Partial<EditableDocumentAdapter>)} id="p1" labels={{ noun: 'post' }} />
      </BuilderHostProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /Publish/ })).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });
});

/** Quick edits, the code view and media in the page editor (blog-on-growth-service S7b). */
describe('PageEditor quick edits and code', () => {
  const words = [
    { primitive: 'heading', props: { text: 'Who can apply', level: 2 } },
    { primitive: 'p', children: [{ primitive: 'text', props: { value: 'Most people with a job offer can apply.' } }] },
  ] as unknown as PmlNode[];

  const rangeProto = Range.prototype as unknown as Record<string, unknown>;
  const had = { rects: rangeProto.getClientRects, box: rangeProto.getBoundingClientRect };
  beforeAll(() => {
    rangeProto.getClientRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] });
    rangeProto.getBoundingClientRect = () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) });
  });
  afterAll(() => {
    rangeProto.getClientRects = had.rects;
    rangeProto.getBoundingClientRect = had.box;
  });

  it('a double-click edits words in place and the section settings stay closed', async () => {
    const adapter = fakeAdapter({ load: vi.fn(async () => ({ document: { nodes: words }, revision: 'd1', meta: {} })) } as unknown as Partial<EditableDocumentAdapter>);
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'post' }} quickEdit />);
    const paragraph = await screen.findByText('Most people with a job offer can apply.', undefined, { timeout: 3000 });

    fireEvent.click(paragraph);
    fireEvent.click(paragraph);
    fireEvent.doubleClick(paragraph);

    expect(await screen.findByRole('toolbar', { name: 'Format these words' })).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Layers and checks' })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('toolbar', { name: 'Format these words' }), { key: 'Escape' });
    await act(() => new Promise((resolve) => setTimeout(resolve, 350)));
    expect(screen.queryByRole('button', { name: /Delete section/ })).toBeNull();
  });

  it('offers the code view only when the document has code', async () => {
    const { unmount } = render(<PageEditor adapter={fakeAdapter()} id="p1" />);
    await screen.findByRole('button', { name: /Publish/ });
    expect(screen.queryByRole('button', { name: 'Code' })).toBeNull();
    unmount();

    const code = { source: vi.fn(async () => '<heading text="Who can apply" level="2" />'), parse: vi.fn(), parseLive: vi.fn(async () => ({ nodes: design, error: null })) };
    render(<PageEditor adapter={fakeAdapter({ code } as Partial<EditableDocumentAdapter>)} id="p1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Code' }));
    await waitFor(() => expect(code.source).toHaveBeenCalledWith('p1'));
    expect(await screen.findByRole('button', { name: /Back to the design/ })).toBeTruthy();
  });
});
