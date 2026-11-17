'use client';

import React, { useState } from 'react';
import { ChevronRight, GripVertical } from 'lucide-react';

import { elementLabel } from '../../language';
import { canHold, moveNode, type Moved } from '../../language';
import { getNodeAtPath, isCommentNode } from '../../language';
import type { PmlNode } from '../../language';
import { useOwnVars } from '../ui/theme';
import { useCatalog } from './catalog';
import { useBuilderHost } from './host';
import { useEditorNoun } from './surface';

type Zone = 'before' | 'after' | 'inside';

const same = (a: number[] | null, b: number[]): boolean => a !== null && a.length === b.length && a.every((step, i) => step === b[i]);

/** Words a person recognises: the element's own text when it has some. */
function describe(node: PmlNode, fallback: string): string {
  const props = (node.props ?? {}) as Record<string, unknown>;
  const words = [props.text, props.label, props.value, props.title].find((value) => typeof value === 'string' && value.trim() !== '');

  return typeof words === 'string' ? `${fallback}: ${words.slice(0, 32)}` : fallback;
}

/**
 * The page as a tree: every element by name, so a small or hidden one can still be reached. Drag a row
 * to reorder it or move it into another container; a spot the page cannot hold it in is simply not
 * offered, so a drag can never produce something a save would refuse.
 */
export function PageLayers({
  nodes,
  selectedPath,
  onSelect,
  onMoved,
}: {
  nodes: PmlNode[];
  selectedPath: number[] | null;
  onSelect: (path: number[]) => void;
  onMoved: (moved: Moved) => void;
}): React.JSX.Element {
  const catalog = useCatalog();
  const host = useBuilderHost();
  const vars = useOwnVars();
  const noun = useEditorNoun();
  const [dragging, setDragging] = useState<number[] | null>(null);
  const [target, setTarget] = useState<{ path: number[]; zone: Zone } | null>(null);

  const label = (node: PmlNode): string => {
    const name = node.component ?? node.primitive ?? '';

    return elementLabel(name, catalog);
  };

  const dragged = dragging ? getNodeAtPath(nodes, dragging) : null;

  const zoneFor = (event: React.DragEvent, path: number[], node: PmlNode): Zone | null => {
    if (!dragged || !dragging) return null;

    const box = event.currentTarget.getBoundingClientRect();
    const offset = (event.clientY - box.top) / box.height;
    const parent = path.length > 1 ? getNodeAtPath(nodes, path.slice(0, -1)) : null;

    if (offset > 0.3 && offset < 0.7 && canHold(node, dragged)) return 'inside';
    if (!canHold(parent, dragged)) return canHold(node, dragged) ? 'inside' : null;

    return offset < 0.5 ? 'before' : 'after';
  };

  const drop = (path: number[]) => {
    if (dragging && target) {
      const parentPath = target.zone === 'inside' ? path : path.slice(0, -1);
      const last = path[path.length - 1];
      const index = target.zone === 'inside' ? (getNodeAtPath(nodes, path)?.children ?? []).length : target.zone === 'before' ? last : last + 1;
      const moved = moveNode(nodes, dragging, parentPath, index);

      if (moved) onMoved(moved);
      else host.onError('That element cannot go there.');
    }

    setDragging(null);
    setTarget(null);
  };

  const row = (node: PmlNode, path: number[]): React.ReactNode => {
    if (isCommentNode(node)) return null;

    const key = path.join('.');
    const selected = same(selectedPath, path);
    const over = target && same(target.path, path) ? target.zone : null;
    const children = node.component ? [] : (node.children ?? []);

    return (
      <li key={key}>
        <div
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            setDragging(path);
          }}
          onDragEnd={() => {
            setDragging(null);
            setTarget(null);
          }}
          onDragOver={(event) => {
            const zone = zoneFor(event, path, node);

            if (zone && !same(dragging, path)) {
              event.preventDefault();
              setTarget({ path, zone });
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            drop(path);
          }}
          style={{ paddingLeft: `${(path.length - 1) * 14 + 4}px` }}
          className={`group/row relative flex items-center gap-1 rounded-lg py-1 pr-2 text-sm ${selected ? 'bg-[var(--pb-accent-soft)] text-[var(--pb-accent)]' : 'text-slate-700 hover:bg-slate-100'} ${
            over === 'inside' ? 'ring-2 ring-inset ring-[var(--pb-accent)]' : ''
          } ${same(dragging, path) ? 'opacity-40' : ''}`}
        >
          {over === 'before' ? <span className="absolute inset-x-0 -top-px h-0.5 bg-[var(--pb-accent)]" /> : null}
          {over === 'after' ? <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--pb-accent)]" /> : null}
          <GripVertical aria-hidden="true" className="h-3.5 w-3.5 shrink-0 cursor-grab opacity-0 group-hover/row:opacity-50" />
          {children.length > 0 ? <ChevronRight aria-hidden="true" className="h-3 w-3 shrink-0 rotate-90 opacity-50" /> : <span className="w-3 shrink-0" />}
          <button type="button" onClick={() => onSelect(path)} className="min-w-0 flex-1 truncate text-left outline-none">
            {describe(node, label(node))}
          </button>
        </div>
        {children.length > 0 ? <ul>{children.map((child, i) => row(child, [...path, i]))}</ul> : null}
      </li>
    );
  };

  return (
    <section aria-label="Layers" className="space-y-2" style={vars}>
      <h3 className="text-sm font-semibold text-slate-900">Layers</h3>
      {nodes.length === 0 ? <p className="text-sm text-slate-500">This {noun ?? 'page'} is empty.</p> : <ul className="-mx-1">{nodes.map((node, i) => row(node, [i]))}</ul>}
      <p className="text-xs text-slate-500">Drag a row to move it, or onto a section to put it inside.</p>
    </section>
  );
}
