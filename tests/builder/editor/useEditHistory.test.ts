import { act, renderHook } from '@testing-library/react';

import type { PmlNode } from '../../../src/language';

import { useEditHistory } from '../../../src/builder/editor/useEditHistory';

const tree = (text: string): PmlNode[] => [{ primitive: 'heading', props: { text, level: 2 } } as PmlNode];

describe('undo and redo of the page tree', () => {
  beforeEach(() => vi.useFakeTimers({ now: 1_000_000 }));
  afterEach(() => vi.useRealTimers());

  it('goes back and forward through separate changes', () => {
    const { result } = renderHook(() => useEditHistory());
    const [a, b] = [tree('a'), tree('b')];

    act(() => result.current.record(a));
    expect(result.current.canUndo).toBe(true);

    let back: PmlNode[] | null = null;
    act(() => {
      back = result.current.undo(b);
    });
    expect(back).toBe(a);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    let forward: PmlNode[] | null = null;
    act(() => {
      forward = result.current.redo(a);
    });
    expect(forward).toBe(b);
  });

  it('treats typing as one step, and a pause as a new one', () => {
    const { result } = renderHook(() => useEditHistory());

    act(() => result.current.record(tree('a')));
    act(() => {
      vi.setSystemTime(1_000_300);
      result.current.record(tree('ab'));
    });
    act(() => {
      vi.setSystemTime(1_000_600);
      result.current.record(tree('abc'));
    });

    let back: PmlNode[] | null = null;
    act(() => {
      back = result.current.undo(tree('abcd'));
    });
    expect(back).toEqual(tree('a'));
    expect(result.current.canUndo).toBe(false);
  });

  it('forgets redo after a new change, and answers null with nothing to undo', () => {
    const { result } = renderHook(() => useEditHistory());

    expect(result.current.undo(tree('a'))).toBeNull();

    act(() => result.current.record(tree('a')));
    act(() => {
      result.current.undo(tree('b'));
    });
    expect(result.current.canRedo).toBe(true);

    act(() => {
      vi.setSystemTime(1_005_000);
      result.current.record(tree('a'));
    });
    expect(result.current.canRedo).toBe(false);
  });
});
