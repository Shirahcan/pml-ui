import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { DocumentAdapter } from '../../../src/builder/document';
import { forceColorScheme } from '../../../src/builder/editor/EmailAsSent';
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

const ALLOWED = ['heading', 'p', 'text', 'button', 'image', 'divider', 'callout', 'table', 'list', 'box', 'spacer', 'header', 'footer'];

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
    // The standard header and footer are added at send time, never as body blocks.
    expect(dialog.textContent).not.toMatch(/Header|Footer/);
    // The list scrolls inside the bounded dialog, so its last entry is reachable on a short screen.
    expect(screen.getByRole('button', { name: /Button/ }).closest('.overflow-y-auto')).not.toBeNull();
    expect((screen.getByRole('textbox', { name: 'Search blocks' }) as HTMLInputElement).placeholder).toBe('Search blocks');
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
    // No scripts, no same-origin; links open in a new tab, never inside the frame.
    expect(frame.getAttribute('sandbox')).toBe('allow-popups allow-popups-to-escape-sandbox');
    expect(frame.getAttribute('srcdoc')).toContain('<base target="_blank">');
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

describe('forceColorScheme', () => {
  it("forces the email's scheme rules wherever the feature sits, and declares the scheme", () => {
    const html = '<html><head></head><body><style>@media screen and (prefers-color-scheme: dark) { .a { color: #fff } }</style></body></html>';

    const dark = forceColorScheme(html, 'dark');
    expect(dark).toContain('@media screen and (min-width: 0px)');
    expect(dark).toContain('<meta name="color-scheme" content="dark">');

    // A viewer whose system is dark still sees the LIGHT email on the Light tab.
    expect(forceColorScheme(html, 'light')).toContain('@media screen and (max-width: 0px)');
  });
});

describe('Save for everyone', () => {
  it('saves the draft for everyone only through the publish step, after the field writes land', async () => {
    const adapter = fakeAdapter();
    const publish = vi.fn(async () => ({ published: true as const, url: null }));
    const onPublished = vi.fn();
    render(
      <BuilderHostProvider>
        <EmailEditor adapter={{ ...adapter, publish }} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} onPublished={onPublished} />
      </BuilderHostProvider>,
    );

    const subject = (await screen.findByLabelText('Subject')) as HTMLInputElement;
    fireEvent.change(subject, { target: { value: 'New time' } });
    fireEvent.blur(subject);
    fireEvent.click(screen.getByRole('button', { name: /Save for everyone/ }));

    await waitFor(() => expect(publish).toHaveBeenCalled());
    expect(adapter.fields.write.mock.invocationCallOrder[0]).toBeLessThan(publish.mock.invocationCallOrder[0]);
    await waitFor(() => expect(onPublished).toHaveBeenCalled());
  });

  it('writes a field only when it changed', async () => {
    const adapter = fakeAdapter();
    render(<EmailEditor adapter={adapter} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} />);

    fireEvent.blur(await screen.findByLabelText('Subject'));
    await new Promise((r) => setTimeout(r, 20));
    expect(adapter.fields.write).not.toHaveBeenCalled();
  });
});

describe('an email adapter has no publish step', () => {
  it('opens and saves with only what an email needs, and draws the host notice', async () => {
    const full = fakeAdapter();
    const { load, saveDraft, preview, preflight, fields } = full;
    const adapter = { load, saveDraft, preview, preflight, fields };

    render(<EmailEditor adapter={adapter} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} notice={<p>No design yet.</p>} />);

    expect(await screen.findByText('No design yet.')).toBeTruthy();
    expect(await screen.findByLabelText('Subject')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Save for everyone/ })).toBeNull();
  });
});

describe('the email surface', () => {
  it('leaves page-only controls out of an email: no #link name, a block is a block', async () => {
    render(<EmailEditor adapter={fakeAdapter()} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} />);

    const heading = await screen.findByRole('heading', { name: 'Your appointment moved' }, { timeout: 3000 });
    fireEvent.click(heading.closest('[data-pml-section]') as HTMLElement);

    expect(await screen.findByRole('button', { name: /Delete block/ })).toBeTruthy();
    expect(screen.queryByText(/Link name/)).toBeNull();
  });
});

describe('an email with no blocks', () => {
  it('says so in an email\'s words, not a page\'s', async () => {
    const adapter = fakeAdapter();
    (adapter.load as ReturnType<typeof vi.fn>).mockResolvedValue({ document: { nodes: [] }, revision: 'd0', meta: {} });
    render(<EmailEditor adapter={adapter} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} />);

    expect(await screen.findByText('This email has no blocks yet')).toBeTruthy();
    expect(screen.queryByText('This page is empty')).toBeNull();
  });
});

describe('quick edits in the email (post layouts E1/E2, owner: newsletters adopt the page builder\'s)', () => {
  const words = [
    { primitive: 'heading', props: { text: 'Your appointment moved', level: 1 } },
    { primitive: 'p', children: [{ primitive: 'text', props: { value: 'Hi Ada, your new time is confirmed.' } }] },
  ] as unknown as PmlNode[];

  function wordsAdapter() {
    const adapter = fakeAdapter();
    (adapter.load as ReturnType<typeof vi.fn>).mockResolvedValue({ document: { nodes: words }, revision: 'd1', meta: {} });

    return adapter;
  }

  const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

  // jsdom draws nothing, so a Range has no geometry; the rich editor scrolls to its caret once it focuses itself,
  // which can land after the test closed it (TipTap destroys its view a tick later). Browsers always have these.
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

  it('a double-click edits a rich paragraph in place, and the block settings never open meanwhile', async () => {
    render(<EmailEditor adapter={wordsAdapter()} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} quickEdit />);
    const paragraph = await screen.findByText('Hi Ada, your new time is confirmed.', undefined, { timeout: 3000 });

    // A real double-click: two clicks, then the dblclick.
    fireEvent.click(paragraph);
    fireEvent.click(paragraph);
    fireEvent.doubleClick(paragraph);

    expect(await screen.findByRole('toolbar', { name: 'Format these words' })).toBeTruthy();
    expect((paragraph.closest('p') as HTMLElement).style.visibility).toBe('hidden');
    // The block settings panel stays closed (it slides in over the canvas only when due).
    expect(screen.queryByRole('complementary', { name: 'Block settings' })).toBeNull();

    // Closed before waiting: jsdom cannot measure the rich editor's caret, which it scrolls to once focused.
    fireEvent.keyDown(screen.getByRole('toolbar', { name: 'Format these words' }), { key: 'Escape' });
    expect(screen.queryByRole('toolbar', { name: 'Format these words' })).toBeNull();

    // The first click's settings were waiting out the double-click window; the quick edit cancelled them for good.
    await wait(350);
    // The block settings panel stays closed (it slides in over the canvas only when due).
    expect(screen.queryByRole('complementary', { name: 'Block settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Delete block/ })).toBeNull();
  });

  it('a single click still shows the block settings, once the double-click window has passed', async () => {
    render(<EmailEditor adapter={wordsAdapter()} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} quickEdit />);
    const heading = await screen.findByRole('heading', { name: 'Your appointment moved' }, { timeout: 3000 });

    fireEvent.click(heading.closest('[data-pml-section]') as HTMLElement);
    expect(screen.queryByRole('button', { name: /Delete block/ })).toBeNull();

    expect(await screen.findByRole('button', { name: /Delete block/ })).toBeTruthy();
  });

  it('off, a click opens the settings at once and a double-click leaves rich words to them', async () => {
    render(<EmailEditor adapter={wordsAdapter()} id="t1" allowedElements={ALLOWED} renderAsSent={vi.fn()} />);
    const paragraph = await screen.findByText('Hi Ada, your new time is confirmed.', undefined, { timeout: 3000 });

    fireEvent.click(paragraph.closest('[data-pml-section]') as HTMLElement);
    expect(screen.getByRole('button', { name: /Delete block/ })).toBeTruthy();

    fireEvent.doubleClick(paragraph);
    await wait(50);
    expect(screen.queryByRole('toolbar', { name: 'Format these words' })).toBeNull();
  });
});

/** A newsletter's details, audience and sending are slide-in panels, with the page editor's shapes (N1f, 0.7.55). */
describe('panels over the email (designer sole surface: the newsletter)', () => {
  function newsletterAdapter() {
    const adapter = fakeAdapter();
    adapter.fields.describe.mockResolvedValue([
      { name: 'subject', label: 'Subject', kind: 'text' as const, max: 120, group: { key: 'details', label: 'Details' } },
      { name: 'preheader', label: 'Preview text', kind: 'text' as const, max: 140, group: { key: 'details', label: 'Details' } },
      { name: 'signer_name', label: 'Signed by', kind: 'text' as const, max: 120, group: { key: 'details', label: 'Details' } },
      { name: 'topic', label: 'Topic', kind: 'text' as const, max: 60, group: { key: 'audience', label: 'Audience' } },
    ] as never);
    adapter.fields.read.mockResolvedValue({ values: { subject: 'November news', preheader: '', signer_name: 'Ada', topic: '' }, revision: 'f1' } as never);

    return adapter;
  }

  it('draws only the inbox fields above the email, and opens a field group and a host panel from the controls', async () => {
    const adapter = newsletterAdapter();
    let controls = null as import('../../../src/builder/editor/EmailEditor').EmailEditorControls | null;
    const send = vi.fn();
    render(
      <BuilderHostProvider>
        <EmailEditor
          adapter={adapter}
          id="c1"
          allowedElements={ALLOWED}
          renderAsSent={vi.fn()}
          inboxFields={['subject', 'preheader']}
          panels={[{ key: 'send', title: 'Send', render: (c) => <button type="button" onClick={() => void c.flush().then(send)}>Send me a test</button> }]}
          renderControls={(c) => {
            controls = c;
            return null;
          }}
        />
      </BuilderHostProvider>,
    );

    expect(((await screen.findByLabelText('Subject')) as HTMLInputElement).value).toBe('November news');
    // The signer and the topic stay in their panels, out of the inbox frame.
    expect(screen.queryByLabelText('Signed by')).toBeNull();
    await waitFor(() => expect(controls?.fieldGroups.map((g) => g.key)).toEqual(['details', 'audience']));
    expect(controls?.hostPanels).toEqual([{ key: 'send', title: 'Send' }]);

    await act(async () => controls?.openPanel('group:audience'));
    expect(await screen.findByLabelText('Topic')).toBeTruthy();
    // The groups are pills at the top of the panel, so the host's menu needs one item for all of them.
    expect(screen.getByRole('button', { name: 'Details' })).toBeTruthy();

    await act(async () => controls?.openPanel('host:send'));
    fireEvent.click(await screen.findByRole('button', { name: 'Send me a test' }));
    await waitFor(() => expect(send).toHaveBeenCalledWith(true));
  });

  it('tells the host when a field is saved, from the inbox frame', async () => {
    const adapter = newsletterAdapter();
    const onFieldSaved = vi.fn();
    render(<EmailEditor adapter={adapter} id="c1" allowedElements={ALLOWED} renderAsSent={vi.fn()} inboxFields={['subject', 'preheader']} onFieldSaved={onFieldSaved} />);

    const subject = await screen.findByLabelText('Subject');
    fireEvent.change(subject, { target: { value: 'December news' } });
    fireEvent.blur(subject);
    await waitFor(() => expect(onFieldSaved).toHaveBeenCalledWith('subject'));
  });

  it('locked, the email takes no edits and offers nothing to add, while its panels still open', async () => {
    let controls = null as import('../../../src/builder/editor/EmailEditor').EmailEditorControls | null;
    render(
      <EmailEditor
        adapter={newsletterAdapter()}
        id="c1"
        allowedElements={ALLOWED}
        renderAsSent={vi.fn()}
        inboxFields={['subject', 'preheader']}
        locked
        renderControls={(c) => {
          controls = c;
          return null;
        }}
      />,
    );

    expect(await screen.findByLabelText('Subject')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Add a block/ })).toBeNull();
    await waitFor(() => expect(controls?.fieldGroups.length).toBe(2));
    await act(async () => controls?.openPanel('details'));
    // 'details' opens the first group.
    expect(await screen.findByLabelText('Signed by')).toBeTruthy();
  });
});
