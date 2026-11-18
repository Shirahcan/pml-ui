import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { EditableDocumentAdapter } from '../../../src/builder/document';
import { PageEditor, type PageEditorControls } from '../../../src/builder/editor/PageEditor';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;
Element.prototype.hasPointerCapture ??= () => false;

const heading = (uid: string, text: string) => ({ primitive: 'heading', uid, props: { text, level: 2 } });
const design = [heading('abc111', 'Who can apply?'), heading('abc222', 'What does it cost?')] as unknown as PmlNode[];

function open(extra?: React.ComponentProps<typeof PageEditor>['elementMenuActions']) {
  let controls: PageEditorControls | null = null;
  const adapter = {
    load: vi.fn(async () => ({ document: { nodes: design }, revision: 'd1', meta: { title: 'A post', slug: 'a-post', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } })),
    saveDraft: vi.fn(async () => ({ revision: 'd2' })),
    preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
    preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
  } as unknown as EditableDocumentAdapter;
  render(
    <PageEditor
      adapter={adapter}
      id="p1"
      labels={{ noun: 'post' }}
      elementMenuActions={extra}
      renderControls={(c) => {
        controls = c;
        return null;
      }}
    />,
  );

  return { controls: () => controls };
}

const headings = () => [...document.querySelectorAll('[data-pml-section] h2')].map((h) => h.textContent);

/** The Studio's element menu in the editor (shared PML Studio P3a): on the bar, and on a right-click. */
describe('the element menu in the editor', () => {
  beforeEach(() => sessionStorage.clear());

  it("a right-click selects the element and opens its menu, with the host's own items in it", async () => {
    const onAddToPorter = vi.fn();
    open([{ key: 'porter', label: 'Add to Porter', onSelect: onAddToPorter }]);

    fireEvent.contextMenu(await screen.findByRole('heading', { name: 'What does it cost?' }, { timeout: 3000 }));
    const menu = await screen.findByRole('menu', {}, { timeout: 3000 });

    expect(within(menu).getByRole('menuitem', { name: 'Duplicate' })).toBeTruthy();
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Add to Porter' }));
    expect(onAddToPorter).toHaveBeenCalledWith([1], design[1]);
  });

  it('Duplicate from the menu puts a copy right after it', async () => {
    open();

    fireEvent.contextMenu(await screen.findByRole('heading', { name: 'Who can apply?' }, { timeout: 3000 }));
    fireEvent.click(within(await screen.findByRole('menu', {}, { timeout: 3000 })).getByRole('menuitem', { name: 'Duplicate' }));

    await waitFor(() => expect(headings()).toEqual(['Who can apply?', 'Who can apply?', 'What does it cost?']), { timeout: 3000 });
  });

  it('Remove from the menu asks first; undo brings it back', async () => {
    const { controls } = open();

    fireEvent.contextMenu(await screen.findByRole('heading', { name: 'Who can apply?' }, { timeout: 3000 }));
    fireEvent.click(within(await screen.findByRole('menu', {}, { timeout: 3000 })).getByRole('menuitem', { name: /^Remove / }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(headings()).toEqual(['What does it cost?']), { timeout: 3000 });
    await act(async () => controls()?.undo());
    await waitFor(() => expect(headings()).toEqual(['Who can apply?', 'What does it cost?']), { timeout: 3000 });
  });

  it("the bar's three dots open the same menu", async () => {
    open();

    fireEvent.click(await screen.findByRole('heading', { name: 'Who can apply?' }, { timeout: 3000 }));
    const bar = await screen.findByRole('toolbar', { name: /tools$/ }, { timeout: 3000 });
    const dots = within(bar).getByRole('button', { name: /^Actions for this / });
    fireEvent.pointerDown(dots, { button: 0, pointerType: 'mouse' });
    fireEvent.keyDown(dots, { key: 'Enter' });

    expect(within(await screen.findByRole('menu', {}, { timeout: 3000 })).getByRole('menuitem', { name: 'Copy' })).toBeTruthy();
  });
});
