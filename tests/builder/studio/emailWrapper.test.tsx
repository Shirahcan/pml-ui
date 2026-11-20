import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { DocumentAdapter } from '../../../src/builder/document';
import { EmailEditor, type EmailEditorControls } from '../../../src/builder/editor/EmailEditor';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;
Element.prototype.hasPointerCapture ??= () => false;

const design = [
  { primitive: 'heading', uid: 'abc111', props: { text: 'Your appointment moved', level: 1 } },
  { primitive: 'heading', uid: 'abc222', props: { text: 'What to bring', level: 2 } },
] as unknown as PmlNode[];
const ALLOWED = ['heading', 'p', 'text', 'button', 'divider', 'box'];

function adapter(withPublish: boolean) {
  return {
    load: vi.fn(async () => ({ document: { nodes: design }, revision: 'd1', meta: {} })),
    saveDraft: vi.fn(async () => ({ revision: 'd2' })),
    preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
    preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    ...(withPublish ? { publish: vi.fn() } : {}),
  } as unknown as DocumentAdapter;
}

/** EmailEditor is a wrapper over the Studio on the email profile (shared PML Studio P2b3). */
describe('EmailEditor on the Studio', () => {
  it("an email's block gets the selection bar, its element menu and Up / Down", async () => {
    render(<EmailEditor adapter={adapter(true)} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} />);

    fireEvent.contextMenu(await screen.findByRole('heading', { name: 'What to bring' }, { timeout: 3000 }));
    const menu = await screen.findByRole('menu', {}, { timeout: 3000 });
    for (const name of ['Move up', 'Duplicate', 'Copy']) expect(within(menu).getByRole('menuitem', { name })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: /^Remove / })).toBeTruthy();
  });

  it("a block's menu offers the host's own items on an email too (Add to Porter)", async () => {
    const onAdd = vi.fn();
    render(<EmailEditor adapter={adapter(true)} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} elementMenuActions={[{ key: 'porter', label: 'Add to Porter', onSelect: onAdd }]} />);

    fireEvent.contextMenu(await screen.findByRole('heading', { name: 'What to bring' }, { timeout: 3000 }));
    fireEvent.click(within(await screen.findByRole('menu', {}, { timeout: 3000 })).getByRole('menuitem', { name: 'Add to Porter' }));
    // A host item runs once the menu has closed (it usually moves focus, and the open menu would pull it back).
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith([1], expect.objectContaining({ uid: 'abc222' }), 'Heading'));
  });

  it("hands the host the email controls it always had, with adoptSavedDraft and refreshFields (DesignerConsole's contract)", async () => {
    let controls: EmailEditorControls | null = null;
    render(
      <EmailEditor
        adapter={adapter(true)}
        id="t1"
        allowedElements={ALLOWED}
        renderAsSent={vi.fn()}
        renderControls={(c) => {
          controls = c;
          return null;
        }}
      />,
    );

    await waitFor(() => expect(controls).not.toBeNull());
    const c = controls as unknown as EmailEditorControls;
    expect(c.tab).toBe('design');
    expect(typeof c.setTab).toBe('function');
    expect(typeof c.adoptSavedDraft).toBe('function');
    expect(typeof c.refreshFields).toBe('function');
    expect(typeof c.publish).toBe('function');
  });

  it('offers no "Save for everyone" when the email has no publish step (a newsletter)', async () => {
    let controls: EmailEditorControls | null = null;
    render(
      <EmailEditor
        adapter={adapter(false)}
        id="n1"
        allowedElements={ALLOWED}
        renderAsSent={vi.fn()}
        renderControls={(c) => {
          controls = c;
          return null;
        }}
      />,
    );

    await waitFor(() => expect(controls).not.toBeNull());
    expect((controls as unknown as EmailEditorControls).publish).toBeUndefined();
  });

  it("draws the email's own header (Design / As sent, Save for everyone) when the host draws no controls", async () => {
    render(<EmailEditor adapter={adapter(true)} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} />);

    expect(await screen.findByRole('tab', { name: 'As sent' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Save for everyone/ })).toBeTruthy();
  });
});
