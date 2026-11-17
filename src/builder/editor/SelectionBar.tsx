'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Sparkles, Trash2, Wand2 } from 'lucide-react';

import { elementLabel, getNodeAtPath, removeNodeAtPath, type PmlNode } from '../../language';
import type { DocumentLayout } from '../document';
import { canDelete, instancePaths, neighbourInstance, partOf, swapSiblings } from './layoutParts';

/**
 * A post piece, or a block made only of them (the opening): its words are the post's FIELDS, so the assistant's asks,
 * which rewrite design, are not offered (the server refuses exactly this set: GrowthPostConsoleController::onlyPostPieces).
 */
function onlyPostPieces(node: PmlNode): boolean {
  if ((node.primitive ?? '').startsWith('post_')) return true;

  const kids = (node.children ?? []).filter((child) => child.comment === undefined);

  return kids.length > 0 && kids.every(onlyPostPieces);
}

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
 * the assistant's two asks, and for one instance of a repeating part Up / Down / Remove within the part's limits.
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
}: {
  nodes: PmlNode[];
  path: number[];
  layout?: DocumentLayout | null;
  studio?: Array<{ key: string; name: string }>;
  change: (next: PmlNode[]) => void;
  select: (path: number[] | null) => void;
  onAsk?: (ask: AssistantAsk) => void;
}): React.JSX.Element | null {
  const node = getNodeAtPath(nodes, path);
  if (!node) return null;

  const part = partOf(layout, node.part);
  const label = part?.label ?? elementLabel(node.component ?? node.primitive ?? '', studio);
  const repeat = part?.kind === 'repeat';
  const instances = part ? instancePaths(nodes, part.key) : [];
  const nth = instances.findIndex((at) => at.join('.') === path.join('.')) + 1;
  const up = repeat ? neighbourInstance(nodes, path, -1) : null;
  const down = repeat ? neighbourInstance(nodes, path, 1) : null;
  const parent = path.slice(0, -1);
  const fieldPiece = onlyPostPieces(node);

  const move = (to: number) => {
    change(swapSiblings(nodes, path, to));
    select([...parent, to]);
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
      {onAsk && !fieldPiece ? (
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
      {repeat ? (
        <>
          <button type="button" className={button} disabled={up === null} onClick={() => up !== null && move(up)} aria-label={`Move this ${label.toLowerCase()} up`}>
            <ArrowUp className="h-3 w-3" aria-hidden />
            Up
          </button>
          <button type="button" className={button} disabled={down === null} onClick={() => down !== null && move(down)} aria-label={`Move this ${label.toLowerCase()} down`}>
            <ArrowDown className="h-3 w-3" aria-hidden />
            Down
          </button>
          <button
            type="button"
            className={button}
            disabled={!canDelete(nodes, layout, path)}
            onClick={() => {
              change(removeNodeAtPath(nodes, path));
              select(null);
            }}
            aria-label={`Remove this ${label.toLowerCase()}`}
            title={canDelete(nodes, layout, path) ? undefined : `The template needs at least ${Math.max(part?.min ?? 0, 1)}.`}
          >
            <Trash2 className="h-3 w-3" aria-hidden />
            Remove
          </button>
        </>
      ) : null}
    </div>
  );
}
