import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SharingPanel } from '../../src/builder/sharing/SharingPanel';
import { CARD_RATIO, cropRect, isSmallerThanCard, outputSize } from '../../src/builder/sharing/ownPicture';
import { cutText, UNFURL_NETWORKS } from '../../src/builder/sharing/UnfurlPreviews';
import type { CardDoc, CardDocChange, CardPort, CardRef } from '../../src/builder/sharing/types';
import type { PmlSite } from '../../src/renderer/PmlRenderer';

/** The Sharing panel and unfurl previews (shared program E4b), against a fake card and media adapter. */

const site = {} as PmlSite;
const facts = { title: 'Spring LMIA webinar', description: 'One hour on the new wage rules.', url: 'https://example.com/go/spring', domain: 'example.com' };
const automatic: CardDoc = { source: 'automatic', nodes: [{ primitive: 'heading', props: { text: 'Spring LMIA webinar', level: 1 } }], alt: null };

function fakeCard(doc: CardDoc | null = automatic) {
  const saves: CardDocChange[] = [];
  let current = doc;
  const port: CardPort = {
    load: vi.fn(async () => current),
    save: vi.fn(async (_id: string, change: CardDocChange) => {
      saves.push(change);
      current = { source: change.source, nodes: current?.nodes ?? [], alt: change.alt ?? null, picture: change.source === 'picture' ? change.picture : null };
    }),
    previewUrl: vi.fn(async () => 'https://example.com/share-card/1?sig=x'),
  };

  return { port, saves };
}

const media = { upload: vi.fn(async () => ({ id: 'm1', url: 'https://example.com/media/m1.jpg' })) };

function panel(published: CardRef | null, card = fakeCard(), extra: Partial<React.ComponentProps<typeof SharingPanel>> = {}) {
  const onError = vi.fn();
  const view = render(
    <SharingPanel documentId="page-1" card={card.port} media={media} published={published} facts={facts} site={site} onError={onError} {...extra} />,
  );

  return { ...view, onError, card };
}

const ref = (status: CardRef['status'], error: string | null = null): CardRef => ({
  url: 'https://example.com/media/cards/page-1-abc.png', width: 1200, height: 630, type: 'image/png', alt: 'Spring', hash: 'abc', status, error,
});

describe('unfurl cut table', () => {
  it('cuts a long title at a word, with an ellipsis, to each network\'s length', () => {
    const long = 'Bring your whole family to Canada: the spousal, dependent child and parent routes explained in one evening';
    const linkedin = UNFURL_NETWORKS.find((n) => n.id === 'linkedin')!;
    const cut = cutText(long, linkedin.titleMax);

    expect(cut.length).toBeLessThanOrEqual(linkedin.titleMax);
    expect(cut.endsWith('…')).toBe(true);
    expect(long.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cutText(long, 0)).toBe('');
    expect(cutText('Short title', 70)).toBe('Short title');
  });

  it('lists the six networks once each', () => {
    expect(UNFURL_NETWORKS.map((n) => n.id)).toEqual(['linkedin', 'whatsapp', 'x', 'facebook', 'slack', 'imessage']);
  });
});

describe('own picture crop', () => {
  it('keeps 1.91:1 for wide and tall pictures, near the chosen point, inside the picture', () => {
    for (const [w, h, fx, fy] of [[4000, 1000, 0.9, 0.5], [1000, 3000, 0.5, 0.1], [1200, 630, 0.5, 0.5], [800, 800, 0, 1]]) {
      const crop = cropRect(w, h, fx, fy);

      expect(Math.abs(crop.sw / crop.sh - CARD_RATIO)).toBeLessThan(0.01);
      expect(crop.sx).toBeGreaterThanOrEqual(0);
      expect(crop.sy).toBeGreaterThanOrEqual(0);
      expect(crop.sx + crop.sw).toBeLessThanOrEqual(w);
      expect(crop.sy + crop.sh).toBeLessThanOrEqual(h);
    }

    // A wide picture with the point at the right keeps its right edge.
    expect(cropRect(4000, 1000, 0.9, 0.5).sx + cropRect(4000, 1000, 0.9, 0.5).sw).toBe(4000);
  });

  it('writes at 1200x630, or the crop\'s own size when the picture is smaller, and says when it is', () => {
    expect(outputSize(cropRect(3000, 2000, 0.5, 0.5))).toEqual({ width: 1200, height: 630 });
    expect(outputSize(cropRect(800, 600, 0.5, 0.5))).toEqual({ width: 800, height: 420 });
    expect(isSmallerThanCard(800, 600)).toBe(true);
    expect(isSmallerThanCard(1200, 630)).toBe(false);
  });
});

describe('SharingPanel', () => {
  it('shows each status, with the stored reason in the product\'s words', async () => {
    const statuses: [CardRef | null, string][] = [
      [null, 'Drawn when you publish.'],
      [ref('rendered'), 'Ready. Links to this page show this card.'],
      [ref('pending'), 'Waiting to draw the new card. Links still show the last one.'],
      [ref('failed', 'host_not_registered'), 'Not drawn: the address is not registered'],
      [ref('refused', 'No promises of an outcome.'), 'Not drawn, because of its words: No promises of an outcome. Links show your standard card until the words change.'],
    ];

    for (const [published, words] of statuses) {
      const view = panel(published, fakeCard(), { describeError: (code) => (code === 'host_not_registered' ? 'the address is not registered' : code) });
      expect(await screen.findByText(words)).toBeTruthy();
      view.unmount();
    }
  });

  it('opens the full view from the call to action and closes it with Esc, focus back on the opener', async () => {
    panel(ref('rendered'));
    const open = await screen.findByRole('button', { name: /See how it looks when shared/ });
    open.focus();
    fireEvent.click(open);

    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelectorAll('[data-network]')).toHaveLength(6);
    expect(dialog.textContent).toContain('Spring LMIA webinar');
    await waitFor(() => expect(dialog.querySelectorAll('[data-card-ready="true"]')).toHaveLength(6));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(open);
  });

  it('warns when an own picture is smaller than the card, and cancels cleanly', async () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:card', revokeObjectURL: revoke }));
    class SmallImage {
      naturalWidth = 640;
      naturalHeight = 480;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal('Image', SmallImage);

    const { container } = panel(ref('rendered'));
    await screen.findByText('Ready. Links to this page show this card.');
    const input = container.querySelector('[data-own-picture-input]') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(['x'], 'small.jpg', { type: 'image/jpeg' })] } });
    });

    expect((await screen.findByText(/This picture is 640 x 480/)).textContent).toContain('may look soft');
    expect(container.querySelector('[data-crop-chooser]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(container.querySelector('[data-crop-chooser]')).toBeNull();
    expect(revoke).toHaveBeenCalledWith('blob:card');
    // The thumbnail is back and marks itself ready once its fonts and pictures load.
    await waitFor(() => expect(container.querySelector('[data-card-ready="true"]')).not.toBeNull());
    vi.unstubAllGlobals();
  });

  it('goes back to the automatic card and saves alt text on blur', async () => {
    const card = fakeCard({ ...automatic, source: 'picture', picture: { mediaId: 'm1', url: 'https://example.com/m1.jpg', width: 1200, height: 630 } });
    panel(ref('rendered'), card);

    fireEvent.click(await screen.findByRole('button', { name: /Back to the automatic card/ }));
    await waitFor(() => expect(card.saves[0]).toEqual({ source: 'automatic', alt: null }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Back to the automatic card/ })).toBeNull());

    const alt = screen.getByLabelText(/Describe the picture/) as HTMLInputElement;
    fireEvent.change(alt, { target: { value: 'Two people at a laptop' } });
    fireEvent.blur(alt);
    await waitFor(() => expect(card.saves[1]).toEqual({ source: 'automatic', alt: 'Two people at a laptop' }));
  });

  it('hands a failed load to the product with the real reason and shows it', async () => {
    const card = fakeCard();
    (card.port.load as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('The page was deleted.'));
    const { onError } = panel(null, card);

    expect((await screen.findByRole('alert')).textContent).toBe('The page was deleted.');
    expect(onError).toHaveBeenCalled();
    expect(screen.getByText('This page has no card yet.')).toBeTruthy();
  });

  it('hides Design the card until the product wires the canvas', async () => {
    const view = panel(ref('rendered'));
    await screen.findByText('Ready. Links to this page show this card.');
    expect(screen.queryByRole('button', { name: /Design the card/ })).toBeNull();
    view.unmount();

    const onDesign = vi.fn();
    panel(ref('rendered'), fakeCard(), { onDesign });
    fireEvent.click(await screen.findByRole('button', { name: /Design the card/ }));
    expect(onDesign).toHaveBeenCalled();
  });
});
