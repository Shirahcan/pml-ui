import React from 'react';
import { X } from 'lucide-react';

import type { UnfurlFacts } from './types';

/**
 * How a shared link unfurls on each network (shared program E4b), drawn from the live draft with no render. A call
 * to action opens it as a full view (owner rule: a preview toggles a full view, never a side panel).
 */

export type UnfurlNetworkId = 'linkedin' | 'whatsapp' | 'x' | 'facebook' | 'slack' | 'imessage';

export interface UnfurlNetwork {
  id: UnfurlNetworkId;
  name: string;
  /** Characters of the title shown before the network cuts it; 0 = the network does not show it. */
  titleMax: number;
  /** Characters of the description shown; 0 = not shown. */
  descriptionMax: number;
  /** Where the network prints the domain. */
  domain: 'below-title' | 'above-title' | 'over-picture' | 'below-description';
  /** The width the preview draws the picture at, in px. */
  pictureWidth: number;
}

/**
 * THE table of how each network draws a link, in one place. The cut lengths are approximations: no network
 * publishes them, guides disagree (LinkedIn is quoted anywhere from 70 to 200), and each changes its layout from
 * time to time. These are the conservative figures, re-checked 2026-11-13. A title that fits all of them fits
 * everywhere, which is the point of showing them side by side.
 */
export const UNFURL_NETWORKS: readonly UnfurlNetwork[] = [
  { id: 'linkedin', name: 'LinkedIn', titleMax: 70, descriptionMax: 0, domain: 'below-title', pictureWidth: 440 },
  { id: 'whatsapp', name: 'WhatsApp', titleMax: 65, descriptionMax: 80, domain: 'below-description', pictureWidth: 330 },
  { id: 'x', name: 'X', titleMax: 0, descriptionMax: 0, domain: 'over-picture', pictureWidth: 440 },
  { id: 'facebook', name: 'Facebook', titleMax: 88, descriptionMax: 110, domain: 'above-title', pictureWidth: 440 },
  { id: 'slack', name: 'Slack', titleMax: 150, descriptionMax: 150, domain: 'above-title', pictureWidth: 360 },
  { id: 'imessage', name: 'iMessage', titleMax: 50, descriptionMax: 0, domain: 'below-title', pictureWidth: 300 },
];

/** Cuts text the way a network does: at a word, with an ellipsis. 0 shows nothing. */
export function cutText(text: string, max: number): string {
  const value = text.trim().replace(/\s+/g, ' ');

  if (max <= 0) {
    return '';
  }

  if (value.length <= max) {
    return value;
  }

  const head = value.slice(0, max - 1);
  const space = head.lastIndexOf(' ');

  return `${(space > max / 2 ? head.slice(0, space) : head).trimEnd()}…`;
}

export interface UnfurlPreviewLabels {
  heading: string;
  note: string;
  close: string;
}

export const DEFAULT_UNFURL_LABELS: UnfurlPreviewLabels = {
  heading: 'How your link looks when shared',
  note: 'Drawn from your draft. Networks change their layouts from time to time, so treat these as close, not exact.',
  close: 'Close',
};

/** One network's preview: its picture crop, where it prints the domain, how it cuts the words. */
export function UnfurlPreview({
  network,
  facts,
  card,
}: {
  network: UnfurlNetwork;
  facts: UnfurlFacts;
  /** Draws the card at a given width (the builder passes PmlCard, scaled). */
  card: (width: number) => React.ReactNode;
}): React.JSX.Element {
  const title = cutText(facts.title, network.titleMax);
  const description = cutText(facts.description, network.descriptionMax);
  const picture = <div className="overflow-hidden">{card(network.pictureWidth)}</div>;

  switch (network.id) {
    case 'linkedin':
      return (
        <div className="overflow-hidden rounded-lg border border-[#e0dfdc] bg-white" style={{ width: network.pictureWidth }}>
          {picture}
          <div className="px-3 py-2">
            <p className="line-clamp-2 text-sm font-semibold text-[#191919]">{title}</p>
            <p className="mt-0.5 text-xs text-[#666666]">{facts.domain}</p>
          </div>
        </div>
      );
    case 'whatsapp':
      return (
        <div className="rounded-lg bg-[#d9fdd3] p-1" style={{ width: network.pictureWidth + 8 }}>
          <div className="overflow-hidden rounded-md bg-[#c9eec2]">
            {picture}
            <div className="px-2 py-1.5">
              <p className="line-clamp-2 text-sm font-semibold text-[#111b21]">{title}</p>
              {description ? <p className="line-clamp-2 text-xs text-[#54656f]">{description}</p> : null}
              <p className="text-xs text-[#667781]">{facts.domain}</p>
            </div>
          </div>
          <p className="truncate px-1.5 pt-1 text-sm text-[#027eb5]">{facts.url}</p>
        </div>
      );
    case 'x':
      return (
        <div style={{ width: network.pictureWidth }}>
          <div className="relative overflow-hidden rounded-2xl border border-[#cfd9de]">
            {picture}
            <span className="absolute bottom-3 left-3 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white">{facts.domain}</span>
          </div>
          <p className="mt-1 text-xs text-[#536471]">From {facts.domain}</p>
        </div>
      );
    case 'facebook':
      return (
        <div className="overflow-hidden border border-[#dadde1]" style={{ width: network.pictureWidth }}>
          {picture}
          <div className="bg-[#f0f2f5] px-3 py-2">
            <p className="text-xs uppercase text-[#65676b]">{facts.domain}</p>
            <p className="line-clamp-2 text-base font-semibold text-[#050505]">{title}</p>
            {description ? <p className="line-clamp-1 text-sm text-[#65676b]">{description}</p> : null}
          </div>
        </div>
      );
    case 'slack':
      return (
        <div className="border-l-4 border-[#dddddd] pl-3" style={{ width: network.pictureWidth + 16 }}>
          <p className="text-sm font-bold text-[#1d1c1d]">{facts.siteName || facts.domain}</p>
          <p className="text-[15px] font-bold text-[#1264a3]">{title}</p>
          {description ? <p className="text-[15px] text-[#1d1c1d]">{description}</p> : null}
          <div className="mt-2 overflow-hidden rounded-lg">{card(network.pictureWidth)}</div>
        </div>
      );
    case 'imessage':
      return (
        <div className="overflow-hidden rounded-2xl" style={{ width: network.pictureWidth }}>
          {picture}
          <div className="bg-[#e9e9eb] px-3 py-2">
            <p className="line-clamp-2 text-sm font-semibold text-black">{title}</p>
            <p className="text-xs text-[#8e8e93]">{facts.domain}</p>
          </div>
        </div>
      );
  }
}

/**
 * The full view: every network side by side. Bounded to the viewport, with its own scrolling body, so it works on
 * a short screen; Esc or the close button returns focus to whatever opened it.
 */
export function UnfurlPreviews({
  open,
  onClose,
  facts,
  card,
  labels,
}: {
  open: boolean;
  onClose: () => void;
  facts: UnfurlFacts;
  card: (width: number) => React.ReactNode;
  labels?: Partial<UnfurlPreviewLabels>;
}): React.JSX.Element | null {
  const words = { ...DEFAULT_UNFURL_LABELS, ...labels };
  const closeButton = React.useRef<HTMLButtonElement>(null);
  const latestClose = React.useRef(onClose);
  const headingId = React.useId();

  React.useEffect(() => {
    latestClose.current = onClose;
  }, [onClose]);

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }

    // Focus and the Esc key belong to the document, outside React: effect work. Keyed on `open` only, so a host
    // that passes a new onClose each render does not move focus around.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        latestClose.current();
      }
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        data-unfurl-previews=""
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white bg-white/95 shadow-xl backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id={headingId} className="text-lg font-semibold text-slate-900">{words.heading}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{words.note}</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label={words.close}
            className="shrink-0 whitespace-nowrap rounded-full p-2 text-slate-500 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[var(--pml-builder-accent,#4361EE)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {UNFURL_NETWORKS.map((network) => (
              <figure key={network.id} data-network={network.id} className="min-w-0 space-y-2 overflow-x-auto">
                <figcaption className="text-sm font-medium text-slate-700">{network.name}</figcaption>
                <UnfurlPreview network={network} facts={facts} card={card} />
              </figure>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
