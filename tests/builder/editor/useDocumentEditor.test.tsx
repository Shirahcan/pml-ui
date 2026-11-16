import { act, renderHook, waitFor } from '@testing-library/react';

import type { DocumentAdapter } from '../../../src/builder/document';
import { useDocumentEditor } from '../../../src/builder/editor/useDocumentEditor';
import type { PmlNode } from '../../../src/language';

const tree = [{ primitive: 'heading', props: { text: 'Hello', level: 1 } }] as unknown as PmlNode[];

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

/** The visual editor's state for any document kind (shared program E4a4i). */
describe('useDocumentEditor', () => {
  it('loads through the host loader when given, gives every element an id, and keeps the host object', async () => {
    const adapter = fakeAdapter();
    const load = vi.fn(async () => ({ nodes: tree, revision: 'r9', host: { title: 'Pricing' } }));
    const { result } = renderHook(() => useDocumentEditor(adapter, 'p1', { load, ...said() }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(load).toHaveBeenCalledWith('p1');
    expect(adapter.load).not.toHaveBeenCalled();
    expect(result.current.host).toEqual({ title: 'Pricing' });
    expect((result.current.nodes[0] as { uid?: string }).uid).toBeTruthy();
  });

  it('autosaves an edit from the revision it loaded, as this editor', async () => {
    const adapter = fakeAdapter();
    const { result } = renderHook(() => useDocumentEditor(adapter, 'p1', said()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.change([...result.current.nodes, { primitive: 'p', props: {} } as unknown as PmlNode]));
    expect(result.current.dirty).toBe(true);
    await act(async () => {
      expect(await result.current.flush()).toBe(true);
    });

    const call = (adapter.saveDraft as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe('p1');
    expect(call[2]).toBe('r1');
    expect(typeof call[3]).toBe('string');
    expect(result.current.dirty).toBe(false);
  });

  it('turns a refused save into a conflict, and Keep mine saves from the newer revision', async () => {
    const saveDraft = vi.fn().mockResolvedValueOnce({ conflict: { revision: 'r5' } }).mockResolvedValue({ revision: 'r6' });
    const adapter = fakeAdapter({ saveDraft });
    const { result } = renderHook(() => useDocumentEditor(adapter, 'p1', said()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.change([]));
    await act(async () => {
      expect(await result.current.flush()).toBe(false);
    });
    expect(result.current.conflict).toEqual({ revision: 'r5' });
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      result.current.keepMine();
    });
    await waitFor(() => expect(result.current.conflict).toBeNull());
    expect(saveDraft.mock.calls[1][2]).toBe('r5');
  });

  it('shows a refusal and placeholders in place, and says so when published', async () => {
    const publish = vi
      .fn()
      .mockResolvedValueOnce({ refused: { mayPublish: false, findings: [{ source: 'pack', severity: 'block', rule: 'x', message: 'No guarantees.', excerpt: null, suggestion: null }] } })
      .mockResolvedValueOnce({ placeholders: { message: 'Replace them.', total: 1, pictures: 1, other: 0, examples: ['Add a photo'] } })
      .mockResolvedValueOnce({ published: true });
    const messages = said();
    const refreshHost = vi.fn(async () => ({ status: 'published' }));
    const onPublished = vi.fn();
    const adapter = fakeAdapter({ publish }); // stable: a new adapter each render reloads each render
    const { result } = renderHook(() => useDocumentEditor(adapter, 'p1', { ...messages, refreshHost, onPublished, publishedMessage: 'Live.' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.publish());
    expect(result.current.scan?.findings[0].message).toBe('No guarantees.');

    await act(() => result.current.publish());
    expect(result.current.placeholdersLeft).toEqual({ message: 'Replace them.', left: { total: 1, pictures: 1, other: 0, examples: ['Add a photo'] } });

    await act(() => result.current.publish());
    expect(refreshHost).toHaveBeenCalledWith('p1');
    expect(result.current.host).toEqual({ status: 'published' });
    expect(messages.onSuccess).toHaveBeenCalledWith('Live.');
    expect(result.current.scan).toBeNull();
  });

  it('sends a waiting save when the editor closes, and says so if it was refused', async () => {
    const saveDraft = vi.fn(async () => ({ conflict: { revision: 'r7' } }));
    const messages = said();
    const adapter = fakeAdapter({ saveDraft });
    const { result, unmount } = renderHook(() => useDocumentEditor(adapter, 'p1', { ...messages, noun: 'email' }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.change([]));
    unmount();

    await waitFor(() => expect(messages.onError).toHaveBeenCalledWith(expect.stringContaining('Your last change to this email was not saved')));
  });
});
