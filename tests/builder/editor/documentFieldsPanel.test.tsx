import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { DocumentField, DocumentFieldsPort, EditableDocumentAdapter } from '../../../src/builder/document';
import { DocumentFieldsPanel } from '../../../src/builder/editor/DocumentFieldsPanel';
import { PageEditor } from '../../../src/builder/editor/PageEditor';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;

const FIELDS: DocumentField[] = [
  { name: 'title', label: 'Title', kind: 'text', max: 80 },
  { name: 'tags', label: 'Tags', kind: 'list', max: 3 },
  { name: 'published_on', label: 'Publish date', kind: 'date' },
  { name: 'cover', label: 'Cover', kind: 'media' },
  { name: 'featured', label: 'Featured', kind: 'toggle' },
  { name: 'read_minutes', label: 'Read time', kind: 'record', readOnly: true },
];

function port(values: Record<string, unknown> = {}): DocumentFieldsPort & { write: ReturnType<typeof vi.fn> } {
  let n = 1;

  return {
    describe: vi.fn(async () => FIELDS),
    read: vi.fn(async () => ({
      values: { title: 'Work permits in 2026', tags: ['work permits'], published_on: '2026-11-17', cover: { url: 'https://img.test/a.png', alt: '', caption: '' }, featured: false, read_minutes: 4, ...values },
      revision: 'r1',
    })),
    write: vi.fn(async () => ({ revision: `r${++n}` })),
  } as unknown as DocumentFieldsPort & { write: ReturnType<typeof vi.fn> };
}

/** A document's own fields, every kind (blog-on-growth-service S7c). */
describe('DocumentFieldsPanel', () => {
  it('writes each kind through the port, on the revision the last write returned', async () => {
    const fields = port();
    render(<DocumentFieldsPanel id="p1" fields={fields} session="s" />);

    const title = (await screen.findByLabelText('Title')) as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Work permits, explained' } });
    fireEvent.blur(title);
    await waitFor(() => expect(fields.write).toHaveBeenCalledWith('p1', 'title', 'Work permits, explained', 'r1', 's'));

    const tags = screen.getByLabelText('Tags');
    fireEvent.change(tags, { target: { value: 'LMIA' } });
    fireEvent.keyDown(tags, { key: 'Enter' });
    await waitFor(() => expect(fields.write).toHaveBeenLastCalledWith('p1', 'tags', ['work permits', 'LMIA'], 'r2', 's'));

    fireEvent.click(screen.getByRole('switch', { name: 'Featured' }));
    await waitFor(() => expect(fields.write).toHaveBeenLastCalledWith('p1', 'featured', true, 'r3', 's'));

    const alt = screen.getByLabelText('Cover: what it shows');
    fireEvent.change(alt, { target: { value: 'A worker in a greenhouse' } });
    fireEvent.blur(alt);
    await waitFor(() =>
      expect(fields.write).toHaveBeenLastCalledWith('p1', 'cover', { url: 'https://img.test/a.png', alt: 'A worker in a greenhouse', caption: '' }, 'r4', 's'),
    );

    expect(screen.getByText('4')).toBeTruthy();
  });

  it('never writes an unchanged field, and a conflict puts the old value back and offers the latest', async () => {
    const fields = port();
    fields.write.mockResolvedValueOnce({ conflict: { message: 'changed', by: null, at: null, revision: 'r9' } });
    render(<DocumentFieldsPanel id="p1" fields={fields} session="s" />);

    const title = (await screen.findByLabelText('Title')) as HTMLInputElement;
    fireEvent.blur(title);
    expect(fields.write).not.toHaveBeenCalled();

    fireEvent.change(title, { target: { value: 'Someone else wrote this too' } });
    fireEvent.blur(title);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(title.value).toBe('Work permits in 2026');
    expect(screen.getByRole('button', { name: 'Load the latest' })).toBeTruthy();
  });

  it('caps a list at its maximum', async () => {
    render(<DocumentFieldsPanel id="p1" fields={port({ tags: ['a', 'b', 'c'] })} session="s" />);

    expect(((await screen.findByLabelText('Tags')) as HTMLInputElement).disabled).toBe(true);
  });
});

describe('PageEditor slots', () => {
  it('draws the host aside, the document details and the console', async () => {
    const adapter = {
      load: vi.fn(async () => ({ document: { nodes: [] as PmlNode[] }, revision: 'd1', meta: {} })),
      saveDraft: vi.fn(),
      preview: vi.fn(async () => ({ tree: [], natives: null, error: null })),
      preflight: vi.fn(),
      publish: vi.fn(),
      fields: port(),
    } as unknown as EditableDocumentAdapter;

    render(<PageEditor adapter={adapter} id="p1" aside={<p>Layout: Full guide</p>} console={<div role="region" aria-label="Console" />} />);

    // The details slide in over the canvas when asked, the host's aside on top of them.
    fireEvent.click(await screen.findByRole('button', { name: /Details/ }));
    expect(await screen.findByText('Layout: Full guide')).toBeTruthy();
    expect(await screen.findByRole('region', { name: 'Details' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Console' })).toBeTruthy();
  });
});
