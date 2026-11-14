import React from 'react';
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, ImagePlus, Lock, RotateCcw, Save, Trash2 } from 'lucide-react';

import { CARD_WIDTH } from '../../card/cardFrame';
import { PmlCard } from '../../card/PmlCard';
import type { PmlNode } from '../../pml/primitives';
import type { PmlNativesPayload } from '../../pml/expressions';
import type { PmlHost, PmlSite } from '../../renderer/PmlRenderer';
import type { CardDoc, CardMediaPort, CardPort } from '../sharing/types';
import {
  abilities,
  CARD_ALIGNMENTS,
  CARD_BACKGROUNDS,
  CARD_TEXT_COLOURS,
  nodeAt,
  partLabel,
  parts,
  removeAt,
  setAlign,
  setBackground,
  setPicture,
  setTextColour,
  setWords,
  wordsProp,
  type CardAlignment,
  type CardBackground,
  type CardPath,
  type CardTextColour,
} from './cardEdits';

/**
 * Designing a share card (shared program E4c-3): the card at 1200x630 with the safe-area guides, its parts, and the
 * no-code edits (words, picture, colour, alignment), with **Back to the page**. The console the product mounts on the
 * card sits beside it (`console`), and a finished console Build reloads the card (`reloadKey`).
 *
 * The card is drawn by {@link PmlCard}, the same renderer the published picture comes from, so the canvas and the
 * picture never differ. What the card may hold and whether it reads well are the server's answer, shown after each
 * save; a pinned identity line can never be removed here. Every word is a prop (`labels`).
 */

export interface CardCanvasLabels {
  heading: string;
  back: string;
  save: string;
  saving: string;
  unsaved: string;
  automatic: string;
  confirmAutomaticTitle: string;
  confirmAutomaticText: string;
  confirmAutomaticAction: string;
  confirmLeaveTitle: string;
  confirmLeaveText: string;
  confirmLeaveAction: string;
  parts: string;
  pickPart: string;
  words: string;
  picture: string;
  textColour: string;
  background: string;
  align: string;
  remove: string;
  pinned: string;
  restored: string;
  /** `{reason}`: what the rules refused. */
  fellBack: string;
  findings: string;
  loading: string;
  /** Each colour token in plain words (the token stays the value). */
  colourNames: Record<CardTextColour, string>;
  backgroundNames: Record<CardBackground, string>;
  alignNames: Record<CardAlignment, string>;
}

export const DEFAULT_CARD_CANVAS_LABELS: CardCanvasLabels = {
  heading: 'Share card',
  back: 'Back to the page',
  save: 'Save card',
  saving: 'Saving…',
  unsaved: 'Unsaved changes',
  automatic: 'Back to the automatic card',
  confirmAutomaticTitle: 'Go back to the automatic card?',
  confirmAutomaticText: "Your design is deleted, and links show a card made from the page's title, description and first picture.",
  confirmAutomaticAction: 'Use the automatic card',
  confirmLeaveTitle: 'Leave without saving?',
  confirmLeaveText: 'Your changes to the card are not saved yet.',
  confirmLeaveAction: 'Leave',
  parts: 'Parts of the card',
  pickPart: 'Choose a part of the card, here or on the card, to change it.',
  words: 'Words',
  picture: 'Change picture',
  textColour: 'Text colour',
  background: 'Background',
  align: 'Alignment',
  remove: 'Remove',
  pinned: 'This line is required on every card and cannot be removed.',
  restored: 'The required identity line was missing, so it was put back.',
  fellBack: 'Links show the automatic card until this changes: {reason}',
  findings: 'To make it easier to read in a feed',
  loading: 'Loading the card…',
  colourNames: { default: 'Theme text', muted: 'Softer text', accent: 'Accent colour', 'on-accent': 'Light, on the accent colour', success: 'Green', danger: 'Red' },
  backgroundNames: { none: 'None', surface: 'Soft panel', accent: 'Accent colour', gradient: 'Gradient', image: 'Picture' },
  alignNames: { left: 'Align left', center: 'Centre', right: 'Align right' },
};

export interface CardCanvasProps {
  documentId: string;
  card: CardPort;
  media: CardMediaPort;
  site: PmlSite;
  host?: PmlHost;
  natives?: PmlNativesPayload | null;
  cardClassName?: string;
  cardStyle?: React.CSSProperties;
  onBack: () => void;
  /** The product's own confirm dialog (never `window.confirm`); resolves true to go ahead. */
  confirm: (ask: { title: string; description: string; action: string }) => Promise<boolean>;
  /** Where errors go (Portify: reportErrorToPorter). The canvas also shows the reason inline. */
  onError: (error: unknown) => void;
  /** The console the product mounts on the card. */
  console?: React.ReactNode;
  /** Change it to reload the card (a console Build finished). */
  reloadKey?: string | number;
  labels?: Partial<CardCanvasLabels>;
}

const pill =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--pml-builder-accent,#4361EE)] disabled:opacity-50';
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-[var(--pml-builder-accent,#4361EE)]';

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/**
 * The card path a click landed on. Inside a top-level part the renderer marks each element with its card path
 * (`i.j`, PmlCard `selectable`); a click on a top-level part itself (its background) is found by its place among the
 * frame's parts.
 */
function pathFromEvent(target: EventTarget | null): CardPath | null {
  if (!(target instanceof Element)) return null;
  const raw = target.closest('[data-pml-path]')?.getAttribute('data-pml-path');

  if (raw) {
    const path = raw.split('.').map(Number);

    return path.every(Number.isInteger) ? path : null;
  }

  const frame = target.closest('[data-pml-card]');
  let part: Element | null = target;
  while (part && part.parentElement !== frame) part = part.parentElement;
  if (!frame || !part) return null;
  const index = Array.from(frame.children).filter((child) => child.tagName !== 'STYLE' && !child.hasAttribute('data-card-guides')).indexOf(part);

  return index >= 0 ? [index] : null;
}

export function CardCanvas(props: CardCanvasProps): React.JSX.Element {
  const { documentId, card, media, onError, confirm } = props;
  const words = { ...DEFAULT_CARD_CANVAS_LABELS, ...props.labels };
  const [doc, setDoc] = React.useState<CardDoc | null | undefined>(undefined);
  const [working, setWorking] = React.useState<PmlNode[]>([]);
  const [dirty, setDirty] = React.useState(false);
  const [selected, setSelected] = React.useState<CardPath | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [problem, setProblem] = React.useState<string | null>(null);
  const [width, setWidth] = React.useState(CARD_WIDTH / 2);
  const stage = React.useRef<HTMLDivElement>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  const fail = React.useCallback((error: unknown) => {
    setProblem(error instanceof Error ? error.message : String(error));
    onError(error);
  }, [onError]);

  const show = React.useCallback((loaded: CardDoc | null) => {
    setDoc(loaded);
    setWorking(loaded ? (loaded.design ?? loaded.nodes) : []);
    setDirty(false);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    // Reads the adapter, an outside system: effect work. State is set only once it answers.
    card.load(documentId).then(
      (loaded) => { if (!cancelled) show(loaded); },
      (error: unknown) => { if (!cancelled) { setDoc(null); fail(error); } },
    );

    return () => {
      cancelled = true;
    };
  }, [card, documentId, fail, show, props.reloadKey]);

  React.useEffect(() => {
    // The card scales to the space it is given: a browser measurement, so effect work.
    const element = stage.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.min(CARD_WIDTH, Math.max(240, entry.contentRect.width))));
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const edit = (next: PmlNode[]) => {
    setWorking(next);
    setDirty(true);
  };

  const save = async () => {
    setBusy(true);
    setProblem(null);

    try {
      await card.save(documentId, { source: 'designed', nodes: working, alt: doc?.alt ?? null });
      show(await card.load(documentId));
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const backToAutomatic = async () => {
    if (!(await confirm({ title: words.confirmAutomaticTitle, description: words.confirmAutomaticText, action: words.confirmAutomaticAction }))) return;
    setBusy(true);
    setProblem(null);

    try {
      await card.save(documentId, { source: 'automatic', alt: doc?.alt ?? null });
      setSelected(null);
      show(await card.load(documentId));
    } catch (error) {
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (dirty && !(await confirm({ title: words.confirmLeaveTitle, description: words.confirmLeaveText, action: words.confirmLeaveAction }))) return;
    props.onBack();
  };

  const choosePicture = async (file: File | undefined) => {
    if (!file || selected === null) return;

    try {
      setProblem(null);
      const stored = await media.upload(file);
      edit(setPicture(working, selected, stored.url));
    } catch (error) {
      fail(error);
    }
  };

  const part = selected === null ? null : nodeAt(working, selected);
  const can = part ? abilities(part) : null;
  const prop = part ? wordsProp(part) : null;
  const scale = width / CARD_WIDTH;
  const marked = selected === null ? null : selected.join('.');

  return (
    <section aria-label={words.heading} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void leave()} className={`${pill} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
          <ArrowLeft className="h-4 w-4" /> {words.back}
        </button>
        <h2 className="mr-auto text-base font-semibold text-slate-900">{words.heading}</h2>
        {dirty ? <span className="text-xs text-slate-500">{words.unsaved}</span> : null}
        {doc && doc.source !== 'automatic' ? (
          <button type="button" disabled={busy} onClick={() => void backToAutomatic()} className={`${pill} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
            <RotateCcw className="h-4 w-4" /> {words.automatic}
          </button>
        ) : null}
        <button type="button" disabled={busy || !dirty} onClick={() => void save()} className={`${pill} bg-[var(--pml-builder-accent,#4361EE)] text-white`}>
          <Save className="h-4 w-4" /> {busy ? words.saving : words.save}
        </button>
      </div>

      {problem ? <p role="alert" className="text-sm text-red-600">{problem}</p> : null}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div ref={stage} className="w-full">
            {doc === undefined ? (
              <p className="text-sm text-slate-500">{words.loading}</p>
            ) : (
              <div
                // A click on the card selects the part under it (the renderer marks each part's path).
                onClick={(event) => { const path = pathFromEvent(event.target); if (path) setSelected(path); }}
                className="cursor-pointer overflow-hidden rounded-xl border border-slate-200 shadow-sm"
                style={{ width }}
              >
                {marked ? <style>{`[data-pml-card] [data-pml-path="${marked}"] > *{outline:3px solid #4361EE;outline-offset:2px}`}</style> : null}
                <PmlCard nodes={working} site={props.site} host={props.host} natives={props.natives} scale={scale} overlay selectable decorative className={props.cardClassName} style={props.cardStyle} />
              </div>
            )}
          </div>

          <CardNotes doc={doc} words={words} />
        </div>

        <aside className="flex w-full flex-col gap-4 lg:w-80">
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">{words.parts}</h3>
            <ul className="flex flex-col gap-1">
              {parts(working).map(({ path, node }) => (
                <li key={path.join('.')}>
                  <button
                    type="button"
                    aria-pressed={selected?.join('.') === path.join('.')}
                    onClick={() => setSelected(path)}
                    className="w-full rounded-lg px-3 py-1.5 text-left text-sm text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[var(--pml-builder-accent,#4361EE)] aria-pressed:bg-indigo-50 aria-pressed:text-indigo-700"
                    style={{ paddingLeft: 12 + (path.length - 1) * 12 }}
                  >
                    {isPinnedLabel(node) ? <Lock className="mr-1 inline h-3 w-3" aria-hidden="true" /> : null}
                    {partLabel(node)}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {part && can && selected ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white/70 p-3">
              <p className="text-sm font-medium text-slate-800">{partLabel(part)}</p>

              {can.words && prop ? (
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  {words.words}
                  <textarea
                    rows={2}
                    className={field}
                    value={String(part.props?.[prop] ?? '')}
                    onChange={(event) => edit(setWords(working, selected, event.target.value))}
                  />
                </label>
              ) : null}

              {can.picture ? (
                <>
                  <button type="button" onClick={() => fileInput.current?.click()} className={`${pill} bg-slate-100 text-slate-700 hover:bg-slate-200`}>
                    <ImagePlus className="h-4 w-4" /> {words.picture}
                  </button>
                  <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { void choosePicture(event.target.files?.[0]); event.target.value = ''; }} />
                </>
              ) : null}

              {can.textColour ? (
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  {words.textColour}
                  <select className={field} value={String(part.style?.text_color ?? 'default')} onChange={(event) => edit(setTextColour(working, selected, event.target.value as CardTextColour))}>
                    {CARD_TEXT_COLOURS.map((colour) => <option key={colour} value={colour}>{words.colourNames[colour]}</option>)}
                  </select>
                </label>
              ) : null}

              {can.background ? (
                <label className="flex flex-col gap-1 text-xs text-slate-600">
                  {words.background}
                  <select className={field} value={String(part.style?.background ?? 'none')} onChange={(event) => edit(setBackground(working, selected, event.target.value as CardBackground))}>
                    {CARD_BACKGROUNDS.map((background) => <option key={background} value={background}>{words.backgroundNames[background]}</option>)}
                  </select>
                </label>
              ) : null}

              {can.align ? (
                <div role="group" aria-label={words.align} className="flex gap-1">
                  {CARD_ALIGNMENTS.map((align) => {
                    const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;

                    return (
                      <button key={align} type="button" aria-label={words.alignNames[align]} title={words.alignNames[align]} aria-pressed={part.style?.align === align} onClick={() => edit(setAlign(working, selected, align as CardAlignment))} className="rounded-lg p-2 text-slate-600 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[var(--pml-builder-accent,#4361EE)] aria-pressed:bg-indigo-50 aria-pressed:text-indigo-700">
                        <Icon className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {can.pinned ? (
                <p className="flex items-start gap-1.5 text-xs text-slate-500"><Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /> {words.pinned}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => { const out = removeAt(working, selected); if (!out.refused) { edit(out.nodes); setSelected(null); } }}
                  className={`${pill} self-start text-red-600 hover:bg-red-50`}
                >
                  <Trash2 className="h-4 w-4" /> {words.remove}
                </button>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">{words.pickPart}</p>
          )}

          {props.console ?? null}
        </aside>
      </div>
    </section>
  );
}

function isPinnedLabel(node: PmlNode): boolean {
  return node.primitive === 'credentials';
}

/** What the server said about the card after its last save: a fallback's reason, a restored line, the checks. */
function CardNotes({ doc, words }: { doc: CardDoc | null | undefined; words: CardCanvasLabels }): React.JSX.Element | null {
  if (!doc) return null;
  const findings = doc.findings ?? [];

  return (
    <div className="mt-3 flex flex-col gap-2 text-sm">
      {doc.fell_back && doc.reason ? <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800">{fill(words.fellBack, { reason: doc.reason })}</p> : null}
      {doc.restored_identity ? <p role="status" className="rounded-xl bg-slate-50 px-3 py-2 text-slate-700">{words.restored}</p> : null}
      {findings.length > 0 ? (
        <div>
          <p className="font-medium text-slate-800">{words.findings}</p>
          <ul className="list-disc pl-5 text-slate-600">
            {findings.map((finding) => <li key={`${finding.code}-${finding.at}`}>{finding.text}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
