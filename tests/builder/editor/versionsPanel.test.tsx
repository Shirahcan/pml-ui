import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';

import type { DocumentAdapter, DocumentVersion, DocumentVersionsPort } from '../../../src/builder/document';
import { VersionsPanel } from '../../../src/builder/editor/VersionsPanel';
import { useDocumentEditor } from '../../../src/builder/editor/useDocumentEditor';
import type { PmlNode } from '../../../src/language';

const heading = (uid: string, text: string) => ({ primitive: 'heading', uid, props: { text, level: 1 } }) as unknown as PmlNode;
const said = () => ({ onSuccess: vi.fn(), onWarning: vi.fn(), onError: vi.fn() });

const version = (over: Partial<DocumentVersion> = {}): DocumentVersion => ({
  id: 'v1',
  kind: 'published',
  title: 'Positive LMIA Work Permit',
  elements: 36,
  byName: 'Ada Okafor',
  at: '2026-11-24T19:56:00Z',
  current: false,
  ...over,
});

/** Plan close-multi-pass-gaps-2026-11-24 P9: an earlier version back in the draft, never live, one undo step. */
describe('restoreVersion', () => {
  function adapterWith(load: ReturnType<typeof vi.fn>, restore: DocumentVersionsPort['restore']) {
    return {
      load,
      saveDraft: vi.fn(async () => ({ revision: 'r9' })),
      preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
      preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
      versions: { list: vi.fn(async () => []), restore: vi.fn(restore) },
    } as unknown as DocumentAdapter & { versions: { restore: ReturnType<typeof vi.fn> } };
  }

  it('restores at the revision on screen, takes the restored draft as one undo step, and publishes nothing', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ document: { nodes: [heading('abc111', 'Without the FAQ')] }, revision: 'r1', meta: {} })
      .mockResolvedValueOnce({ document: { nodes: [heading('abc111', 'With the FAQ')] }, revision: 'r2', meta: {} });
    const adapter = adapterWith(load, async () => ({ revision: 'r2' }));
    const toasts = said();
    const { result } = renderHook(() => useDocumentEditor(adapter, 'p1', toasts));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canRestoreVersions).toBe(true);

    await act(async () => {
      expect(await result.current.restoreVersion('v1')).toBe(true);
    });

    expect(adapter.versions.restore).toHaveBeenCalledWith('p1', 'v1', 'r1', result.current.session);
    expect(result.current.nodes[0].props?.text).toBe('With the FAQ');
    expect(adapter.saveDraft).not.toHaveBeenCalled();
    expect(toasts.onSuccess).toHaveBeenCalledWith(expect.stringContaining('Readers see it once you publish'));
    act(() => result.current.undoEdit());
    expect(result.current.nodes[0].props?.text).toBe('Without the FAQ');
  });

  it('a newer draft saved elsewhere is a conflict, and nothing on screen changes', async () => {
    const load = vi.fn().mockResolvedValue({ document: { nodes: [heading('abc111', 'Mine')] }, revision: 'r1', meta: {} });
    const adapter = adapterWith(load, async () => ({ conflict: { message: 'Saved elsewhere', by: null, at: null, revision: 'r5' } }));
    const { result } = renderHook(() => useDocumentEditor(adapter, 'p1', said()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.restoreVersion('v1')).toBe(false);
    });

    expect(result.current.conflict).not.toBeNull();
    expect(result.current.nodes[0].props?.text).toBe('Mine');
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('VersionsPanel', () => {
  it('lists the versions, marks the one in the editor, and restores only after asking', async () => {
    const port = {
      list: vi.fn(async () => [version({ id: 'v2', current: true, elements: 18 }), version({ id: 'v1' })]),
      restore: vi.fn(),
    };
    const onRestore = vi.fn(async () => true);
    render(<VersionsPanel id="p1" port={port} noun="post" onRestore={onRestore} />);

    expect(await screen.findByText('In the editor now')).toBeTruthy();
    expect(screen.getByText(/36 elements/)).toBeTruthy();
    expect(screen.getAllByText('Published')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('Put this version in the draft?')).toBeTruthy();
    expect(onRestore).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Put it in the draft' }));
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith('v1'));
    await waitFor(() => expect(port.list).toHaveBeenCalledTimes(2));
  });

  it('says why the versions could not be read and offers to try again', async () => {
    const port = { list: vi.fn().mockRejectedValueOnce(new Error('The service is not reachable.')).mockResolvedValueOnce([]), restore: vi.fn() };
    render(<VersionsPanel id="p1" port={port} noun="post" onRestore={vi.fn()} />);

    expect(await screen.findByText(/The service is not reachable\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/No earlier versions yet/)).toBeTruthy();
  });
});
