import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CardCanvas } from '../../src/builder/card/CardCanvas';
import { abilities, nodeAt, partLabel, parts, removeAt, setAlign, setPicture, setTextColour, setWords } from '../../src/builder/card/cardEdits';
import type { CardDoc, CardDocChange, CardPort } from '../../src/builder/sharing/types';
import type { PmlNode } from '../../src/pml/primitives';
import type { PmlSite } from '../../src/renderer/PmlRenderer';

/** Designing a share card (shared program E4c-3): the pure edits and the canvas, against a fake card adapter. */

const site = {} as PmlSite;
const card: PmlNode[] = [
  {
    primitive: 'box',
    style: { background: 'accent', min_height: 'lg', justify: 'center' },
    children: [
      { primitive: 'heading', props: { text: 'Study permit checklist', level: 1 } },
      { primitive: 'credentials', props: { heading: '' } },
    ],
  },
];

function fakeCard(doc: CardDoc) {
  const saves: CardDocChange[] = [];
  let current: CardDoc = doc;
  const port: CardPort = {
    load: vi.fn(async () => current),
    save: vi.fn(async (_id: string, change: CardDocChange) => {
      saves.push(change);
      current = change.source === 'designed' ? { ...current, source: 'designed', nodes: change.nodes } : { ...current, source: change.source, nodes: card };
    }),
    previewUrl: vi.fn(async () => 'https://example.com/share-card/1?sig=x'),
  };

  return { port, saves };
}

const media = { upload: vi.fn(async () => ({ id: 'm1', url: 'https://example.com/media/m1.jpg' })) };

function canvas(doc: CardDoc, confirmAnswer = true) {
  const fake = fakeCard(doc);
  const onBack = vi.fn();
  const confirm = vi.fn(async () => confirmAnswer);
  const onError = vi.fn();
  render(<CardCanvas documentId="page-1" card={fake.port} media={media} site={site} onBack={onBack} confirm={confirm} onError={onError} console={<div>console here</div>} />);

  return { ...fake, onBack, confirm, onError };
}

describe('card edits', () => {
  it('changes words, picture, colour and alignment without touching the card on screen', () => {
    const words = setWords(card, [0, 0], 'Your permit, checked');
    expect(nodeAt(words, [0, 0])?.props?.text).toBe('Your permit, checked');
    expect(nodeAt(card, [0, 0])?.props?.text).toBe('Study permit checklist');

    expect(nodeAt(setPicture(card, [0], 'https://x/p.jpg'), [0])?.style).toMatchObject({ background: 'image', background_image_url: 'https://x/p.jpg' });
    expect(nodeAt(setTextColour(card, [0, 0], 'on-accent'), [0, 0])?.style?.text_color).toBe('on-accent');
    expect(nodeAt(setAlign(card, [0, 0], 'center'), [0, 0])?.style?.align).toBe('center');
  });

  it('never removes a pinned identity line, or a part holding one', () => {
    expect(removeAt(card, [0, 1])).toEqual({ nodes: card, refused: true });
    expect(removeAt(card, [0]).refused).toBe(true);
    expect(abilities(nodeAt(card, [0, 1])!).remove).toBe(false);

    const out = removeAt(card, [0, 0]);
    expect(out.refused).toBe(false);
    expect(nodeAt(out.nodes, [0])?.children).toHaveLength(1);
  });

  it('lists every part with a plain name', () => {
    expect(parts(card).map(({ node }) => partLabel(node))).toEqual(['Area', 'Heading: Study permit checklist', 'Identity line']);
  });
});

describe('CardCanvas', () => {
  it('draws the card with its guides, beside its parts and the console', async () => {
    canvas({ source: 'automatic', nodes: card });

    await screen.findByRole('button', { name: /Heading: Study permit checklist/ });
    expect(document.querySelector('[data-card-guides]')).not.toBeNull();
    expect(document.querySelector('[data-pml-path="0.0"]')).not.toBeNull();
    expect(screen.getByText('console here')).toBeTruthy();
  });

  it('a word edit saves a designed card, and back to the page returns', async () => {
    const { saves, onBack } = canvas({ source: 'automatic', nodes: card });

    fireEvent.click(await screen.findByRole('button', { name: /Heading: Study permit checklist/ }));
    fireEvent.change(screen.getByLabelText('Words'), { target: { value: 'Your permit, checked' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save card/ })); });

    expect(saves[0]).toMatchObject({ source: 'designed' });
    expect(nodeAt((saves[0] as { nodes: PmlNode[] }).nodes, [0, 0])?.props?.text).toBe('Your permit, checked');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Back to the page/ })); });
    expect(onBack).toHaveBeenCalled();
  });

  it('a pinned line says why it cannot be removed', async () => {
    canvas({ source: 'automatic', nodes: card });

    fireEvent.click(await screen.findByRole('button', { name: /Identity line/ }));
    expect(screen.getByText(/required on every card/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull();
  });

  it('back to the automatic card asks first, and a refused design is reopened with its reason', async () => {
    const design: PmlNode[] = [{ primitive: 'heading', props: { text: 'Guaranteed approval', level: 1 } }];
    const { saves, confirm } = canvas({ source: 'designed', nodes: card, design, fell_back: true, reason: 'Promising an outcome is not allowed.' });

    await screen.findByRole('button', { name: /Heading: Guaranteed approval/ });
    expect(screen.getByText(/Promising an outcome is not allowed/)).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Back to the automatic card/ })); });
    expect(confirm).toHaveBeenCalled();
    await waitFor(() => expect(saves[0]).toMatchObject({ source: 'automatic' }));
  });

  it('leaving with unsaved changes asks first, and staying keeps them', async () => {
    const { onBack } = canvas({ source: 'automatic', nodes: card }, false);

    fireEvent.click(await screen.findByRole('button', { name: /Heading: Study permit checklist/ }));
    fireEvent.change(screen.getByLabelText('Words'), { target: { value: 'Changed' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Back to the page/ })); });

    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
  });
});
