import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import type { DocumentAdapter } from '../../../src/builder/document';
import { BuilderHostProvider } from '../../../src/builder/editor/host';
import { PmlCodePane } from '../../../src/builder/editor/PmlCodePane';

// Portify's API calls became the adapter's code and assistant ports (E4a4f3); the mocks keep Portify's names and
// shapes, so every assertion below reads as it did in Portify.
const mockGetPmlSource = vi.fn();
const mockEditPmlSource = vi.fn();
const mockEditPmlSelection = vi.fn();
const mockScaffoldPml = vi.fn();
const mockDiagnosePml = vi.fn();

function adapter(): DocumentAdapter {
  return {
    code: {
      source: async (id: string) => (await mockGetPmlSource(id)).source,
      parse: vi.fn(async () => []),
      parseLive: vi.fn(async () => ({ nodes: [], error: null })),
      diagnose: async (id: string, source: string) => ((await mockDiagnosePml(id, source)) ?? { diagnostics: [] }).diagnostics,
    },
    assistant: {
      edit: (...args: unknown[]) => mockEditPmlSource(...args),
      editSelection: (...args: unknown[]) => mockEditPmlSelection(...args),
      scaffold: (...args: unknown[]) => mockScaffoldPml(...args),
      complete: async () => ({ completion: null }),
    },
  } as unknown as DocumentAdapter;
}

describe('PmlCodePane copilot → diff (F3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPmlSource.mockResolvedValue({ source: '<hero headline="Old"/>' });
  });

  const editor = () => screen.getByLabelText('Page PML source') as HTMLTextAreaElement;

  it('shows a diff for a Porter edit and only changes the buffer on Accept', async () => {
    mockEditPmlSource.mockResolvedValue({ source: '<hero headline="New"/>', unavailable: false });

    render(<BuilderHostProvider assistantName="Porter"><PmlCodePane pageId="p1" adapter={adapter()} onApply={vi.fn()} onCancel={vi.fn()} /></BuilderHostProvider>);

    // Wait for the source to load into the editor.
    await waitFor(() => expect(editor().value).toBe('<hero headline="Old"/>'));

    fireEvent.change(screen.getByPlaceholderText(/Ask Porter to write/i), {
      target: { value: 'add a hero' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update with porter/i }));

    // The proposal renders as a diff; the buffer is still the old source.
    await screen.findByText("Porter's proposed change");
    expect(editor().value).toBe('<hero headline="Old"/>');

    // Accept applies it to the buffer and closes the diff.
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    await waitFor(() => expect(editor().value).toBe('<hero headline="New"/>'));
    expect(screen.queryByText("Porter's proposed change")).toBeNull();
  });

  it('discards a Porter edit without touching the buffer', async () => {
    mockEditPmlSource.mockResolvedValue({ source: '<hero headline="New"/>', unavailable: false });

    render(<BuilderHostProvider assistantName="Porter"><PmlCodePane pageId="p1" adapter={adapter()} onApply={vi.fn()} onCancel={vi.fn()} /></BuilderHostProvider>);
    await waitFor(() => expect(editor().value).toBe('<hero headline="Old"/>'));

    fireEvent.change(screen.getByPlaceholderText(/Ask Porter to write/i), {
      target: { value: 'add a hero' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update with porter/i }));
    await screen.findByText("Porter's proposed change");

    fireEvent.click(screen.getByRole('button', { name: /discard/i }));
    await waitFor(() => expect(screen.queryByText("Porter's proposed change")).toBeNull());
    expect(editor().value).toBe('<hero headline="Old"/>');
  });

  it('splices a Cmd-K selection edit and previews it via the diff (F8)', async () => {
    mockGetPmlSource.mockResolvedValue({ source: '<hero/>\n<button label=Welcome/>' });
    mockEditPmlSelection.mockResolvedValue({ replacement: '<button label="Contact"/>', unavailable: false });

    render(<BuilderHostProvider assistantName="Porter"><PmlCodePane pageId="p1" adapter={adapter()} onApply={vi.fn()} onCancel={vi.fn()} /></BuilderHostProvider>);
    await waitFor(() => expect(editor().value).toBe('<hero/>\n<button label=Welcome/>'));

    // Select the <button ...> fragment and open the Cmd-K box.
    const ta = editor();
    const start = ta.value.indexOf('<button');
    ta.setSelectionRange(start, ta.value.length);
    fireEvent.select(ta);
    fireEvent.keyDown(ta, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText(/describe the change to the selection/i);
    fireEvent.change(input, { target: { value: 'make it a contact button' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // The spliced result previews via the same diff; Accept applies it.
    await screen.findByText("Porter's proposed change");
    expect(editor().value).toBe('<hero/>\n<button label=Welcome/>'); // buffer untouched until Accept

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    await waitFor(() => expect(editor().value).toBe('<hero/>\n<button label="Contact"/>'));
    expect(mockEditPmlSelection).toHaveBeenCalledWith('p1', 'make it a contact button', '<hero/>\n<button label=Welcome/>', '<button label=Welcome/>');
  });
});

describe('PmlCodePane scaffold from comment → diff (E3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const editor = () => screen.getByLabelText('Page PML source') as HTMLTextAreaElement;

  it('scaffolds from a comment, inserts BELOW it, previews via the diff, and Accept applies', async () => {
    mockGetPmlSource.mockResolvedValue({ source: '<hero/>\n<!-- create a grid -->' });
    mockScaffoldPml.mockResolvedValue({ block: '<grid columns=2/>', unavailable: false, refused: false, reason: null });

    render(<BuilderHostProvider assistantName="Porter"><PmlCodePane pageId="p1" adapter={adapter()} onApply={vi.fn()} onCancel={vi.fn()} /></BuilderHostProvider>);
    await waitFor(() => expect(editor().value).toBe('<hero/>\n<!-- create a grid -->'));

    // Put the caret on the comment line and click the scaffold pill.
    const ta = editor();
    const pos = ta.value.indexOf('<!--') + 2;
    ta.setSelectionRange(pos, pos);
    fireEvent.select(ta);
    fireEvent.click(screen.getByTestId('pml-scaffold-pill'));

    // The block previews via the SAME diff; the buffer is untouched (comment kept) until Accept.
    await screen.findByText("Porter's proposed change");
    expect(editor().value).toBe('<hero/>\n<!-- create a grid -->');

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    await waitFor(() =>
      expect(editor().value).toBe('<hero/>\n<!-- create a grid -->\n<grid columns=2/>'),
    );
    expect(mockScaffoldPml).toHaveBeenCalledWith('p1', 'create a grid', '<hero/>\n<!-- create a grid -->', 'pml');
  });

  it('surfaces a refusal as a notice and opens no diff', async () => {
    mockGetPmlSource.mockResolvedValue({ source: '<!-- guarantee approval -->' });
    mockScaffoldPml.mockResolvedValue({
      block: null,
      unavailable: false,
      refused: true,
      reason: 'That would include a prohibited claim.',
    });

    render(<BuilderHostProvider assistantName="Porter"><PmlCodePane pageId="p1" adapter={adapter()} onApply={vi.fn()} onCancel={vi.fn()} /></BuilderHostProvider>);
    await waitFor(() => expect(editor().value).toBe('<!-- guarantee approval -->'));

    const ta = editor();
    ta.setSelectionRange(2, 2);
    fireEvent.select(ta);
    fireEvent.click(screen.getByTestId('pml-scaffold-pill'));

    await screen.findByText(/prohibited claim/i);
    expect(screen.queryByText("Porter's proposed change")).toBeNull();
  });
});

describe('PmlCodePane fix-with-Porter → diff (FX2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiagnosePml.mockResolvedValue({ diagnostics: [] });
  });

  const editor = () => screen.getByLabelText('Page PML source') as HTMLTextAreaElement;

  it('fixes an error line via Porter and previews it through the diff; Accept applies', async () => {
    mockGetPmlSource.mockResolvedValue({ source: '<hero/>\n<nope/>' });
    mockDiagnosePml.mockResolvedValue({
      diagnostics: [{ severity: 'error', message: 'Unknown component "nope".', line: 2, col: 1, source: 'compile' }],
    });
    mockEditPmlSource.mockResolvedValue({ source: '<hero/>\n<about heading="About"/>', unavailable: false });

    render(<BuilderHostProvider assistantName="Porter"><PmlCodePane pageId="p1" adapter={adapter()} onApply={vi.fn()} onCancel={vi.fn()} /></BuilderHostProvider>);
    await waitFor(() => expect(editor().value).toBe('<hero/>\n<nope/>'));

    // The debounced diagnostics resolve, so a Fix-with-Porter button appears on the error line.
    const fixBtn = await screen.findByTestId('pml-fix-error', undefined, { timeout: 3000 });
    fireEvent.click(fixBtn);

    await screen.findByText("Porter's proposed change");
    expect(mockEditPmlSource).toHaveBeenCalledWith(
      'p1',
      expect.stringContaining('Fix the error on line 2'),
      '<hero/>\n<nope/>',
    );

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    await waitFor(() => expect(editor().value).toBe('<hero/>\n<about heading="About"/>'));
  });
});

describe('PmlCodePane without an assistant', () => {
  it('offers no assistant box and no fix buttons when the adapter has no assistant port', async () => {
    mockGetPmlSource.mockResolvedValue({ source: '<hero/>' });
    const plain = { ...adapter(), assistant: undefined } as unknown as DocumentAdapter;
    render(<PmlCodePane pageId="p1" adapter={plain} onApply={vi.fn()} onCancel={vi.fn()} />);

    await screen.findByLabelText('Page PML source');
    expect(screen.queryByRole('button', { name: /update with/i })).toBeNull();
    expect(screen.queryByText(/Edit with/)).toBeNull();
    expect(screen.queryByTestId('pml-fix-error')).toBeNull();
  });
});
