'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ImagePlus } from 'lucide-react';

import { CARD_WIDTH } from '../../../card/cardFrame';
import { PmlCard } from '../../../card/PmlCard';
import { isCommentNode, renderedPathFor, sourcePathFor, type PmlNode } from '../../../language';
import type { PmlNativesPayload } from '../../../pml/expressions';
import type { PmlHost, PmlSite } from '../../../renderer/PmlRenderer';
import { pathElement } from '../../editor/pathElement';
import { DEFAULT_CARD_CANVAS_LABELS } from '../../card/CardCanvas';
import {
  abilities,
  CARD_ALIGNMENTS,
  CARD_BACKGROUNDS,
  CARD_TEXT_COLOURS,
  nodeAt,
  setAlign,
  setBackground,
  setPicture,
  setTextColour,
  setWords,
  wordsProp,
  type CardAlignment,
  type CardBackground,
  type CardTextColour,
} from '../../card/cardEdits';

/**
 * The card profile's canvas (shared PML Studio P2c2, owner 2026-11-26: "the card gets its own fixed-frame canvas inside
 * the Studio"): the design drawn by {@link PmlCard}, the renderer the published picture comes from, at 1200x630 scaled
 * to the space it is given, with the safe-area guides. Every part carries the marks a page's canvas carries
 * (`data-pml-section` on a top-level part, `data-pml-path` inside one, both the part's path in the DESIGN), so the
 * Studio's selection bar, element menu and comment pins find a card's parts exactly as they find a page's.
 *
 * A comment never reaches the picture (the card drops it), so a part's place on the picture can differ from its place
 * in the design: the marks are always the design's.
 */

const SELECTED = 'data-pml-selected';
const MARK_STYLES = `[data-pml-card] [${SELECTED}] { outline: 3px solid var(--pml-select, #4361EE); outline-offset: 2px; }`;

export interface CardStudioCanvasProps {
  nodes: PmlNode[];
  site: PmlSite;
  host?: PmlHost;
  natives?: PmlNativesPayload | null;
  /** The product's theme for the card (classes and CSS variables), as its pages get them. */
  frame?: { className?: string; style?: React.CSSProperties };
  selectedPath: number[] | null;
  onSelectPath: (path: number[] | null) => void;
  /** A right-click on a part: the Studio selects it and opens its menu. */
  onElementContextMenu?: (path: number[]) => void;
  /** The Studio's bar for the selected part (its menu, add before / inside / after, comment). */
  renderSelectionBar?: (path: number[]) => React.ReactNode;
  /** Drawn over the card (the comment pins). */
  overlay?: React.ReactNode;
  /** The assistant is working: the card takes no presses. */
  locked?: boolean;
}

/** The design index of each top-level part the picture draws (comments are not drawn). */
export function drawnRoots(nodes: PmlNode[]): number[] {
  return nodes.flatMap((node, index) => (isCommentNode(node) ? [] : [index]));
}

/** The element a mark names: a top-level part is its section, an inner part the box its mark wraps. */
function markedElement(root: HTMLElement, nodes: PmlNode[], path: number[]): HTMLElement | null {
  if (path.length === 1) return root.querySelector<HTMLElement>(`[data-pml-section="${path[0]}"]`);

  return pathElement(root.querySelector(`[data-pml-path="${renderedPathFor(nodes, path).join('.')}"]`));
}

/** The design path of the part under an event's target, or null outside every part. */
export function cardPathAt(nodes: PmlNode[], target: EventTarget | null): number[] | null {
  if (!(target instanceof Element)) return null;
  const raw = target.closest('[data-pml-path]')?.getAttribute('data-pml-path');

  if (raw) {
    const rendered = raw.split('.').map(Number);

    return rendered.every(Number.isInteger) ? sourcePathFor(nodes, rendered) : null;
  }

  const section = target.closest('[data-pml-section]')?.getAttribute('data-pml-section');

  return section !== null && section !== undefined && Number.isInteger(Number(section)) ? [Number(section)] : null;
}

export function CardStudioCanvas({ nodes, site, host, natives = null, frame, selectedPath, onSelectPath, onElementContextMenu, renderSelectionBar, overlay, locked = false }: CardStudioCanvasProps): React.JSX.Element {
  const stage = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(CARD_WIDTH / 2);
  const roots = useMemo(() => drawnRoots(nodes), [nodes]);

  useEffect(() => {
    // The card scales to the space it is given: a browser measurement, so effect work.
    const element = stage.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.min(CARD_WIDTH, Math.max(240, entry.contentRect.width))));
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  // The DOM marks (after every render: a redraw replaces the parts). A mark is not state.
  useEffect(() => {
    const element = root.current;
    const card = element?.querySelector('[data-pml-card]');
    if (!element || !card) return;

    Array.from(card.children)
      .filter((child) => child.tagName !== 'STYLE' && !child.hasAttribute('data-card-guides'))
      .forEach((part, drawn) => part.setAttribute('data-pml-section', String(roots[drawn] ?? drawn)));

    element.querySelectorAll(`[${SELECTED}]`).forEach((marked) => marked.removeAttribute(SELECTED));
    if (selectedPath) markedElement(element, nodes, selectedPath)?.setAttribute(SELECTED, 'true');
  });

  // The selection bar sits on the selected part's top-left corner, above it when there is room.
  useLayoutEffect(() => {
    const element = root.current;
    const holder = bar.current;
    if (!element || !holder || !selectedPath) return;
    const target = markedElement(element, nodes, selectedPath);

    if (!target) {
      holder.style.visibility = 'hidden';

      return;
    }

    const box = target.getBoundingClientRect();
    const origin = element.getBoundingClientRect();
    const top = box.top - origin.top;
    holder.style.top = `${top >= holder.offsetHeight + 2 ? top - holder.offsetHeight : top}px`;
    holder.style.left = `${Math.max(box.left - origin.left, 0)}px`;
    holder.style.visibility = 'visible';
  });

  return (
    <div ref={stage} className="w-full min-w-0">
      <div
        ref={root}
        data-pml-card-canvas=""
        className={`relative isolate mx-auto ${locked ? 'pointer-events-none select-none' : 'cursor-pointer'}`}
        style={{ width }}
        // A click selects the part under it; a click outside every part clears the selection.
        onClick={(event) => onSelectPath(cardPathAt(nodes, event.target))}
        onContextMenu={(event) => {
          const path = cardPathAt(nodes, event.target);
          if (!path || !onElementContextMenu) return;
          event.preventDefault();
          onElementContextMenu(path);
        }}
      >
        <style>{MARK_STYLES}</style>
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          <PmlCard nodes={nodes} site={site} host={host} natives={natives} scale={width / CARD_WIDTH} overlay selectable pathRoots={roots} decorative className={frame?.className} style={frame?.style} />
        </div>
        {renderSelectionBar && selectedPath && !locked ? (
          <div ref={bar} className="absolute z-30" style={{ top: 0, left: 0, visibility: 'hidden' }} onClick={(event) => event.stopPropagation()}>
            {renderSelectionBar(selectedPath)}
          </div>
        ) : null}
        {overlay}
      </div>
    </div>
  );
}

const FIELD = 'w-full rounded-md border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3 py-2 text-sm text-[var(--pb-text)] outline-none';
const PILL = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--pb-border)] px-3 py-1.5 text-xs font-semibold outline-none hover:text-[var(--pb-accent)]';

/**
 * A card part's no-code edits (shared PML Studio P2c3), above its settings in the Studio's element panel: its words, a
 * picture, the text colour, the background and the alignment, each in the card's own tokens. Nothing on a card is locked
 * (owner 2026-11-18 and 2026-11-26): the panel's Delete removes any part, the identity line included.
 */
export function CardEditsPanel({ nodes, path, change, upload, onError }: {
  nodes: PmlNode[];
  path: number[];
  change: (next: PmlNode[]) => void;
  /** The host's media upload; without it there is no picture button. */
  upload?: (file: File) => Promise<{ url: string }>;
  onError: (error: unknown) => void;
}): React.JSX.Element | null {
  const words = DEFAULT_CARD_CANVAS_LABELS;
  const file = useRef<HTMLInputElement>(null);
  const part = nodeAt(nodes, path);
  if (!part) return null;
  const can = abilities(part);
  const prop = wordsProp(part);

  const choose = async (picked: File | undefined) => {
    if (!picked || !upload) return;
    try {
      const stored = await upload(picked);
      change(setPicture(nodes, path, stored.url));
    } catch (error) {
      onError(error);
    }
  };

  return (
    <div className="space-y-3">
      {can.words && prop ? (
        <label className="flex flex-col gap-1 text-xs text-[var(--pb-muted)]">
          {words.words}
          <textarea rows={2} className={FIELD} value={String(part.props?.[prop] ?? '')} onChange={(event) => change(setWords(nodes, path, event.target.value))} />
        </label>
      ) : null}

      {can.picture && upload ? (
        <>
          <button type="button" onClick={() => file.current?.click()} className={PILL}>
            <ImagePlus className="h-4 w-4" /> {words.picture}
          </button>
          <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label={words.picture} onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ''; }} />
        </>
      ) : null}

      {can.textColour ? (
        <label className="flex flex-col gap-1 text-xs text-[var(--pb-muted)]">
          {words.textColour}
          <select className={FIELD} value={String(part.style?.text_color ?? 'default')} onChange={(event) => change(setTextColour(nodes, path, event.target.value as CardTextColour))}>
            {CARD_TEXT_COLOURS.map((colour) => <option key={colour} value={colour}>{words.colourNames[colour]}</option>)}
          </select>
        </label>
      ) : null}

      {can.background ? (
        <label className="flex flex-col gap-1 text-xs text-[var(--pb-muted)]">
          {words.background}
          <select className={FIELD} value={String(part.style?.background ?? 'none')} onChange={(event) => change(setBackground(nodes, path, event.target.value as CardBackground))}>
            {CARD_BACKGROUNDS.map((background) => <option key={background} value={background}>{words.backgroundNames[background]}</option>)}
          </select>
        </label>
      ) : null}

      {can.align ? (
        <div role="group" aria-label={words.align} className="flex gap-1">
          {CARD_ALIGNMENTS.map((align) => {
            const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight;

            return (
              <button key={align} type="button" aria-label={words.alignNames[align]} title={words.alignNames[align]} aria-pressed={part.style?.align === align} onClick={() => change(setAlign(nodes, path, align as CardAlignment))} className="rounded-lg p-2 text-[var(--pb-muted)] outline-none hover:bg-[var(--pb-surface)] aria-pressed:text-[var(--pb-accent)]">
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
