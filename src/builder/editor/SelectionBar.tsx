'use client';

import React from 'react';
import { ArrowDown, ArrowUp, MessageSquarePlus, Sparkles, Trash2, Wand2 } from 'lucide-react';

import { elementLabel, getNodeAtPath, onlyPieces, removeNodeAtPath, type PmlNode, type ProfilePieces } from '../../language';
import type { DocumentLayout } from '../document';
import { Button } from '../ui/controls';
import { canDelete, instancePaths, movable, partOf, reorder } from './layoutParts';

/** A document with no pieces (a page): every element is design. */
const NO_PIECES: ProfilePieces = {};

/** What the selection bar hands the host when the person asks the assistant about the selected element. */
export interface AssistantAsk {
  /** `write`: rewrite this element; `suggest`: suggest better words for it. */
  kind: 'write' | 'suggest';
  path: number[];
  node: PmlNode;
  /** The element's name as the bar shows it ("Question", "Title"). */
  label: string;
}

/**
 * The selected element's bar (owner 2026-11-17, the reference studio): its number and name over its top-left corner,
 * the assistant's two asks, and Up / Down / Remove for every element (owner 2026-11-18: no element is locked; a repeat's
 * limits are the publish checks, never a disabled button).
 *
 * "AI write" and "AI suggest" make NO call here: they hand the host a scoped ask, which a post's designer sends to its
 * docked console as an ordinary turn about that element (the person asked by clicking). Without `onAsk` they are not
 * offered. A move or a removal is one change, undone like any other.
 */
export function SelectionBar({
  nodes,
  path,
  layout,
  studio = [],
  change,
  select,
  onAsk,
  canAsk,
  pieces = NO_PIECES,
  onComment,
}: {
  nodes: PmlNode[];
  path: number[];
  layout?: DocumentLayout | null;
  studio?: Array<{ key: string; name: string }>;
  change: (next: PmlNode[]) => void;
  select: (path: number[] | null) => void;
  onAsk?: (ask: AssistantAsk) => void;
  /** Which elements the host's assistant takes an ask about (its server's own rule); it wins over the default. */
  canAsk?: (node: PmlNode, path: number[]) => boolean;
  /**
   * The document's pieces (its profile's). Without `canAsk`, a piece or a block made only of them (a post's opening) is
   * the document's FIELDS, not design text, so no ask is offered there.
   */
  pieces?: ProfilePieces;
  /** Write a studio comment pinned to this element; absent where the host has no author. */
  onComment?: (path: number[]) => void;
}): React.JSX.Element | null {
  const node = getNodeAtPath(nodes, path);
  if (!node) return null;

  const part = partOf(layout, node.part);
  const label = part?.label ?? elementLabel(node.component ?? node.primitive ?? '', studio);
  const repeat = part?.kind === 'repeat';
  const instances = part ? instancePaths(nodes, part.key) : [];
  const nth = instances.findIndex((at) => at.join('.') === path.join('.')) + 1;
  const askable = canAsk ? canAsk(node, path) : !onlyPieces(pieces, node);
  // Moves and removal by the layout's one rule (owner 2026-11-17: the reorder buttons live here, at the top-left, where
  // the slide-in panel never covers them, and show on hover as well as for the selection; 2026-11-18: nothing refuses).
  const up = reorder(nodes, layout, path, -1);
  const down = reorder(nodes, layout, path, 1);
  const moves = movable(nodes, layout, path);
  const removable = canDelete(nodes, layout, path);
  const go = (step: { nodes: PmlNode[]; path: number[] } | null) => {
    if (!step) return;
    change(step.nodes);
    select(step.path);
  };

  const button = 'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold outline-none hover:bg-white/15 disabled:opacity-40';

  return (
    <div
      role="toolbar"
      aria-label={`${label} tools`}
      data-creator-keep-panel=""
      className="flex flex-wrap items-center gap-1 rounded-t-md px-2 py-1 text-[11px] font-medium text-white shadow-md"
      style={{ background: '#050351' }}
      // A press on the bar is a press on the bar, never a new selection on the canvas under it.
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <span className="whitespace-nowrap pr-1 opacity-90">
        {String(path[0] + 1).padStart(2, '0')} · {label}
        {repeat && instances.length > 1 ? ` · ${nth} of ${instances.length}` : ''}
      </span>
      {onAsk && askable ? (
        <>
          <button type="button" className={button} onClick={() => onAsk({ kind: 'write', path, node, label })}>
            <Wand2 className="h-3 w-3" aria-hidden />
            AI write
          </button>
          <button type="button" className={button} onClick={() => onAsk({ kind: 'suggest', path, node, label })}>
            <Sparkles className="h-3 w-3" aria-hidden />
            AI suggest
          </button>
        </>
      ) : null}
      {onComment ? (
        <button type="button" className={button} onClick={() => onComment(path)}>
          <MessageSquarePlus className="h-3 w-3" aria-hidden />
          Comment
        </button>
      ) : null}
      {moves ? (
        <>
          <button type="button" className={button} disabled={!up} onClick={() => go(up)} aria-label={`Move this ${label.toLowerCase()} up`}>
            <ArrowUp className="h-3 w-3" aria-hidden />
            Up
          </button>
          <button type="button" className={button} disabled={!down} onClick={() => go(down)} aria-label={`Move this ${label.toLowerCase()} down`}>
            <ArrowDown className="h-3 w-3" aria-hidden />
            Down
          </button>
        </>
      ) : null}
      {repeat || removable ? (
        <button
          type="button"
          className={button}
          onClick={() => {
            change(removeNodeAtPath(nodes, path));
            select(null);
          }}
          aria-label={`Remove this ${label.toLowerCase()}`}
        >
          <Trash2 className="h-3 w-3" aria-hidden />
          Remove
        </button>
      ) : null}
    </div>
  );
}

/**
 * The selected element's position in its settings panel (owner 2026-11-17: "there should be reorder options on the side
 * panel config"), by the same rule as its bar: every element moves; nothing only when it has no sibling to pass.
 */
export function PositionControls({
  nodes,
  path,
  layout,
  change,
  select,
}: {
  nodes: PmlNode[];
  path: number[];
  layout?: DocumentLayout | null;
  change: (next: PmlNode[]) => void;
  select: (path: number[] | null) => void;
}): React.JSX.Element | null {
  if (!movable(nodes, layout, path)) return null;

  const up = reorder(nodes, layout, path, -1);
  const down = reorder(nodes, layout, path, 1);
  const go = (step: { nodes: PmlNode[]; path: number[] } | null) => {
    if (!step) return;
    change(step.nodes);
    select(step.path);
  };

  return (
    <div role="group" aria-label="Position" className="flex flex-wrap items-center gap-2">
      <span className="mr-auto text-sm font-medium">Position</span>
      <Button type="button" variant="outline" size="sm" disabled={!up} onClick={() => go(up)} className="whitespace-nowrap outline-none">
        <ArrowUp className="mr-1 h-4 w-4" aria-hidden />
        Move up
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={!down} onClick={() => go(down)} className="whitespace-nowrap outline-none">
        <ArrowDown className="mr-1 h-4 w-4" aria-hidden />
        Move down
      </Button>
    </div>
  );
}
