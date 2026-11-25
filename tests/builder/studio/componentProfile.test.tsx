import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { DocumentAdapter } from '../../../src/builder/document';
import { Studio } from '../../../src/builder/editor/PageEditor';
import { BuilderHostProvider } from '../../../src/builder/editor/host';
import { refusalRow } from '../../../src/builder/studio/profiles/component';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;
Element.prototype.hasPointerCapture ??= () => false;

const design = [
  { primitive: 'box', uid: 'box111', props: {}, children: [{ primitive: 'heading', uid: 'hd2222', props: { text: { $expr: 'props.title' }, level: 2 } }] },
] as unknown as PmlNode[];

type Write = (id: string, settings: unknown, revision: string) => Promise<{ revision: string } | { refused: { field: string; text: string } }>;

function componentAdapter(write = vi.fn<Write>(async (_id, _settings, revision) => ({ revision: `${revision}+s` }))) {
  const settings = {
    read: vi.fn(async () => ({ settings: [{ name: 'title', label: 'Title', kind: 'text' as const, default: 'Counter' }], revision: 'd1' })),
    write,
  };
  const adapter = {
    load: vi.fn(async () => ({ document: { nodes: design }, revision: 'd1', meta: {} })),
    saveDraft: vi.fn(async () => ({ revision: 'd2' })),
    preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
    preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    publish: vi.fn(),
    settings,
  } as unknown as DocumentAdapter & { settings: typeof settings };

  return adapter;
}

function open(adapter: DocumentAdapter, profile: 'component' | 'page' = 'component') {
  render(
    <BuilderHostProvider>
      <Studio adapter={adapter} id="c1" profile={profile} labels={{ noun: 'component' }} />
    </BuilderHostProvider>,
  );
}

/** The Studio on the component profile (shared PML Studio P3c-6): the one element on the canvas, its settings in a panel. */
describe('Studio profile="component"', () => {
  it('offers a Settings panel that reads the settings and saves a change in the same draft', async () => {
    const adapter = componentAdapter();
    open(adapter);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }, { timeout: 3000 }));
    const label = (await screen.findByLabelText('Label')) as HTMLInputElement;
    expect(label.value).toBe('Title');

    fireEvent.click(screen.getByRole('button', { name: 'Add a setting' }));
    const names = screen.getAllByLabelText('Name in the design') as HTMLInputElement[];
    fireEvent.change(names[1], { target: { value: 'Sub Title' } });
    expect(names[1].value).toBe('sub_title');

    await waitFor(() => expect(adapter.settings.write).toHaveBeenCalled(), { timeout: 3000 });
    const [id, sent, revision] = adapter.settings.write.mock.calls.at(-1)!;
    expect(id).toBe('c1');
    expect(revision).toBe('d1');
    expect((sent as Array<{ name: string }>).map((s) => s.name)).toEqual(['title', 'sub_title']);
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('shows a refusal on the row it is about', async () => {
    const write = vi.fn<Write>(async () => ({ refused: { field: 'params.0.default', text: 'A required setting needs a default.' } }));
    open(componentAdapter(write));

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }, { timeout: 3000 }));
    const label = (await screen.findByLabelText('Label')) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(label, { target: { value: 'Heading' } });
    });

    expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveProperty('textContent', 'A required setting needs a default.');
    expect(screen.getByText(/Not saved: fix the setting/)).toBeTruthy();
  });

  it('shows settings changed outside the panel (code, a run, a rewind) at once, and saves them as the new list', async () => {
    const adapter = componentAdapter();
    let push: ((next: unknown[]) => void) | null = null;
    (adapter.settings as unknown as { subscribe: unknown }).subscribe = vi.fn((_id: string, onChange: (next: unknown[]) => void) => {
      push = onChange;
      return () => {
        push = null;
      };
    });
    open(adapter);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }, { timeout: 3000 }));
    expect(((await screen.findByLabelText('Label')) as HTMLInputElement).value).toBe('Title');
    expect(push).not.toBeNull();

    await act(async () => {
      push!([
        { name: 'title', label: 'Title', kind: 'text', default: 'Counter' },
        { name: 'subtitle', label: 'Subtitle', kind: 'text', default: '' },
      ]);
    });
    const labels = screen.getAllByLabelText('Label') as HTMLInputElement[];
    expect(labels.map((l) => l.value)).toEqual(['Title', 'Subtitle']);

    // The next edit sends the new list, never the one the panel opened with.
    fireEvent.change(labels[1], { target: { value: 'Tagline' } });
    await waitFor(() => expect(adapter.settings.write).toHaveBeenCalled(), { timeout: 3000 });
    const sent = adapter.settings.write.mock.calls.at(-1)![1] as Array<{ name: string; label: string }>;
    expect(sent.map((s) => s.label)).toEqual(['Title', 'Tagline']);
  });

  it('adds an element inside the one outer element, never beside it', async () => {
    open(componentAdapter());

    const add = await screen.findByRole('button', { name: /Add an element/ }, { timeout: 3000 });
    expect(screen.queryByRole('button', { name: /Add a section/ })).toBeNull();
    fireEvent.click(add);

    // The picker opens for a place INSIDE the box (a box takes any element), never a second root.
    expect(await screen.findByRole('dialog', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('is offered only on the component profile', async () => {
    open(componentAdapter(), 'page');

    await screen.findByRole('button', { name: /Add a section/ }, { timeout: 3000 });
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
  });

  it('reads the row a refusal names', () => {
    expect(refusalRow({ field: 'params.3.fields.0.name', text: '' })).toBe(3);
    expect(refusalRow({ field: 'params', text: '' })).toBeNull();
    expect(refusalRow(null)).toBeNull();
  });
});
