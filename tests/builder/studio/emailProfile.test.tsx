import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { DocumentAdapter } from '../../../src/builder/document';
import { Studio } from '../../../src/builder/editor/PageEditor';
import { BuilderHostProvider } from '../../../src/builder/editor/host';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;
Element.prototype.hasPointerCapture ??= () => false;

const design = [
  { primitive: 'heading', uid: 'abc111', props: { text: 'Your appointment moved', level: 1 } },
  { primitive: 'heading', uid: 'abc222', props: { text: 'What to bring', level: 2 } },
] as unknown as PmlNode[];
const ALLOWED = ['heading', 'p', 'text', 'button', 'image', 'divider', 'callout', 'table', 'list', 'box', 'spacer', 'header', 'footer'];

function emailAdapter() {
  const fields = {
    describe: vi.fn(async () => [
      { name: 'subject', label: 'Subject', kind: 'text' as const, max: 120 },
      { name: 'preheader', label: 'Preview text', kind: 'text' as const, max: 140 },
    ]),
    read: vi.fn(async () => ({ values: { subject: 'Your appointment moved', preheader: '' }, revision: 'f1' })),
    write: vi.fn(async () => ({ revision: 'f2' })),
  };

  return {
    load: vi.fn(async () => ({ document: { nodes: design }, revision: 'd1', meta: {} })),
    saveDraft: vi.fn(async () => ({ revision: 'd2' })),
    preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
    preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    publish: vi.fn(),
    fields,
  } as unknown as DocumentAdapter & { fields: typeof fields };
}

function open(props: Partial<React.ComponentProps<typeof Studio>> = {}) {
  const renderAsSent = vi.fn(async () => ({ html: '<html><body><h1>Sent</h1></body></html>', text: 'Sent' }));
  render(
    <BuilderHostProvider>
      <Studio adapter={emailAdapter()} id="t1" profile="email" labels={{ noun: 'email' }} allowedElements={ALLOWED} renderAsSent={renderAsSent} {...props} />
    </BuilderHostProvider>,
  );

  return { renderAsSent };
}

/** The Studio on the email profile (shared PML Studio P2b2): the email's chrome plus the shared chrome emails lacked. */
describe('Studio profile="email"', () => {
  it('opens the email in its inbox frame, in the email words', async () => {
    open();

    expect(((await screen.findByLabelText('Subject')) as HTMLInputElement).value).toBe('Your appointment moved');
    expect(await screen.findByRole('heading', { name: 'Your appointment moved' }, { timeout: 3000 })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add a block/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'As sent' })).toBeTruthy();
  });

  it('offers only what an email can hold, never the standard header and footer', async () => {
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Add a block/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a block' });
    expect(dialog.textContent).toMatch(/Button/);
    expect(dialog.textContent).not.toMatch(/Carousel|Header|Footer|Post cover/);
  });

  it('shows the email as sent', async () => {
    const { renderAsSent } = open();

    fireEvent.click(await screen.findByRole('tab', { name: 'As sent' }));
    expect(((await screen.findByTitle('The email as sent')) as HTMLIFrameElement).getAttribute('srcdoc')).toContain('<h1>Sent</h1>');
    expect(renderAsSent).toHaveBeenCalledWith('t1');
  });

  it("a block gets the selection bar, its element menu and Up / Down: what emails did not have", async () => {
    open();

    fireEvent.contextMenu(await screen.findByRole('heading', { name: 'What to bring' }, { timeout: 3000 }));
    const menu = await screen.findByRole('menu', {}, { timeout: 3000 });
    expect(within(menu).getByRole('menuitem', { name: 'Duplicate' })).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: 'Move up' })).toBeTruthy();

    // The open menu hides the rest of the page from assistive tech, so look past that.
    const bar = screen.getByRole('toolbar', { name: /tools$/, hidden: true });
    expect(within(bar).getByRole('button', { name: /^Move this .* up$/, hidden: true })).toBeTruthy();
    // The block's own panel speaks the email's words.
    // (While the menu is open the page is hidden from assistive tech, which also blanks its accessible names.)
    await waitFor(() => expect(screen.queryAllByRole('complementary', { hidden: true }).map((c) => c.getAttribute('aria-label'))).toContain('Block settings'));
  });

  it('locked, nothing can be added', async () => {
    open({ locked: true });

    expect(await screen.findByLabelText('Subject')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add a block/ })).toBeNull();
  });
});
