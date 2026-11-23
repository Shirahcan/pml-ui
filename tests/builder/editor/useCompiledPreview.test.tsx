import { act, renderHook, waitFor } from '@testing-library/react';

import { useCompiledPreview } from '../../../src/builder/editor/useCompiledPreview';
import type { PmlNode } from '../../../src/language';

const good = [{ primitive: 'heading', props: { text: 'Who can apply', level: 2 } }] as unknown as PmlNode[];
const broken = [{ primitive: 'heading', props: { text: 'Who can' } }] as unknown as PmlNode[];

function adapterFailingOn(bad: PmlNode[], message = 'Half-typed.') {
  return {
    preview: vi.fn(async (_id: string, nodes: PmlNode[]) =>
      nodes === bad ? { tree: [], natives: null, error: { message, path: 'node.props.text' } } : { tree: nodes, natives: null, error: null },
    ),
  };
}

/** A failed draw: loud when the design never drew (the saved design is at fault), quiet mid-edit (2026-11-23). */
describe('useCompiledPreview', () => {
  it('keeps the last good draw and tells nobody when an edit fails after a good draw', async () => {
    const onError = vi.fn();
    const adapter = adapterFailingOn(broken);
    const { result, rerender } = renderHook(({ nodes }) => useCompiledPreview(adapter, 'p1', nodes, true, onError), { initialProps: { nodes: good } });
    await waitFor(() => expect(result.current.compiled).not.toBeNull(), { timeout: 3000 });

    rerender({ nodes: broken });
    await waitFor(() => expect(result.current.previewError?.message).toBe('Half-typed.'), { timeout: 3000 });

    expect(result.current.compiled).not.toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it('tells the host once when the design never drew, however many times it fails for the same reason', async () => {
    const onError = vi.fn();
    const again = [...broken] as PmlNode[];
    const adapter = {
      preview: vi.fn(async () => ({ tree: [], natives: null, error: { message: '"value" must be a string.', path: 'node.props.value' } })),
    };
    const { result, rerender } = renderHook(({ nodes }) => useCompiledPreview(adapter, 'p1', nodes, true, onError), { initialProps: { nodes: broken } });
    await waitFor(() => expect(result.current.previewError).not.toBeNull(), { timeout: 3000 });

    rerender({ nodes: again });
    await waitFor(() => expect(adapter.preview).toHaveBeenCalledTimes(2), { timeout: 3000 });

    expect(result.current.compiled).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('The canvas could not draw this design ("value" must be a string. at node.props.value).');

    // Another document opens: its own first failure is heard again.
    act(() => result.current.reset());
    rerender({ nodes: [...broken] as PmlNode[] });
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(2), { timeout: 3000 });
  });
});
