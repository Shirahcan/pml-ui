import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

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
    expect(screen.getByRole('button', { name: /Add a section/ })).toBeTruthy();

    // Nothing slides in until asked (the design keeps its width); Layers slides in over the canvas.
    expect(screen.queryByRole('complementary', { name: 'Layers' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Layers/ }));
    expect(await screen.findByRole('complementary', { name: 'Layers' })).toBeTruthy();
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
    expect(screen.queryByRole('complementary', { name: 'Section settings' })).toBeNull();
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

describe('PageEditor words', () => {
  it("an empty document says so in the host's noun and points at the Add button", async () => {
    const adapter = fakeAdapter({ load: vi.fn(async () => ({ document: { nodes: [] }, revision: 'd1', meta: {} })) } as unknown as Partial<EditableDocumentAdapter>);
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'post' }} />);

    expect(await screen.findByText('This post is empty')).toBeTruthy();
    expect(screen.getByText('Use Add a section below to start it.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Layers/ }));
    expect(await screen.findByText('This post is empty.')).toBeTruthy();
    expect(screen.queryByText(/This page is empty/)).toBeNull();
  });
});

describe('PageEditor panels for every option (owner 2026-11-17: the designer is the sole surface)', () => {
  const grouped = [
    { name: 'title', label: 'Title', kind: 'text', max: 80, group: { key: 'post', label: 'Post' } },
    {
      name: 'facts',
      label: 'Facts this post quotes',
      kind: 'rows',
      max: 2,
      group: { key: 'facts', label: 'Facts' },
      columns: [
        { name: 'text', label: 'Fact', kind: 'text', max: 300 },
        { name: 'review_by', label: 'Check again by', kind: 'date' },
      ],
    },
    { name: 'published_at', label: 'Published', kind: 'date', readOnly: true, group: { key: 'publishing', label: 'Publishing' } },
    { name: 'public_url', label: 'Where readers find it', kind: 'record', readOnly: true, group: { key: 'publishing', label: 'Publishing' } },
  ];

  function fieldsPort() {
    let n = 1;

    return {
      describe: vi.fn(async () => grouped),
      read: vi.fn(async () => ({
        values: { title: 'Work permits', facts: [{ text: 'The fee is $155', review_by: '2027-01-01' }], published_at: '2026-11-17T10:00:00Z', public_url: 'https://example.test/blog/work-permits' },
        revision: '1',
      })),
      write: vi.fn(async () => ({ revision: String(++n) })),
    };
  }

  it('opens one panel per group, each with only its own fields', async () => {
    const fields = fieldsPort();
    render(<PageEditor adapter={fakeAdapter({ fields } as unknown as Partial<EditableDocumentAdapter>)} id="p1" labels={{ noun: 'post' }} />);

    fireEvent.click(await screen.findByRole('button', { name: /Publishing/ }));
    const panel = await screen.findByRole('complementary', { name: 'Publishing' });
    expect(await screen.findByText('Where readers find it')).toBeTruthy();
    expect(screen.queryByLabelText('Title')).toBeNull();
    // Facts the product sets read as words: a date, and an address that opens in a new tab.
    expect(panel.querySelector('input[name="published_at"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'https://example.test/blog/work-permits' }).getAttribute('target')).toBe('_blank');

    // The panel's own pills switch groups without going back to the menu.
    fireEvent.click(within(panel).getByRole('button', { name: 'Post' }));
    expect(await screen.findByLabelText('Title')).toBeTruthy();
    expect(within(screen.getByRole('complementary', { name: 'Post' })).getByRole('button', { name: 'Post' }).getAttribute('aria-current')).toBe('page');
  });

  it('edits rows as a whole list: a changed cell, a new row, a removal that asks first', async () => {
    const fields = fieldsPort();
    render(<PageEditor adapter={fakeAdapter({ fields } as unknown as Partial<EditableDocumentAdapter>)} id="p1" labels={{ noun: 'post' }} />);

    fireEvent.click(await screen.findByRole('button', { name: /Facts/ }));
    const fact = (await screen.findByLabelText('Fact')) as HTMLTextAreaElement;
    expect(fact.tagName).toBe('TEXTAREA');
    fireEvent.change(fact, { target: { value: 'The fee is $255' } });
    fireEvent.blur(fact);
    await waitFor(() => expect(fields.write).toHaveBeenCalledWith('p1', 'facts', [{ text: 'The fee is $255', review_by: '2027-01-01' }], '1', expect.any(String)));

    // A new row shows at once and saves only once something is written in it.
    fireEvent.click(screen.getByRole('button', { name: 'Add one' }));
    expect(screen.getAllByLabelText('Fact')).toHaveLength(2);
    expect(fields.write).toHaveBeenCalledTimes(1);
    // Two is the limit.
    expect((screen.getByRole('button', { name: 'Up to 2' }) as HTMLButtonElement).disabled).toBe(true);

    // Removing the saved row writes the list without it; the blank new row is never written.
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);
    expect(await screen.findByRole('alertdialog', { name: 'Remove this one?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(fields.write).toHaveBeenLastCalledWith('p1', 'facts', [], '2', expect.any(String)));
    expect(fields.write).toHaveBeenCalledTimes(2);
  });

  it('offers Unpublish only while the document is live, and asks first', async () => {
    const unpublish = vi.fn(async () => undefined);
    const onUnpublished = vi.fn();
    const { unmount } = render(<PageEditor adapter={fakeAdapter({ unpublish } as unknown as Partial<EditableDocumentAdapter>)} id="p1" labels={{ noun: 'post' }} />);
    await screen.findByRole('button', { name: /Publish/ });
    expect(screen.queryByRole('button', { name: 'Unpublish' })).toBeNull();
    unmount();

    render(
      <BuilderHostProvider>
        <PageEditor adapter={fakeAdapter({ unpublish } as unknown as Partial<EditableDocumentAdapter>)} id="p1" live onUnpublished={onUnpublished} labels={{ noun: 'post' }} />
      </BuilderHostProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Unpublish' }));
    expect(await screen.findByRole('alertdialog', { name: 'Take this post off the site?' })).toBeTruthy();
    expect(unpublish).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: 'Unpublish' }).at(-1)!);
    await waitFor(() => expect(unpublish).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(onUnpublished).toHaveBeenCalled());
  });
});

describe('PageEditor host panels', () => {
  it("draws a host's own panel over the canvas and hands it the editor's save", async () => {
    const seen: { flush?: () => Promise<boolean> } = {};
    render(
      <PageEditor
        adapter={fakeAdapter()}
        id="p1"
        panels={[
          {
            key: 'help',
            title: 'Help from Porter',
            render: (controls) => {
              seen.flush = controls.flush;
              return <p>Prepare a LinkedIn version</p>;
            },
          },
        ]}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Help from Porter' }));
    expect(await screen.findByRole('complementary', { name: 'Help from Porter' })).toBeTruthy();
    expect(screen.getByText('Prepare a LinkedIn version')).toBeTruthy();
    await expect(seen.flush?.()).resolves.toBe(true);
  });
});
