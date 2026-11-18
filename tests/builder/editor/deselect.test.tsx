import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { EditableDocumentAdapter } from '../../../src/builder/document';
import { PageEditor, type PageEditorControls } from '../../../src/builder/editor/PageEditor';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;

const design = [
  { primitive: 'box', children: [{ primitive: 'p', children: [{ primitive: 'text', props: { value: 'Most people with a job offer can apply.' } }] }] },
  { primitive: 'heading', props: { text: 'Who can apply?', level: 2 } },
] as unknown as PmlNode[];

function open(preflight = { mayPublish: true, findings: [] as unknown[] }) {
  const adapter = {
    load: vi.fn(async () => ({ document: { nodes: design }, revision: 'd1', meta: { title: 'A post', slug: 'a-post', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } })),
    saveDraft: vi.fn(async () => ({ revision: 'd2' })),
    preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
    preflight: vi.fn(async () => preflight),
  } as unknown as EditableDocumentAdapter;
  let controls = null as PageEditorControls | null;
  render(
    <PageEditor
      adapter={adapter}
      id="p1"
      labels={{ noun: 'post' }}
      renderControls={(c) => {
        controls = c;
        return null;
      }}
    />,
  );

  return { controls: () => controls };
}

const selectedWords = () => document.querySelector('[data-pml-selected]')?.textContent ?? null;
/** The section's padding: its frame's own band, where no element's content is drawn. */
const paddingOf = (index: number) => document.querySelector(`[data-pml-section="${index}"] [data-pml-frame]`) as HTMLElement;

/** Owner 2026-11-18: "now clicking outside a selected element doesn't remove the selection". */
describe('clearing a selection, Figma-like', () => {
  it('a click on a section padding clears it; with nothing selected the same click selects the section', async () => {
    open();
    fireEvent.click(await screen.findByText('Most people with a job offer can apply.', {}, { timeout: 3000 }));
    await waitFor(() => expect(selectedWords()).toBe('Most people with a job offer can apply.'));

    fireEvent.click(paddingOf(1), { detail: 1 });
    await waitFor(() => expect(selectedWords()).toBeNull());
    expect(screen.queryByRole('complementary', { name: 'Paragraph' })).toBeNull();

    fireEvent.click(paddingOf(1), { detail: 1 });
    expect(await screen.findByRole('complementary', { name: 'Section settings' }, { timeout: 3000 })).toBeTruthy();
  });

  it('pressing a section from the keyboard or a screen reader still selects it (a click with no pointer)', async () => {
    open();
    fireEvent.click(await screen.findByText('Most people with a job offer can apply.', {}, { timeout: 3000 }));
    await waitFor(() => expect(selectedWords()).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: /Heading, section 2/ }));
    expect(await screen.findByRole('complementary', { name: 'Section settings' }, { timeout: 3000 })).toBeTruthy();
  });

  it('Esc clears it', async () => {
    open();
    fireEvent.click(await screen.findByText('Most people with a job offer can apply.', {}, { timeout: 3000 }));
    await waitFor(() => expect(selectedWords()).not.toBeNull());

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(selectedWords()).toBeNull());
  });

  it('clearing never opens another panel (a refused check waiting behind it stays put away)', async () => {
    const { controls } = open({ mayPublish: false, findings: [{ code: 'x', message: 'Add a summary.', severity: 'error', blocks: true }] });
    await screen.findByText('Most people with a job offer can apply.', {}, { timeout: 3000 });
    await act(async () => controls()?.check());
    await screen.findByRole('complementary', { name: 'Checks' }, { timeout: 3000 });

    fireEvent.click(screen.getByText('Most people with a job offer can apply.'));
    await screen.findByRole('complementary', { name: 'Paragraph' }, { timeout: 3000 });
    fireEvent.click(paddingOf(1), { detail: 1 });

    await waitFor(() => expect(selectedWords()).toBeNull());
    expect(screen.queryByRole('complementary', { name: 'Checks' })?.getAttribute('aria-hidden')).not.toBe('false');
  });

  it("names the panel's delete for what it is", async () => {
    open();
    fireEvent.click(await screen.findByText('Most people with a job offer can apply.', {}, { timeout: 3000 }));

    expect(await screen.findByRole('button', { name: 'Delete paragraph' }, { timeout: 3000 })).toBeTruthy();
  });
});
