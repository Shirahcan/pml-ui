import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

import { PmlCodeEditor, type PmlCodeEditorHandle } from '../../../src/builder/editor/PmlCodeEditor';
import type { PmlDiagnostic } from '../../../src/pml/diagnostics';

// The editor pulls in diagnostics.ts + completion.ts, which import the api client; mock it so this
// render test has no network/module side effects (the editor never calls the api directly here).

// The host's completion call (Portify: the adapter's assistant.complete), handed to the editor as a prop.
const mockCompletePml = vi.fn();
const completionApi = { completePml: mockCompletePml };

describe('PmlCodeEditor diagnostics overlay (F5)', () => {
  const noop = () => undefined;

  it('renders one squiggle per diagnostic', () => {
    const diagnostics: PmlDiagnostic[] = [
      { severity: 'error', message: 'Unknown component "nope".', line: 2, col: 1, source: 'compile' },
      { severity: 'warning', message: 'PSL: undefined variable', line: 4, col: 5, source: 'psl' },
    ];

    render(<PmlCodeEditor value={'<hero/>\n<nope/>\n\nlet x'} onChange={noop} diagnostics={diagnostics} />);

    expect(screen.getAllByTestId('pml-squiggle')).toHaveLength(2);
  });

  it('renders no squiggles when there are no diagnostics', () => {
    render(<PmlCodeEditor value={'<hero/>'} onChange={noop} />);

    expect(screen.queryAllByTestId('pml-squiggle')).toHaveLength(0);
  });
});

describe('PmlCodeEditor Cmd-K selection edit (F7)', () => {
  const source = '<hero/>\n<button label=Welcome/>';

  const select = (): HTMLTextAreaElement => {
    const ta = screen.getByLabelText('Page PML source') as HTMLTextAreaElement;
    const start = ta.value.indexOf('<button');
    ta.setSelectionRange(start, ta.value.length);
    fireEvent.select(ta);
    return ta;
  };

  it('shows the affordance on a selection and opens the inline input on Cmd-K', () => {
    render(<PmlCodeEditor value={source} onChange={() => undefined} onSelectionEdit={vi.fn()} />);

    const ta = select();
    expect(screen.getByRole('button', { name: /^edit/i })).toBeTruthy();

    fireEvent.keyDown(ta, { key: 'k', metaKey: true });
    expect(screen.getByPlaceholderText(/describe the change to the selection/i)).toBeTruthy();
  });

  it('calls onSelectionEdit with the selection, range, and instruction on submit', () => {
    const onSelectionEdit = vi.fn();
    render(<PmlCodeEditor value={source} onChange={() => undefined} onSelectionEdit={onSelectionEdit} />);

    const ta = select();
    const start = source.indexOf('<button');
    fireEvent.keyDown(ta, { key: 'k', metaKey: true });

    const input = screen.getByPlaceholderText(/describe the change to the selection/i);
    fireEvent.change(input, { target: { value: 'make it a contact button' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelectionEdit).toHaveBeenCalledWith(
      '<button label=Welcome/>',
      { start, end: source.length },
      'make it a contact button',
    );
  });

  it('does not show the affordance when onSelectionEdit is not provided', () => {
    render(<PmlCodeEditor value={source} onChange={() => undefined} />);

    select();
    expect(screen.queryByRole('button', { name: /^edit/i })).toBeNull();
  });
});

describe('PmlCodeEditor scaffold-from-comment pill (E2)', () => {
  const putCaretOn = (ta: HTMLTextAreaElement, needle: string) => {
    const pos = ta.value.indexOf(needle) + 2; // collapse the caret inside the target line
    ta.setSelectionRange(pos, pos);
    fireEvent.select(ta);
  };

  const editor = () => screen.getByLabelText('Page PML source') as HTMLTextAreaElement;

  it('shows the pill on a PML comment line and scaffolds with pml context', () => {
    const onScaffold = vi.fn();
    render(
      <PmlCodeEditor value={'<hero/>\n<!-- create a 2-column grid -->'} onChange={() => undefined} onScaffold={onScaffold} />,
    );

    putCaretOn(editor(), '<!--');
    fireEvent.click(screen.getByTestId('pml-scaffold-pill'));

    expect(onScaffold).toHaveBeenCalledWith({ line: 2, comment: 'create a 2-column grid', context: 'pml' });
  });

  it('shows the pill on a PSL comment line inside a script with psl context', () => {
    const onScaffold = vi.fn();
    render(
      <PmlCodeEditor value={'<script>\n// create a factorial function\n</script>'} onChange={() => undefined} onScaffold={onScaffold} />,
    );

    putCaretOn(editor(), '// create');
    fireEvent.click(screen.getByTestId('pml-scaffold-pill'));

    expect(onScaffold).toHaveBeenCalledWith({ line: 2, comment: 'create a factorial function', context: 'psl' });
  });

  it('shows no pill on a normal code line', () => {
    render(<PmlCodeEditor value={'<hero headline="Study"/>'} onChange={() => undefined} onScaffold={vi.fn()} />);

    const ta = editor();
    ta.setSelectionRange(3, 3);
    fireEvent.select(ta);

    expect(screen.queryByTestId('pml-scaffold-pill')).toBeNull();
  });

  it('shows no pill when onScaffold is not provided', () => {
    render(<PmlCodeEditor value={'<!-- create a grid -->'} onChange={() => undefined} />);

    const ta = editor();
    ta.setSelectionRange(2, 2);
    fireEvent.select(ta);

    expect(screen.queryByTestId('pml-scaffold-pill')).toBeNull();
  });
});

describe('PmlCodeEditor inline autocomplete (F2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCompletePml.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const caretAtEnd = (ta: HTMLTextAreaElement) => {
    ta.setSelectionRange(ta.value.length, ta.value.length);
    fireEvent.select(ta);
  };

  it('shows ghost text after the debounce and Tab accepts it', async () => {
    mockCompletePml.mockResolvedValue({ completion: ' label="Go"/>' });
    const onChange = vi.fn();
    render(<PmlCodeEditor value={'<button'} onChange={onChange} pageId="p1" completionApi={completionApi} completionEnabled />);

    const ta = screen.getByLabelText('Page PML source') as HTMLTextAreaElement;
    caretAtEnd(ta);

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByTestId('pml-ghost').textContent).toBe(' label="Go"/>');

    fireEvent.keyDown(ta, { key: 'Tab' });
    expect(onChange).toHaveBeenCalledWith('<button label="Go"/>');
  });

  it('Escape dismisses the ghost without inserting it', async () => {
    // A space-prefixed AI completion after a complete tag - coherent, so a ghost appears to dismiss.
    mockCompletePml.mockResolvedValue({ completion: ' label="Go"/>' });
    render(<PmlCodeEditor value={'<button'} onChange={() => undefined} pageId="p1" completionApi={completionApi} completionEnabled />);

    const ta = screen.getByLabelText('Page PML source') as HTMLTextAreaElement;
    caretAtEnd(ta);

    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getByTestId('pml-ghost')).toBeTruthy();

    fireEvent.keyDown(ta, { key: 'Escape' });
    expect(screen.queryByTestId('pml-ghost')).toBeNull();
  });

  it('does not autocomplete without pageId + completionEnabled', async () => {
    mockCompletePml.mockResolvedValue({ completion: 'XYZ' });
    render(<PmlCodeEditor value={'<button'} onChange={() => undefined} />);

    const ta = screen.getByLabelText('Page PML source') as HTMLTextAreaElement;
    caretAtEnd(ta);

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(mockCompletePml).not.toHaveBeenCalled();
    expect(screen.queryByTestId('pml-ghost')).toBeNull();
  });

  it('does not autocomplete on a comment line (the scaffold pill owns it)', async () => {
    mockCompletePml.mockResolvedValue({ completion: 'XYZ' });
    render(<PmlCodeEditor value={'<!-- create a two column grid -->'} onChange={() => undefined} pageId="p1" completionApi={completionApi} completionEnabled />);

    const ta = screen.getByLabelText('Page PML source') as HTMLTextAreaElement;
    ta.setSelectionRange(6, 6); // caret inside the comment line
    fireEvent.select(ta);

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(mockCompletePml).not.toHaveBeenCalled();
    expect(screen.queryByTestId('pml-ghost')).toBeNull();
  });
});

describe('PmlCodeEditor review overlay (embedded diff)', () => {
  const errorDiag: PmlDiagnostic[] = [
    { severity: 'error', message: 'Unknown component "nope".', line: 2, col: 1, source: 'compile' },
  ];

  it('renders the review overlay inside the editor and freezes it', () => {
    render(
      <PmlCodeEditor
        value={'<hero/>\n<nope/>'}
        onChange={() => undefined}
        diagnostics={errorDiag}
        onFixError={vi.fn()}
        reviewOverlay={<div data-testid="the-diff">diff here</div>}
      />,
    );

    // The overlay (the Porter diff) renders INSIDE the editor frame.
    expect(screen.getByTestId('pml-review-overlay')).toBeTruthy();
    expect(screen.getByTestId('the-diff')).toBeTruthy();

    // The textarea is frozen so the buffer can't be edited behind the diff.
    const ta = screen.getByLabelText('Page PML source') as HTMLTextAreaElement;
    expect(ta.readOnly).toBe(true);

    // The editor's own affordance (here the fix-error gutter button) is hidden so it can't poke through.
    expect(screen.queryByTestId('pml-fix-error')).toBeNull();
  });

  it('renders no overlay and stays editable when reviewOverlay is absent', () => {
    render(<PmlCodeEditor value={'<hero/>\n<nope/>'} onChange={() => undefined} diagnostics={errorDiag} onFixError={vi.fn()} />);

    expect(screen.queryByTestId('pml-review-overlay')).toBeNull();
    const ta = screen.getByLabelText('Page PML source') as HTMLTextAreaElement;
    expect(ta.readOnly).toBe(false);
    // Without an overlay the fix-error button is present (the guard only hides it while reviewing).
    expect(screen.getByTestId('pml-fix-error')).toBeTruthy();
  });
});

describe('PmlCodeEditor fix-with-Porter gutter (FX1)', () => {
  const diagnostics: PmlDiagnostic[] = [
    { severity: 'error', message: 'Unknown component "nope".', line: 2, col: 1, source: 'compile' },
    { severity: 'warning', message: 'PSL: undefined variable', line: 4, col: 5, source: 'psl' },
  ];

  it('shows a Fix-with-Porter button on each ERROR line and calls onFixError', () => {
    const onFixError = vi.fn();
    render(
      <PmlCodeEditor value={'<hero/>\n<nope/>\n\nlet x'} onChange={() => undefined} diagnostics={diagnostics} onFixError={onFixError} />,
    );

    const buttons = screen.getAllByTestId('pml-fix-error');
    expect(buttons).toHaveLength(1); // the error line (2) only, not the warning (4)
    expect(buttons[0].getAttribute('data-line')).toBe('2');

    fireEvent.click(buttons[0]);
    expect(onFixError).toHaveBeenCalledWith(2, 'Unknown component "nope".');
  });

  it('shows no fix button without errors, or when onFixError is not provided', () => {
    const { rerender } = render(
      <PmlCodeEditor value={'<hero/>'} onChange={() => undefined} diagnostics={[]} onFixError={vi.fn()} />,
    );
    expect(screen.queryByTestId('pml-fix-error')).toBeNull();

    rerender(<PmlCodeEditor value={'<hero/>\n<nope/>'} onChange={() => undefined} diagnostics={diagnostics} />);
    expect(screen.queryByTestId('pml-fix-error')).toBeNull(); // no onFixError prop
  });
});

describe('PmlCodeEditor jumpTo (2026-11-10)', () => {
  it('scrolls back across to a line start the view had scrolled past, and leaves a visible column alone', () => {
    const ref = React.createRef<PmlCodeEditorHandle>();
    const long = `<hero subhead="${'a'.repeat(300)}"/>`;

    render(<PmlCodeEditor ref={ref} value={`${long}\n\n<list heading="Draw types"/>`} onChange={() => undefined} />);

    const ta = screen.getByLabelText('Page PML source') as HTMLTextAreaElement;
    let left = 1433;

    // jsdom lays nothing out: the box is 800px wide and was scrolled to the end of the long first line.
    Object.defineProperty(ta, 'clientWidth', { configurable: true, value: 800 });
    Object.defineProperty(ta, 'scrollLeft', { configurable: true, get: () => left, set: (value: number) => { left = value; } });

    act(() => ref.current?.jumpTo(3, 1));
    expect(left).toBe(0);
    expect(ta.selectionStart).toBe(long.length + 2);

    left = 0;
    act(() => ref.current?.jumpTo(3, 5));
    expect(left).toBe(0);
  });
});

describe('PmlCodeEditor in the host words', () => {
  it("names the host's assistant on its pills and fix buttons, and nobody without one", async () => {
    const { BuilderHostProvider } = await import('../../../src/builder/editor/host');
    const errors: PmlDiagnostic[] = [{ severity: 'error', message: 'Unknown component', line: 1, col: 1, source: 'compile' }];
    const { rerender } = render(<PmlCodeEditor value={'<nope/>'} onChange={() => undefined} diagnostics={errors} onFixError={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Fix the error on line 1' })).toBeTruthy();

    rerender(
      <BuilderHostProvider assistantName="Mira">
        <PmlCodeEditor value={'<nope/>'} onChange={() => undefined} diagnostics={errors} onFixError={vi.fn()} />
      </BuilderHostProvider>,
    );
    expect(screen.getByRole('button', { name: 'Fix the error on line 1 with Mira' })).toBeTruthy();
  });
});
