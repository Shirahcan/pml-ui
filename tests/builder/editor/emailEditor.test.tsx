import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { DocumentAdapter } from '../../../src/builder/document';
import { forceDarkMode } from '../../../src/builder/editor/EmailAsSent';
import { EmailEditor } from '../../../src/builder/editor/EmailEditor';
import { BuilderHostProvider } from '../../../src/builder/editor/host';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;

const design = [{ primitive: 'heading', props: { text: 'Your appointment moved', level: 1 } }] as unknown as PmlNode[];

function fakeAdapter() {
  const fields = {
    describe: vi.fn(async () => [
      { name: 'subject', label: 'Subject', kind: 'text' as const, max: 120 },
      { name: 'preheader', label: 'Preview text', kind: 'text' as const, max: 140 },
      { name: 'chrome', label: 'Standard header and footer', kind: 'toggle' as const },
    ]),
    read: vi.fn(async () => ({ values: { subject: 'Your appointment moved', preheader: '', chrome: true }, revision: 'f1' })),
    write: vi.fn(async () => ({ revision: 'f2' })),
  };
  const adapter = {
    load: vi.fn(async () => ({ document: { nodes: design }, revision: 'd1', meta: {} })),
    saveDraft: vi.fn(async () => ({ revision: 'd2' })),
    preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
    preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    publish: vi.fn(),
    rollback: vi.fn(),
    previewUrl: vi.fn(),
    fields,
  };

  return adapter as unknown as DocumentAdapter & { fields: typeof fields };
}

const ALLOWED = ['heading', 'p', 'text', 'button', 'image', 'divider', 'callout', 'table', 'list', 'box', 'spacer'];

/** The email editor on the shared builder (pml-email C1a). */
describe('EmailEditor', () => {
  it('opens the email in its inbox frame and saves a subject when the author leaves it', async () => {
    const adapter = fakeAdapter();
    render(<EmailEditor adapter={adapter} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} />);

    const subject = (await screen.findByLabelText('Subject')) as HTMLInputElement;
    expect(subject.value).toBe('Your appointment moved');
    expect(screen.getByText('22/120')).toBeTruthy();
    // The canvas draws the host's compiled preview, which arrives after its short debounce.
    expect(await screen.findByRole('heading', { name: 'Your appointment moved' }, { timeout: 3000 })).toBeTruthy();

    fireEvent.change(subject, { target: { value: 'Your appointment has a new time' } });
    fireEvent.blur(subject);
    await waitFor(() => expect(adapter.fields.write).toHaveBeenCalledWith('t1', 'subject', 'Your appointment has a new time', 'f1', expect.any(String)));

    fireEvent.click(screen.getByRole('switch', { name: 'Standard header and footer' }));
    await waitFor(() => expect(adapter.fields.write).toHaveBeenLastCalledWith('t1', 'chrome', false, 'f2', expect.any(String)));
  });

  it('offers only what an email can hold when adding a block', async () => {
    render(<EmailEditor adapter={fakeAdapter()} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /Add a block/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a block' });

    expect(dialog.textContent).toMatch(/Button/);
    expect(dialog.textContent).not.toMatch(/Carousel/);
  });

  it('shows the email exactly as sent, light, dark and plain text, after sending a waiting save', async () => {
    const renderAsSent = vi.fn(async () => ({ html: '<html><body><h1>Sent</h1></body></html>', text: 'Sent' }));
    render(
      <BuilderHostProvider>
        <EmailEditor adapter={fakeAdapter()} id="t1" allowedElements={ALLOWED} renderAsSent={renderAsSent} />
      </BuilderHostProvider>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'As sent' }));
    const frame = (await screen.findByTitle('The email as sent')) as HTMLIFrameElement;
    expect(frame.getAttribute('srcdoc')).toContain('<h1>Sent</h1>');
    expect(frame.getAttribute('sandbox')).toBe('');
    expect(renderAsSent).toHaveBeenCalledWith('t1');

    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(await screen.findByTitle('The email as sent, dark mode')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Plain text' }));
    expect(screen.getByText('Sent', { selector: 'pre' })).toBeTruthy();
  });

  it('runs the email checks and shows what they found', async () => {
    const adapter = fakeAdapter();
    (adapter.preflight as ReturnType<typeof vi.fn>).mockResolvedValue({ mayPublish: false, findings: [{ source: 'email', severity: 'block', rule: 'required_line', message: 'A marketing email must carry Unsubscribe.', excerpt: null, suggestion: null }] });
    render(<EmailEditor adapter={adapter} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} />);

    const run = await screen.findByRole('button', { name: /Run the checks/ });
    await act(async () => {
      fireEvent.click(run);
    });
    expect(await screen.findByText('A marketing email must carry Unsubscribe.')).toBeTruthy();
  });
});

describe('forceDarkMode', () => {
  it("applies the email's dark rules unconditionally", () => {
    expect(forceDarkMode('@media (prefers-color-scheme: dark) { .a { color: #fff } }')).toBe('@media all { .a { color: #fff } }');
  });
});
