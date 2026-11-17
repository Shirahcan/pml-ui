'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { renderedPathFor } from '../../language';
import { COMMENT_SWATCH, type StudioComment } from '../../language';
import type { CommentNote, PmlNode } from '../../language';

import { CommentCard, type CommentActions } from './CommentCard';
import { pathElement } from './pathElement';

export type { CommentActions } from './CommentCard';

const PIN = 26;

/** The key a comment is known by on screen: its node's path. */
export const commentKey = (comment: StudioComment): string => comment.path.join('.');

/** Where an element's box sits inside the canvas, from its rendered path (comments are not rendered). */
function boxOf(root: HTMLElement, nodes: PmlNode[], target: number[]): DOMRect | null {
  const top = root.querySelector<HTMLElement>(`[data-pml-section="${target[0]}"]`);

  if (!top) return null;
  if (target.length === 1) return top.getBoundingClientRect();

  // A nested element is marked by a `display: contents` wrapper with no box of its own (measure its
  // child), or, for a table row or cell, by itself.
  const element = pathElement(top.querySelector<HTMLElement>(`[data-pml-path="${renderedPathFor(nodes, target).join('.')}"]`));

  return element ? element.getBoundingClientRect() : null;
}

/**
 * Where a pin sits on its element. The `n`th pin sharing the element and the placement steps aside by one pin (2026-11-17:
 * a template's Purpose and VERIFY notes share an element's top-right corner, and must never cover each other). A pin on a
 * right-hand corner stays inside the element's box, so the editor's slide-in panel over the right side cannot hide it
 * while the element itself shows.
 */
function pinAt(box: DOMRect, origin: DOMRect, placement: CommentNote['placement'], n = 0): { x: number; y: number } {
  const left = box.left - origin.left;
  const top = box.top - origin.top;
  const half = PIN / 2;
  const step = n * (PIN + 4);

  switch (placement) {
    case 'top-left':
      return { x: left - half + step, y: top - half };
    case 'bottom-left':
      return { x: left - half + step, y: top + box.height - half };
    case 'bottom-right':
      return { x: left + box.width - PIN - step, y: top + box.height - half };
    case 'left':
      return { x: left - PIN - 4, y: top + Math.min(box.height / 2, 40) - half + step };
    case 'right':
      return { x: left + box.width + 4, y: top + Math.min(box.height / 2, 40) - half + step };
    default:
      return { x: left + box.width - PIN - step, y: top - half };
  }
}

/** A check the author still owes ("VERIFY: ..."), labelled beside its pin so it reads without a click. */
const VERIFY = /^\s*VERIFY:\s*/i;

/**
 * Studio comments drawn Figma-style over the canvas (D2, owner 2026-11-07): a pin in the comment's
 * colour with its author's initial, at its placement on the element it is pinned to. A pin opens its
 * card. Comments whose element is gone gather in a tray at the top. The layer lives inside the canvas,
 * so it scrolls with the page; it is measured after every change and resize, and never captures a
 * click outside a pin or a card.
 */
export function CommentPins({
  nodes,
  comments,
  showResolved,
  openKey,
  onOpen,
  editingKey,
  onEditing,
  actions,
  banner = null,
}: {
  nodes: PmlNode[];
  comments: StudioComment[];
  showResolved: boolean;
  openKey: string | null;
  onOpen: (key: string | null) => void;
  editingKey: string | null;
  onEditing: (key: string | null) => void;
  actions: CommentActions;
  /** "Click the element this comment is about", while a comment is being moved. */
  banner?: React.ReactNode;
}): React.JSX.Element | null {
  const layer = useRef<HTMLDivElement>(null);
  // A card shown because the pointer rests on its pin (or on the card itself): it reads without a click, and goes when
  // the pointer leaves, unless it was opened by a click.
  const [peek, setPeek] = useState<string | null>(null);
  const leaving = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hold = (key: string) => {
    if (leaving.current) clearTimeout(leaving.current);
    if (!editingKey) setPeek(key);
  };
  const release = () => {
    if (leaving.current) clearTimeout(leaving.current);
    leaving.current = setTimeout(() => setPeek(null), 180);
  };
  const [spots, setSpots] = useState<Record<string, { x: number; y: number }>>({});
  const [width, setWidth] = useState(0);
  // Memoised: the measuring effect below runs when THESE change, never on every render.
  const { shown, pinned, orphans } = useMemo(() => {
    const visible = comments.filter((comment) => showResolved || !comment.note.resolved);

    return { shown: visible, pinned: visible.filter((comment) => comment.target !== null), orphans: visible.filter((comment) => comment.target === null) };
  }, [comments, showResolved]);

  // Measuring the drawn page is syncing with the DOM, outside React: it runs on the next frame.
  useLayoutEffect(() => {
    const root = layer.current?.parentElement;

    if (!root) return undefined;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const origin = root.getBoundingClientRect();
        const next: Record<string, { x: number; y: number }> = {};
        const sharing: Record<string, number> = {};

        for (const comment of pinned) {
          const box = comment.target ? boxOf(root, nodes, comment.target) : null;
          const corner = `${comment.target?.join('.')}|${comment.note.placement ?? 'top-right'}`;
          const n = sharing[corner] ?? 0;

          if (box) {
            next[commentKey(comment)] = pinAt(box, origin, comment.note.placement, n);
            sharing[corner] = n + 1;
          }
        }

        setSpots(next);
        setWidth(origin.width);
      });
    };
    const observer = new ResizeObserver(measure);

    observer.observe(root);
    measure();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [nodes, pinned]);

  if (shown.length === 0 && !banner) return null;

  const card = (comment: StudioComment, at: { x: number; y: number } | null) => {
    const key = commentKey(comment);

    if (openKey !== key && peek !== key) return null;

    const left = at ? Math.max(8, Math.min(at.x + PIN + 6, width - 296)) : 8;

    return (
      <div className="pointer-events-auto absolute z-40" style={{ left, top: at ? at.y : 44 }} onMouseEnter={() => hold(key)} onMouseLeave={release}>
        <CommentCard
          comment={comment}
          editing={editingKey === key}
          onEdit={(on) => onEditing(on ? key : null)}
          onClose={() => {
            onOpen(null);
            onEditing(null);
          }}
          actions={actions}
        />
      </div>
    );
  };

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0 z-30" aria-label="Comments">
      {banner}
      {orphans.length > 0 ? (
        <div className="pointer-events-auto absolute left-2 right-2 top-2 flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-900 shadow-sm">
          <span className="font-semibold">
            {orphans.length === 1 ? '1 comment lost its element' : `${orphans.length} comments lost their element`}
          </span>
          {orphans.map((comment) => (
            <button
              key={commentKey(comment)}
              type="button"
              onClick={() => onOpen(openKey === commentKey(comment) ? null : commentKey(comment))}
              className="max-w-[16rem] truncate whitespace-nowrap rounded-full border border-amber-300 bg-white px-3 py-1 outline-none hover:border-amber-500"
            >
              {comment.text || 'Empty comment'}
            </button>
          ))}
        </div>
      ) : null}
      {orphans.map((comment) => (
        <React.Fragment key={`card-${commentKey(comment)}`}>{card(comment, null)}</React.Fragment>
      ))}

      {pinned.map((comment) => {
        const key = commentKey(comment);
        const at = spots[key];

        if (!at) return null;

        const swatch = COMMENT_SWATCH[comment.note.color ?? 'yellow'];
        const initial = (comment.note.author ?? '?').trim().charAt(0).toUpperCase() || '?';
        const check = VERIFY.test(comment.text) ? comment.text.replace(VERIFY, '').trim() : null;
        // A check's label sits beside its pin, on the side away from the element's edge.
        const rightSide = (comment.note.placement ?? 'top-right').endsWith('right');

        return (
          <React.Fragment key={key}>
            {check && !comment.note.resolved ? (
              <button
                type="button"
                tabIndex={-1}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen(openKey === key ? null : key);
                }}
                onMouseEnter={() => hold(key)}
                onMouseLeave={release}
                className="pointer-events-auto absolute max-w-[14rem] truncate whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-sm outline-none"
                style={{
                  top: at.y + 3,
                  ...(rightSide ? { right: width - at.x + 4 } : { left: at.x + PIN + 4 }),
                  background: '#FEF3E2',
                  color: '#A15C07',
                  borderColor: '#F4C77B',
                }}
              >
                Check: {check}
              </button>
            ) : null}
            <button
              onMouseEnter={() => hold(key)}
              onMouseLeave={release}
              type="button"
              aria-label={`Comment by ${comment.note.author ?? 'someone'}: ${comment.text}`}
              aria-expanded={openKey === key}
              onClick={(event) => {
                event.stopPropagation();
                onOpen(openKey === key ? null : key);
              }}
              className={`pointer-events-auto absolute flex items-center justify-center rounded-full rounded-bl-none border-2 border-white text-[11px] font-bold shadow-md outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-[#4361EE] ${comment.note.resolved ? 'opacity-50' : ''}`}
              style={{ left: at.x, top: at.y, width: PIN, height: PIN, backgroundColor: swatch.fill, color: swatch.ink }}
            >
              {initial}
            </button>
            {card(comment, at)}
          </React.Fragment>
        );
      })}
    </div>
  );
}
