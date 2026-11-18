import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { EditableDocumentAdapter } from '../../../src/builder/document';
import { PageEditor, type PageEditorControls } from '../../../src/builder/editor/PageEditor';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;

/** A question with the template's Purpose note and a VERIFY check, both pinned to its top-right corner. */
const design = [
  { comment: 'Purpose: a question readers ask, as they would ask it.', note: { for: 'qone01', placement: 'top-right', color: 'blue', author: 'Template' } },
  { comment: 'VERIFY: the fee is still $155 on canada.ca.', note: { for: 'qone01', placement: 'top-right', color: 'yellow', author: 'Porter' } },
  { primitive: 'heading', uid: 'qone01', props: { text: 'Who can apply?', level: 2 } },
] as unknown as PmlNode[];

function open(extra: Partial<React.ComponentProps<typeof PageEditor>> = {}) {
  const adapter = {
    load: vi.fn(async () => ({ document: { nodes: design }, revision: 'd1', meta: { title: 'A post', slug: 'a-post', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } })),
    saveDraft: vi.fn(async () => ({ revision: 'd2' })),
    // The real compile drops comments.
    preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes.filter((node) => !('comment' in node)), natives: null, error: null })),
    preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
  } as unknown as EditableDocumentAdapter & { saveDraft: ReturnType<typeof vi.fn> };
  let controls = null as PageEditorControls | null;
  render(
    <PageEditor
      adapter={adapter}
      id="p1"
      labels={{ noun: 'post' }}
      renderControls={(c) => {
        controls = c;
        return null;
      }}
      {...extra}
    />,
  );

  return { adapter, controls: () => controls };
}

/** Owner 2026-11-17: comments surface in the post designer "similar to figma comments". */
describe('studio comments in the page editor', () => {
  it('draws each comment as a pin on its element; two on one corner never cover each other', async () => {
    open();
    const purpose = await screen.findByRole('button', { name: /Comment by Template: Purpose/ }, { timeout: 3000 });
    const verify = await screen.findByRole('button', { name: /Comment by Porter: VERIFY/ });

    expect(purpose.style.left).not.toBe(verify.style.left);
  });

  it('labels a check beside its pin, so it reads without a click; hovering a pin shows its card', async () => {
    open();
    expect(await screen.findByText('Check: the fee is still $155 on canada.ca.', {}, { timeout: 3000 })).toBeTruthy();

    fireEvent.mouseEnter(await screen.findByRole('button', { name: /Comment by Template: Purpose/ }));
    expect(await screen.findByText('Purpose: a question readers ask, as they would ask it.')).toBeTruthy();
    // A template's note carries no time, and the card says nothing about one.
    expect(screen.queryByText('No time recorded')).toBeNull();
  });

  it('offers the host Show / Hide comments for its menu', async () => {
    const { controls } = open();
    await screen.findByRole('button', { name: /Comment by Template/ }, { timeout: 3000 });

    expect(controls()?.commentMenu.map((item) => item.label)).toEqual(['Hide comments (2)']);
    await act(async () => controls()?.commentMenu[0].onSelect());
    await waitFor(() => expect(screen.queryByRole('button', { name: /Comment by Template/ })).toBeNull());
    await act(async () => controls()?.commentMenu[0].onSelect());
  });

  it('with an author, "Comment" on the selection bar pins a new comment to that element', async () => {
    const { adapter } = open({ commentAuthor: 'Ada Okafor' });
    fireEvent.click(await screen.findByRole('heading', { name: 'Who can apply?' }, { timeout: 3000 }));
    const bar = await screen.findByRole('toolbar', { name: 'Heading tools' }, { timeout: 3000 });

    fireEvent.click(within(bar).getByRole('button', { name: /Comment/ }));
    const text = (await screen.findByPlaceholderText('Write a note for whoever works on this next')) as HTMLTextAreaElement;
    fireEvent.change(text, { target: { value: 'Add the 2026 fee table.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(adapter.saveDraft).toHaveBeenCalled(), { timeout: 5000 });
    const saved = adapter.saveDraft.mock.calls.at(-1)?.[1] as { nodes: PmlNode[] };
    const added = saved.nodes.find((node) => node.comment === 'Add the 2026 fee table.');
    expect(added?.note).toEqual(expect.objectContaining({ for: 'qone01', author: 'Ada Okafor' }));
  });

  it('without an author, the bar offers no Comment (the existing comments still show)', async () => {
    open();
    fireEvent.click(await screen.findByRole('heading', { name: 'Who can apply?' }, { timeout: 3000 }));
    const bar = await screen.findByRole('toolbar', { name: 'Heading tools' }, { timeout: 3000 });

    expect(within(bar).queryByRole('button', { name: /^Comment$/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Comment by Template/ })).toBeTruthy();
  });
});

describe("a pin whose host's preview keeps its notes (1c's newsletter, 2026-11-18)", () => {
  it('still draws on its nested element: the canvas compile drops every comment, whatever the service sends', async () => {
    // A box holding a note and the heading it is pinned to; the service's preview returns the tree WITH the note.
    const nested = [
      {
        primitive: 'box',
        uid: 'boxone01',
        children: [
          { primitive: 'text', props: { value: 'November news' } },
          { comment: 'Shorter, please.', note: { for: 'headone1', placement: 'top-right', color: 'yellow', author: 'Ada' } },
          { primitive: 'heading', uid: 'headone1', props: { text: 'What changed this month', level: 2 } },
        ],
      },
    ] as unknown as PmlNode[];
    const adapter = {
      load: vi.fn(async () => ({ document: { nodes: nested }, revision: 'd1', meta: { title: 'News', slug: 'news', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } })),
      saveDraft: vi.fn(async () => ({ revision: 'd2' })),
      // Realistic: the preview keeps the note (growth-service does).
      preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
      preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    } as unknown as EditableDocumentAdapter;
    render(<PageEditor adapter={adapter} id="p1" labels={{ noun: 'newsletter' }} />);

    await screen.findByRole('heading', { name: 'What changed this month' }, { timeout: 3000 });
    expect(await screen.findByRole('button', { name: /Comment by Ada: Shorter, please/ }, { timeout: 3000 })).toBeTruthy();
  });
});
