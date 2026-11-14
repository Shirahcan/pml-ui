import React from 'react';
import { ExternalLink, ImagePlus, Palette, RotateCcw, Share2 } from 'lucide-react';

import { CARD_WIDTH } from '../../card/cardFrame';
import { PmlCard } from '../../card/PmlCard';
import type { PmlNativesPayload } from '../../pml/expressions';
import type { PmlHost, PmlSite } from '../../renderer/PmlRenderer';
import { cropRect, encodeCrop, isSmallerThanCard, loadPicture, type LoadedPicture } from './ownPicture';
import type { CardDoc, CardDocChange, CardMediaPort, CardPort, CardRef, UnfurlFacts } from './types';
import { UnfurlPreviews, type UnfurlPreviewLabels } from './UnfurlPreviews';

/**
 * The Sharing panel (shared program E4b): the card a link to this document unfurls into, its status, its alt text,
 * and the choice between the automatic card, the person's own picture and their own design. It sits in the
 * builder's slide-in options panel; the previews open as a full view.
 *
 * Every word is a prop (`labels`), so no product's words live in the package.
 */

export interface SharingLabels {
  heading: string;
  intro: string;
  loading: string;
  noCard: string;
  statusRendered: string;
  statusPending: string;
  /** `{reason}` is replaced with the reason the card could not be drawn. */
  statusFailed: string;
  /** `{reason}` is replaced with what the rules refused. */
  statusRefused: string;
  statusNone: string;
  sourceAutomatic: string;
  sourcePicture: string;
  sourceDesigned: string;
  altLabel: string;
  seePreviews: string;
  design: string;
  ownPicture: string;
  automatic: string;
  cropHint: string;
  cropUse: string;
  cropCancel: string;
  /** `{width}` and `{height}` are replaced with the picture's size. */
  smallWarning: string;
  saving: string;
  cacheNote: string;
  linkedinInspector: string;
  facebookDebugger: string;
}

export const DEFAULT_SHARING_LABELS: SharingLabels = {
  heading: 'Sharing',
  intro: 'The picture and words a link to this page shows on LinkedIn, WhatsApp and other apps.',
  loading: 'Loading the card…',
  noCard: 'This page has no card yet.',
  statusRendered: 'Ready. Links to this page show this card.',
  statusPending: 'Waiting to draw the new card. Links still show the last one.',
  statusFailed: 'Not drawn: {reason}',
  statusRefused: 'Not drawn, because of its words: {reason} Links show your standard card until the words change.',
  statusNone: 'Drawn when you publish.',
  sourceAutomatic: "Made from the page's title, description and first picture.",
  sourcePicture: 'Your own picture.',
  sourceDesigned: 'Your own design.',
  altLabel: 'Describe the picture (read aloud by screen readers)',
  seePreviews: 'See how it looks when shared',
  design: 'Design the card',
  ownPicture: 'Use my own picture',
  automatic: 'Back to the automatic card',
  cropHint: 'Drag to choose the part to keep. Links show it at 1200 x 630.',
  cropUse: 'Use this picture',
  cropCancel: 'Cancel',
  smallWarning: 'This picture is {width} x {height}. Links draw 1200 x 630, so it may look soft.',
  saving: 'Saving…',
  cacheNote: 'LinkedIn and WhatsApp keep an old preview for a few days.',
  linkedinInspector: 'Refresh on LinkedIn',
  facebookDebugger: 'Refresh on Facebook',
};

const fill = (text: string, values: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));

const pill =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--pml-builder-accent,#4361EE)] disabled:opacity-50';

/** The change that keeps the card as it is, with a new alt text. */
function changeFor(doc: CardDoc, alt: string | null): CardDocChange {
  if (doc.source === 'picture' && doc.picture) {
    return { source: 'picture', picture: doc.picture, alt };
  }

  return doc.source === 'designed' ? { source: 'designed', nodes: doc.nodes, alt } : { source: 'automatic', alt };
}

export interface SharingPanelProps {
  documentId: string;
  /** The adapter's `card` and `media` ports (E0). */
  card: CardPort;
  media: CardMediaPort;
  /** The published card picture, or null before the first publish. */
  published: CardRef | null;
  /** The live draft's words and address. */
  facts: UnfurlFacts;
  /** What the card is drawn with, as for the document's pages. */
  site: PmlSite;
  host?: PmlHost;
  natives?: PmlNativesPayload | null;
  cardClassName?: string;
  cardStyle?: React.CSSProperties;
  /** The product's byte budget for a card picture (its CardPolicy). */
  maxBytes?: number;
  /** Whether the product lets this person use their own picture (its CardPolicy). */
  allowOwnPicture?: boolean;
  /** Opens the card canvas (E4c); the action is hidden without it. */
  onDesign?: () => void;
  /** Turns a stored failure code into the product's words. */
  describeError?: (error: string) => string;
  /** Where errors go (Portify: reportErrorToPorter). The panel also shows the reason inline. */
  onError: (error: unknown) => void;
  thumbnailWidth?: number;
  labels?: Partial<SharingLabels>;
  previewLabels?: Partial<UnfurlPreviewLabels>;
}

export function SharingPanel(props: SharingPanelProps): React.JSX.Element {
  const { documentId, card, media, published, facts, onError } = props;
  const words = { ...DEFAULT_SHARING_LABELS, ...props.labels };
  const maxBytes = props.maxBytes ?? 300_000;
  const [doc, setDoc] = React.useState<CardDoc | null | undefined>(undefined);
  const [altDraft, setAltDraft] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [previewsOpen, setPreviewsOpen] = React.useState(false);
  const [picking, setPicking] = React.useState<{ picture: LoadedPicture; x: number; y: number } | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const fail = React.useCallback((error: unknown) => {
    setProblem(error instanceof Error ? error.message : String(error));
    onError(error);
  }, [onError]);

  React.useEffect(() => {
    let cancelled = false;

    // Reads the adapter, an outside system: effect work. State is set only once it answers.
    card.load(documentId).then(
      (loaded) => { if (!cancelled) setDoc(loaded); },
      (error: unknown) => { if (!cancelled) { setDoc(null); fail(error); } },
    );

    return () => {
      cancelled = true;
    };
  }, [card, documentId, fail]);

  const save = async (change: CardDocChange) => {
    setBusy(true);
    setProblem(null);

    try {
      await card.save(documentId, change);
      setDoc(await card.load(documentId));
      setAltDraft(null);
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const choosePicture = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      setProblem(null);
      setPicking({ picture: await loadPicture(file), x: 0.5, y: 0.5 });
    } catch (error) {
      fail(error);
    }
  };

  const closePicking = () => {
    if (picking) {
      URL.revokeObjectURL(picking.picture.src);
    }
    setPicking(null);
  };

  const usePicture = async () => {
    if (!picking || !doc) {
      return;
    }

    setBusy(true);
    setProblem(null);

    try {
      const crop = cropRect(picking.picture.width, picking.picture.height, picking.x, picking.y);
      const encoded = await encodeCrop(picking.picture, crop, maxBytes);
      const stored = await media.upload(encoded.file);
      await card.save(documentId, {
        source: 'picture',
        picture: { mediaId: stored.id, url: stored.url, width: encoded.width, height: encoded.height },
        alt: altDraft ?? doc.alt ?? null,
      });
      setDoc(await card.load(documentId));
      closePicking();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const drawCard = (width: number) => (doc ? (
    <PmlCard
      nodes={doc.nodes}
      site={props.site}
      host={props.host}
      natives={props.natives}
      scale={width / CARD_WIDTH}
      decorative
      className={props.cardClassName}
      style={props.cardStyle}
    />
  ) : null);

  const status = published === null
    ? words.statusNone
    : published.status === 'rendered'
      ? words.statusRendered
      : published.status === 'pending'
        ? words.statusPending
        : fill(published.status === 'refused' ? words.statusRefused : words.statusFailed, {
          reason: props.describeError?.(published.error ?? '') ?? published.error ?? '',
        });

  const source = doc ? { automatic: words.sourceAutomatic, picture: words.sourcePicture, designed: words.sourceDesigned }[doc.source] : '';
  const alt = altDraft ?? doc?.alt ?? published?.alt ?? facts.title;
  const encodedUrl = encodeURIComponent(facts.url);

  return (
    <section data-sharing-panel="" className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">{words.heading}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{words.intro}</p>
      </div>

      {doc === undefined ? <p className="text-sm text-slate-500">{words.loading}</p> : null}
      {doc === null ? <p className="text-sm text-slate-500">{words.noCard}</p> : null}

      {doc && !picking ? (
        <div className="space-y-2">
          <div className="overflow-hidden rounded-xl border border-slate-200">{drawCard(props.thumbnailWidth ?? 320)}</div>
          <p className="text-xs text-slate-500">{source}</p>
          <p data-card-status={published?.status ?? 'none'} className={published?.status === 'failed' || published?.status === 'refused' ? 'text-sm text-red-600' : 'text-sm text-slate-700'}>
            {status}
          </p>
        </div>
      ) : null}

      {picking ? (
        <CropChooser picking={picking} onMove={(x, y) => setPicking({ ...picking, x, y })} hint={words.cropHint} />
      ) : null}
      {picking && isSmallerThanCard(picking.picture.width, picking.picture.height) ? (
        <p data-small-warning="" className="text-sm text-amber-700">
          {fill(words.smallWarning, { width: picking.picture.width, height: picking.picture.height })}
        </p>
      ) : null}

      {problem ? <p role="alert" className="text-sm text-red-600">{problem}</p> : null}
      {busy ? <p className="text-sm text-slate-500">{words.saving}</p> : null}

      {picking ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => void usePicture()} className={`${pill} bg-[var(--pml-builder-accent,#4361EE)] text-white`}>
            {words.cropUse}
          </button>
          <button type="button" disabled={busy} onClick={closePicking} className={`${pill} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
            {words.cropCancel}
          </button>
        </div>
      ) : null}

      {doc && !picking ? (
        <>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-slate-600">{words.altLabel}</span>
            <input
              type="text"
              value={alt}
              disabled={busy}
              onChange={(event) => setAltDraft(event.target.value)}
              onBlur={() => { if (altDraft !== null && altDraft !== (doc.alt ?? '')) void save(changeFor(doc, altDraft)); }}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-[var(--pml-builder-accent,#4361EE)]"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPreviewsOpen(true)} className={`${pill} bg-[var(--pml-builder-accent,#4361EE)] text-white`}>
              <Share2 className="h-4 w-4" /> {words.seePreviews}
            </button>
            {props.onDesign ? (
              <button type="button" disabled={busy} onClick={props.onDesign} className={`${pill} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                <Palette className="h-4 w-4" /> {words.design}
              </button>
            ) : null}
            {props.allowOwnPicture !== false ? (
              <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className={`${pill} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                <ImagePlus className="h-4 w-4" /> {words.ownPicture}
              </button>
            ) : null}
            {doc.source !== 'automatic' ? (
              <button type="button" disabled={busy} onClick={() => void save({ source: 'automatic', alt: doc.alt ?? null })} className={`${pill} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                <RotateCcw className="h-4 w-4" /> {words.automatic}
              </button>
            ) : null}
          </div>

          <p className="text-xs text-slate-500">
            {words.cacheNote}{' '}
            <a href={`https://www.linkedin.com/post-inspector/inspect/${encodedUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[var(--pml-builder-accent,#4361EE)] underline">
              {words.linkedinInspector} <ExternalLink className="h-3 w-3" />
            </a>{' '}
            <a href={`https://developers.facebook.com/tools/debug/?q=${encodedUrl}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[var(--pml-builder-accent,#4361EE)] underline">
              {words.facebookDebugger} <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </>
      ) : null}

      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        data-own-picture-input=""
        onChange={(event) => { void choosePicture(event.target.files?.[0]); event.target.value = ''; }}
      />

      <UnfurlPreviews open={previewsOpen} onClose={() => setPreviewsOpen(false)} facts={facts} card={drawCard} labels={props.previewLabels} />
    </section>
  );
}

/** The person's picture with the 1.91:1 part that will be kept; pointer or arrow keys move it. */
function CropChooser({ picking, onMove, hint }: {
  picking: { picture: LoadedPicture; x: number; y: number };
  onMove: (x: number, y: number) => void;
  hint: string;
}): React.JSX.Element {
  const { picture, x, y } = picking;
  const crop = cropRect(picture.width, picture.height, x, y);
  const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
  const dragging = React.useRef(false);

  const moveTo = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onMove(clamp((event.clientX - box.left) / box.width), clamp((event.clientY - box.top) / box.height));
  };

  const onKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[event.key];

    if (step) {
      event.preventDefault();
      onMove(clamp(x + step[0]), clamp(y + step[1]));
    }
  };

  return (
    <div className="space-y-1">
      <div
        role="application"
        aria-label={hint}
        tabIndex={0}
        data-crop-chooser=""
        className="relative cursor-move touch-none select-none overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--pml-builder-accent,#4361EE)]"
        onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture?.(event.pointerId); moveTo(event); }}
        onPointerMove={(event) => { if (dragging.current) moveTo(event); }}
        onPointerUp={() => { dragging.current = false; }}
        onKeyDown={onKey}
      >
        {/* A local object URL: a plain img on purpose, nothing for an image optimiser to fetch. */}
        <img src={picture.src} alt="" draggable={false} className="block w-full" />
        <div
          data-crop-window=""
          className="pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]"
          style={{
            left: `${(crop.sx / picture.width) * 100}%`,
            top: `${(crop.sy / picture.height) * 100}%`,
            width: `${(crop.sw / picture.width) * 100}%`,
            height: `${(crop.sh / picture.height) * 100}%`,
          }}
        />
      </div>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}
