import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { DocumentVersion, DocumentVersionCompare } from '../../../src/builder/document';
import { VersionsPanel } from '../../../src/builder/editor/VersionsPanel';
import type { PmlNode } from '../../../src/language';

const heading = (uid: string, text: string) => ({ primitive: 'heading', uid, props: { text, level: 2 } }) as unknown as PmlNode;

const intro = heading('intro001', 'Positive LMIA, then the permit');
const faq = heading('faqhead1', 'Common questions');
/** What the editor holds now: the FAQ was removed after the version was published. */
const editorNodes = [intro];

const version = (over: Partial<DocumentVersion> = {}): DocumentVersion => ({
  id: 'v1',
  kind: 'published',
  title: 'Positive LMIA Work Permit',
  elements: 2,
  byName: 'Ada Okafor',
  at: '2026-11-24T19:56:00Z',
  current: false,
  changes: null,
  ...over,
});

const compared: DocumentVersionCompare = {
  version: { id: 'v1', kind: 'published', title: 'Positive LMIA Work Permit', elements: 2, byName: 'Ada Okafor', at: '2026-11-24T19:56:00Z', nodes: [intro, faq] },
  preview: { tree: [intro, faq], natives: null, error: null },
  changes: [{ uid: 'faqhead1', label: 'heading “Common questions”', how: 'removed' }],
  summary: { words: 'removed 1 element (the heading “Common questions”)', counts: { added: 0, changed: 0, removed: 1 } },
};

function panel(compare: ReturnType<typeof vi.fn>, versions: DocumentVersion[] = [version({ id: 'v2', current: true }), version()]) {
  const port = { list: vi.fn(async () => versions), restore: vi.fn(), compare };
  render(
    <VersionsPanel
      id="p1"
      port={port}
      noun="post"
      onRestore={vi.fn(async () => true)}
      compareWith={{ nodes: editorNodes, compiled: editorNodes, natives: null, site: {} }}
    />,
  );

  return port;
}

/** Versions compare (plan versions-compare-2026-11-24 P4, owner 2026-11-24: "Add side-by-side compare to Versions"). */
describe('VersionCompare', () => {
  it('says on each row what changed since the version before, and offers Compare only where there is something to compare', async () => {
    panel(vi.fn(), [
      version({ id: 'v2', current: true }),
      version({ changes: { words: 'removed 1 element (the heading “Common questions”)', counts: { added: 0, changed: 0, removed: 1 } } }),
    ]);

    expect(await screen.findByText('Since the version before: Removed 1 element (the heading “Common questions”).')).toBeTruthy();
    // The row in the editor now has nothing to compare or restore.
    expect(screen.getAllByRole('button', { name: 'Compare' })).toHaveLength(1);
  });

  it('draws the version beside the editor and marks what the editor lost', async () => {
    const compare = vi.fn(async () => compared);
    panel(compare);
    fireEvent.click(await screen.findByRole('button', { name: 'Compare' }));

    const dialog = await screen.findByRole('dialog');
    expect(compare).toHaveBeenCalledWith('p1', 'v1', editorNodes);
    expect(await within(dialog).findByText('Removed 1 element (the heading “Common questions”).')).toBeTruthy();

    const versionPane = within(dialog).getByRole('region', { name: /^Published/ });
    const editorPane = within(dialog).getByRole('region', { name: 'In the editor now' });
    await waitFor(() => expect(versionPane.querySelector('[data-compare-mark="removed"]')).not.toBeNull());
    expect(versionPane.querySelector('[data-compare-section="1"]')?.getAttribute('data-compare-mark')).toBe('removed');
    expect(editorPane.querySelector('[data-compare-mark]')).toBeNull();

    // Picking the change in the list points at it.
    fireEvent.click(within(dialog).getByRole('button', { name: /Removed heading “Common questions”/ }));
    expect(versionPane.querySelector('[data-compare-section="1"]')?.hasAttribute('data-compare-focus')).toBe(true);
  });

  it('restores from the compare only through the same ask as the list', async () => {
    panel(vi.fn(async () => compared));
    fireEvent.click(await screen.findByRole('button', { name: 'Compare' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Put this version in the draft' }));

    expect(await screen.findByText('Put this version in the draft?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Put it in the draft' })).toBeTruthy();
  });

  it('says why a compare failed and tries again', async () => {
    const compare = vi.fn().mockRejectedValueOnce(new Error('The growth service did not answer.')).mockResolvedValueOnce(compared);
    panel(compare);
    fireEvent.click(await screen.findByRole('button', { name: 'Compare' }));

    expect(await screen.findByText('The versions could not be compared: The growth service did not answer.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Removed 1 element (the heading “Common questions”).')).toBeTruthy();
    expect(compare).toHaveBeenCalledTimes(2);
  });

  it('says so when the editor holds the same design', async () => {
    panel(vi.fn(async () => ({ ...compared, changes: [], summary: { words: '', counts: { added: 0, changed: 0, removed: 0 } } })));
    fireEvent.click(await screen.findByRole('button', { name: 'Compare' }));

    expect(await screen.findByText('The editor holds the same design as this version.')).toBeTruthy();
  });
});
