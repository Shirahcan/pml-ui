import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { DocumentAdapter } from '../../../src/builder/document';
import { Studio } from '../../../src/builder/editor/PageEditor';
import { BuilderHostProvider } from '../../../src/builder/editor/host';
import { cardPathAt, drawnRoots } from '../../../src/builder/studio/profiles/card';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;
Element.prototype.hasPointerCapture ??= () => false;

const card = [
  { comment: 'Shorter title', note: { for: 'hd1111', placement: 'top-right' } },
  {
    primitive: 'box',
    uid: 'bx1111',
    props: {},
    style: { background: 'accent' },
    children: [{ primitive: 'heading', uid: 'hd1111', props: { text: 'Study in Canada', level: 1 } }],
  },
] as unknown as PmlNode[];

function cardAdapter() {
  return {
    load: vi.fn(async () => ({ document: { nodes: card }, revision: 'r1', meta: {} })),
    saveDraft: vi.fn(async () => ({ revision: 'r2' })),
    preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
    preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    publish: vi.fn(),
    media: { upload: vi.fn(async () => ({ id: 'm1', url: 'https://example.com/a.png', mime: 'image/png', bytes: 1 })), list: vi.fn(), remove: vi.fn() },
  } as unknown as DocumentAdapter;
}

function open(adapter: DocumentAdapter) {
  render(
    <BuilderHostProvider>
      <Studio adapter={adapter} id="p1" profile="card" labels={{ noun: 'card' }} />
    </BuilderHostProvider>,
  );
}

/** The Studio on the card profile (shared PML Studio P2c2/P2c3): the card's own frame, its parts selectable by design path. */
describe('Studio profile="card"', () => {
  it('draws the card in its fixed frame and marks each part with its place in the design', async () => {
    open(cardAdapter());

    await waitFor(() => expect(document.querySelector('[data-pml-card]')).not.toBeNull(), { timeout: 3000 });
    // The comment is not drawn, so the box is the picture's first part but the design's second.
    await waitFor(() => expect(document.querySelector('[data-pml-section="1"]')).not.toBeNull());
    expect(document.querySelector('[data-pml-section="0"]')).toBeNull();
  });

  it('selects a part by a click and offers the card edits beside its settings', async () => {
    open(cardAdapter());

    const heading = await screen.findByText('Study in Canada', {}, { timeout: 3000 });
    fireEvent.click(heading);

    const words = (await screen.findByLabelText('Words', {}, { timeout: 3000 })) as HTMLTextAreaElement;
    expect(words.value).toBe('Study in Canada');
  });

  it('offers only what a card can hold under Add an element', async () => {
    open(cardAdapter());

    fireEvent.click(await screen.findByRole('button', { name: 'Add an element' }, { timeout: 3000 }));
    expect(await screen.findByText('Heading', {}, { timeout: 3000 })).toBeTruthy();
    expect(screen.queryByText('Form')).toBeNull();
  });

  it('converts a drawn mark to the part it names in the design', () => {
    expect(drawnRoots(card)).toEqual([1]);

    const holder = document.createElement('div');
    holder.setAttribute('data-pml-path', '1.0');
    expect(cardPathAt(card, holder)).toEqual([1, 0]);

    const section = document.createElement('div');
    section.setAttribute('data-pml-section', '1');
    expect(cardPathAt(card, section)).toEqual([1]);
    expect(cardPathAt(card, document.createElement('div'))).toBeNull();
  });
});
