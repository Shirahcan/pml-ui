import { renderHook, act } from '@testing-library/react';

import { completionContextAt, isCoherentPmlCompletion, structuralCompletionAt, usePmlCompletion } from '../../src/pml/completion';

// The host's API is injected (E1): a fake stands in for Portify's site-builder API.
const mockComplete = vi.fn();
const api = { completePml: mockComplete };

describe('completionContextAt', () => {
  const src = '<hero/>\n<script>\nlet x = 1\n</script>\n<footer/>';

  it('is pml in markup and psl inside a <script> body', () => {
    expect(completionContextAt(src, 3)).toBe('pml'); // in <hero
    expect(completionContextAt(src, src.indexOf('let x') + 2)).toBe('psl'); // in the script body
    expect(completionContextAt(src, src.length - 2)).toBe('pml'); // in <footer
  });
});

describe('isCoherentPmlCompletion', () => {
  it('keeps a completion that continues a partial tag into a real tag', () => {
    expect(isCoherentPmlCompletion('<hero/>\n<but', 'ton label="Go"/>')).toBe(true); // -> button
    expect(isCoherentPmlCompletion('<butt', 'on/>')).toBe(true); // -> button
    expect(isCoherentPmlCompletion('<he', 'ading text="Hi"/>')).toBe(true); // -> heading
    expect(isCoherentPmlCompletion('<scr', 'ipt>')).toBe(true); // -> script (a primitive, not in the catalog)
    expect(isCoherentPmlCompletion('<contact-f', 'orm/>')).toBe(true); // kebab -> contact_form
  });

  it('drops a completion that restarts a DIFFERENT tag', () => {
    expect(isCoherentPmlCompletion('<but', 'box>')).toBe(false); // butbox is not a tag
    expect(isCoherentPmlCompletion('<xy', 'zzy')).toBe(false);
  });

  it('is coherent when the caret is not mid-tag-name', () => {
    expect(isCoherentPmlCompletion('<button ', 'label="Go"/>')).toBe(true);
    expect(isCoherentPmlCompletion('let x = ', '1')).toBe(true);
    expect(isCoherentPmlCompletion('', 'anything')).toBe(true);
  });
});

describe('structuralCompletionAt', () => {
  it('completes a partial tag name', () => {
    expect(structuralCompletionAt('<but', 4)).toBe('ton'); // -> button
    const src = '<hero/>\n<box>\n  <scr';
    expect(structuralCompletionAt(src, src.length)).toBe('ipt'); // -> script
  });

  it('completes a partial attribute name and opens its quotes', () => {
    expect(structuralCompletionAt('<button la', 10)).toBe('bel="');
    expect(structuralCompletionAt('<button hr', 10)).toBe('ef="');
  });

  it('completes a partial enum value inside its quotes and closes them', () => {
    expect(structuralCompletionAt('<button variant="pri', 20)).toBe('mary"'); // primary
    expect(structuralCompletionAt('<box align="cen', 15)).toBe('ter"'); // center (a global style enum)
  });

  it('returns null in a free-text string value (AI territory)', () => {
    expect(structuralCompletionAt('<button label="Buy no', 21)).toBeNull();
  });

  it('returns null in prose, with no partial, and for a free-text value', () => {
    expect(structuralCompletionAt('<hero/>\nSome pro', 16)).toBeNull(); // prose between tags
    expect(structuralCompletionAt('<button ', 8)).toBeNull(); // no attribute partial yet
    expect(structuralCompletionAt('<button variant="', 17)).toBeNull(); // no value partial yet
    expect(structuralCompletionAt('<button href="x', 15)).toBeNull(); // href is free text, not an enum
  });

  it('returns null inside a <script> (PSL is free-text for the AI)', () => {
    const src = '<script>\nlet x = fo';
    expect(structuralCompletionAt(src, src.length)).toBeNull();
  });
});

describe('usePmlCompletion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockComplete.mockReset();
    mockComplete.mockResolvedValue({ completion: 'X' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call until the debounce elapses', () => {
    renderHook(() => usePmlCompletion(api, 'p1', '<button', 7, true));

    act(() => {
      vi.advanceTimersByTime(599);
    });
    expect(mockComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled', () => {
    renderHook(() => usePmlCompletion(api, 'p1', '<button', 7, false));

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('shows a deterministic structural completion INSTANTLY, without an AI call', () => {
    const { result } = renderHook(() => usePmlCompletion(api, 'p1', '<hero/>\n<but', 12, true));

    // No timer advance: the structural ghost is local + instant.
    expect(result.current.suggestion).toBe('ton'); // <but -> button
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('falls back to the debounced AI only for a free-text position', async () => {
    mockComplete.mockResolvedValue({ completion: 'X' });
    renderHook(() => usePmlCompletion(api, 'p1', '<hero/>\nSome pro', 16, true)); // prose, not structural

    expect(mockComplete).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(mockComplete).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the caret line has too little context', () => {
    renderHook(() => usePmlCompletion(api, 'p1', '<', 1, true));

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('sends the caret prefix/suffix and derived context', async () => {
    const src = '<script>\nlet ';
    renderHook(() => usePmlCompletion(api, 'p1', src, src.length, true));

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(mockComplete).toHaveBeenCalledWith('p1', src, '', 'psl');
  });

  it('surfaces the completion after the debounce', async () => {
    mockComplete.mockResolvedValue({ completion: ' label="Go"/>' });
    const { result } = renderHook(() => usePmlCompletion(api, 'p1', '<button', 7, true));

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.suggestion).toBe(' label="Go"/>');
  });

  it('drops a null completion', async () => {
    mockComplete.mockResolvedValue({ completion: null });
    const { result } = renderHook(() => usePmlCompletion(api, 'p1', '<button', 7, true));

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.suggestion).toBeNull();
  });

  it('never throws on a rejected request', async () => {
    mockComplete.mockRejectedValue(new Error('model down'));
    // A free-text position (a string value), so the AI path runs and can reject.
    const { result } = renderHook(() => usePmlCompletion(api, 'p1', '<hero headline="Stu', 19, true));

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.suggestion).toBeNull();
  });

  // (Tag-name coherence is now handled DETERMINISTICALLY by structuralCompletionAt - a `<but` never
  // reaches the AI - so the AI coherence guard is a backstop, exercised by the isCoherentPmlCompletion
  // unit tests above rather than through the hook.)
});
