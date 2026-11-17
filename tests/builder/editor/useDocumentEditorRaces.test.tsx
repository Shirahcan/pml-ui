import { act, renderHook, waitFor } from '@testing-library/react';

import type { DocumentAdapter } from '../../../src/builder/document';
import { useDocumentEditor } from '../../../src/builder/editor/useDocumentEditor';
import type { PmlNode } from '../../../src/language';

const tree = [{ primitive: 'heading', props: { text: 'Hello', level: 1 } }] as unknown as PmlNode[];
const para = (text: string) => ({ primitive: 'p', props: { text } }) as unknown as PmlNode;
const textOf = (node: PmlNode | undefined) => (node as { props?: { text?: string } } | undefined)?.props?.text;

function fakeAdapter(over: Partial<Record<string, unknown>> = {}) {
  const a = {
    load: vi.fn(async () => ({ document: { nodes: tree }, revision: 'r1', meta: {} })),
    saveDraft: vi.fn(async () => ({ revision: 'r2' })),
    preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
    preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    publish: vi.fn(async () => ({ published: true })),
    rollback: vi.fn(async () => undefined),
    previewUrl: vi.fn(async () => 'https://example.com/p'),
    components: { partials: vi.fn(async () => []), library: vi.fn(async () => []) },
    ...over,
  };

  return a as unknown as DocumentAdapter & typeof a;
}

const said = () => ({ onSuccess: vi.fn(), onWarning: vi.fn(), onError: vi.fn() });

/** Races and edges found in review (portify-1c, 2026-11-17): every one of these failed before the fix. */
describe('useDocumentEditor races and edges', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('Load the latest drops a waiting save, shows theirs, and undo cannot bring the discarded draft back', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const load = vi
      .fn()
      .mockResolvedValueOnce({ document: { nodes: tree }, revision: 'r1', meta: {} })
      .mockResolvedValueOnce({ document: { nodes: [para('THEIRS')] }, revision: 'r9', meta: {} });
    const adapter = fakeAdapter({ load });
    const { result } = renderHook(() => useDocumentEditor(adapter, 'p1', said()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.change([para('MINE')]));
    await act(async () => {
      await result.current.loadLatest();
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(adapter.saveDraft).not.toHaveBeenCalled();
    expect(textOf(result.current.nodes[0])).toBe('THEIRS');
    expect(result.current.dirty).toBe(false);
    expect(result.current.canUndo).toBe(false);
  });

  it('an older save landing never marks a newer, failed one as saved, so flush refuses and publish waits', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let releaseFirst: (v: unknown) => void = () => undefined;
    const saveDraft = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (releaseFirst = r)))
      .mockRejectedValue(new Error('network'));
    const adapter = fakeAdapter({ saveDraft });
    const { result } = renderHook(() => useDocumentEditor(adapter, 'p1', said()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.change([para('one')]));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    act(() => result.current.change([para('one'), para('two')]));
    await act(async () => {
      releaseFirst({ revision: 'r2' });
    });
    expect(result.current.dirty).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    let flushed: boolean | undefined;
    await act(async () => {
      flushed = await result.current.flush();
    });
    expect({ dirty: result.current.dirty, flushed }).toEqual({ dirty: true, flushed: false });

    await act(() => result.current.publish());
    expect(adapter.publish).not.toHaveBeenCalled();
  });

  it('saves run one after another, each from the revision the last one returned', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let releaseFirst: (v: unknown) => void = () => undefined;
    const saveDraft = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (releaseFirst = r)))
      .mockResolvedValue({ revision: 'r3' });
    const adapter = fakeAdapter({ saveDraft });
    const { result } = renderHook(() => useDocumentEditor(adapter, 'p1', said()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.change([para('one')]));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    act(() => result.current.change([para('one'), para('two')]));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(saveDraft).toHaveBeenCalledTimes(1); // the second waits for the first

    await act(async () => {
      releaseFirst({ revision: 'r2' });
    });
    await waitFor(() => expect(saveDraft).toHaveBeenCalledTimes(2));
    expect(saveDraft.mock.calls[1][2]).toBe('r2');
    await waitFor(() => expect(result.current.dirty).toBe(false));
  });

  it('a slow earlier compile landing after a newer one is dropped', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let releaseSlow: (v: unknown) => void = () => undefined;
    const preview = vi
      .fn()
      .mockResolvedValueOnce({ tree, natives: null, error: null })
      .mockImplementationOnce(() => new Promise((r) => (releaseSlow = r)))
      .mockImplementation(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null }));
    const adapter = fakeAdapter({ preview });
    const { result } = renderHook(() => useDocumentEditor(adapter, 'p1', said()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    act(() => result.current.change([para('A')]));
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    act(() => result.current.change([para('A'), para('B')]));
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    await act(async () => {
      releaseSlow({ tree: [para('A')], natives: null, error: null });
    });

    expect(result.current.compiled?.length).toBe(2);
  });

  it('onPublished receives the host as refreshed after the publish, and a warning reads as the host words it', async () => {
    const onPublished = vi.fn();
    const messages = said();
    const adapter = fakeAdapter({ publish: vi.fn(async () => ({ published: true, url: null, warning: 'cdn' })) });
    const load = vi.fn(async () => ({ nodes: tree, revision: 'r1', host: { status: 'draft' } }));
    const refreshHost = vi.fn(async () => ({ status: 'published' }));
    const { result } = renderHook(() =>
      useDocumentEditor(adapter, 'p1', { load, refreshHost, onPublished, publishedWarning: 'Saved; it shows everywhere within the hour.', ...messages }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.publish());
    expect(onPublished).toHaveBeenCalledWith({ status: 'published' });
    expect(messages.onWarning).toHaveBeenCalledWith('Saved; it shows everywhere within the hour.');
  });

  it('a document that could not be opened is never saved, says why, and opens on reload', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('500'))
      .mockResolvedValueOnce({ document: { nodes: tree }, revision: 'r4', meta: {} });
    const adapter = fakeAdapter({ load });
    const { result } = renderHook(() => useDocumentEditor(adapter, 'p1', said()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBeInstanceOf(Error);

    act(() => result.current.change([para('only block')]));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(adapter.saveDraft).not.toHaveBeenCalled();

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBeNull();
    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.dirty).toBe(false);

    act(() => result.current.change([...result.current.nodes, para('x')]));
    await act(async () => {
      expect(await result.current.flush()).toBe(true);
    });
    expect((adapter.saveDraft as ReturnType<typeof vi.fn>).mock.calls[0][2]).toBe('r4');
  });

  it('switching documents saves the waiting change to the FIRST one and starts the second clean', async () => {
    const load = vi.fn(async (id: string) => ({ document: { nodes: [para(id)] }, revision: `rev-${id}`, meta: {} }));
    const adapter = fakeAdapter({ load });
    const { result, rerender } = renderHook(({ id }) => useDocumentEditor(adapter, id, said()), { initialProps: { id: 'a' } });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.change([para('a, edited')]));
    rerender({ id: 'b' });
    await waitFor(() => expect(textOf(result.current.nodes[0])).toBe('b'));

    const call = (adapter.saveDraft as ReturnType<typeof vi.fn>).mock.calls[0];
    expect([call[0], call[2]]).toEqual(['a', 'rev-a']);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.dirty).toBe(false);
  });

  it('names its session and what the document can do, and asks before a tab closes on an unsaved change', async () => {
    const adapter = fakeAdapter({ rollback: undefined, previewUrl: undefined });
    const added = vi.spyOn(window, 'addEventListener');
    const { result } = renderHook(() => useDocumentEditor(adapter, 'p1', said()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(typeof result.current.session).toBe('string');
    expect({ publish: result.current.canPublish, rollback: result.current.canRollback, link: result.current.canPreviewLink }).toEqual({
      publish: true,
      rollback: false,
      link: false,
    });

    act(() => result.current.change([para('x')]));
    expect(added).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    await act(async () => {
      expect(await result.current.flush()).toBe(true);
    });
    expect((adapter.saveDraft as ReturnType<typeof vi.fn>).mock.calls[0][3]).toBe(result.current.session);
    added.mockRestore();
  });
});
