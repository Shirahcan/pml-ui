'use client';

import React from 'react';
import { Minus, Plus } from 'lucide-react';

import { ensureUids, getNodeAtPath, removeNodeAtPath, updateNodeAtPath, type PmlNode } from '../../language';
import type { DocumentLayout, DocumentLayoutPart } from '../document';
import { resolvePrimitiveStyle } from '../../pml/primitiveStyle';
import { FRAME_GUTTER, FRAME_MAX_WIDTH, splitSectionFrame } from '../../pml/sectionFrame';

/**
 * The layout's guides on the canvas, editor-only (owner 2026-11-17, T2: the designer mirrors the reference studio):
 * under each part with a words rule, its count against the rule ("142 words · aim 150 to 200", red outside the range);
 * after the last instance of a repeating part, "+ Add {part}" and "Remove last {part}". Its min and max are the publish
 * checks' advice, never a limit here (owner 2026-11-18: "don't lock any element/component"). The
 * parts come from the document's layout (its meta); a node says which part it is with `part`.
 */

/** Props that are not words a reader reads (the same list pml-kit's LayoutChecks skips, so the counts agree). */
const NOT_WORDS = new Set(['href', 'src', 'url', 'icon', 'id', 'variant', 'level', 'target', 'name', 'key', 'color', 'layout', 'align', 'size', 'doc']);

function strings(node: PmlNode): string[] {
  const out: string[] = [];

  for (const [key, value] of Object.entries((node.props ?? {}) as Record<string, unknown>)) {
    if (typeof value === 'string' && !NOT_WORDS.has(key)) out.push(value);
  }
  for (const child of node.children ?? []) out.push(...strings(child));

  return out;
}

/** A part's words, counted as pml-kit's LayoutChecks counts them. */
export function wordCount(node: PmlNode): number {
  const text = strings(node).join(' ').trim();

  return text === '' ? 0 : text.split(/\s+/u).length;
}

/** One part's count against its words rule. */
export interface PartCounter {
  key: string;
  label: string;
  words: number;
  min?: number;
  max?: number;
}

interface RepeatRow {
  part: DocumentLayoutPart;
  /** Every instance's path, in order. */
  paths: number[][];
}

/** Every node marked with a part, under (and including) the section at `index`, with its path. */
function partNodes(nodes: PmlNode[], index: number): { node: PmlNode; path: number[] }[] {
  const out: { node: PmlNode; path: number[] }[] = [];
  const walk = (node: PmlNode, path: number[]) => {
    if (typeof node.part === 'string') out.push({ node, path });
    (node.children ?? []).forEach((child, i) => walk(child, [...path, i]));
  };
  const top = nodes[index];
  if (top) walk(top, [index]);

  return out;
}

/** Every part instance NESTED inside a section that has a words rule, with its path and its count. */
export function nestedCounters(nodes: PmlNode[], layout: DocumentLayout): Array<PartCounter & { path: number[] }> {
  const parts = new Map(layout.parts.map((part) => [part.key, part]));

  return nodes.flatMap((_, index) =>
    partNodes(nodes, index)
      .filter(({ path }) => path.length > 1)
      .map(({ node, path }) => ({ node, path, part: parts.get(node.part as string) }))
      .filter(({ part }) => part?.rules?.words)
      .map(({ node, path, part }) => ({
        key: path.join('.'),
        path,
        label: part!.label,
        words: wordCount(node),
        min: part!.rules!.words!.min,
        max: part!.rules!.words!.max,
      })),
  );
}

export function counterWords(c: PartCounter): string {
  const range = c.min !== undefined && c.max !== undefined ? `aim ${c.min} to ${c.max}` : c.max !== undefined ? `under ${c.max}` : `at least ${c.min}`;

  return `${c.words} words · ${range}`;
}

/** The guides drawn after the section at `index`: its counters, and the add/remove row of a repeat ending here. */
export function PartGuides({
  nodes,
  index,
  layout,
  change,
}: {
  nodes: PmlNode[];
  index: number;
  layout: DocumentLayout;
  change: (next: PmlNode[]) => void;
}): React.JSX.Element | null {
  const parts = new Map(layout.parts.map((part) => [part.key, part]));
  const inHere = partNodes(nodes, index);

  // Only the section's OWN count here; an instance nested inside it (an FAQ's question) is counted under that instance
  // (NestedPartCounters, owner 2026-11-18: "placed individually below each item/question").
  const counters: PartCounter[] = inHere
    .filter(({ path }) => path.length === 1)
    .map(({ node }) => ({ node, part: parts.get(node.part as string) }))
    .filter(({ part }) => part?.rules?.words)
    .map(({ node, part }, i) => ({ key: `${part!.key}-${i}`, label: part!.label, words: wordCount(node), min: part!.rules!.words!.min, max: part!.rules!.words!.max }));

  // A repeating part whose LAST instance is in this section (top-level, or nested inside it, like FAQs in the FAQ).
  const rows: RepeatRow[] = [];
  for (const part of layout.parts.filter((p) => p.kind === 'repeat')) {
    const paths: number[][] = [];
    nodes.forEach((_, i) => partNodes(nodes, i).forEach(({ node, path }) => node.part === part.key && paths.push(path)));
    const last = paths[paths.length - 1];
    if (last && last[0] === index) rows.push({ part, paths });
  }

  if (counters.length === 0 && rows.length === 0) return null;

  const add = (row: RepeatRow) => {
    const last = row.paths[row.paths.length - 1];
    // A fresh instance: the part's own starter, given new permanent ids (never a copy of the author's words).
    const starter = (row.part.starter ?? []).map((node) => strip(node));
    // One instance is one element: it says which part it is, so it counts as one (checks, counters, this row).
    const marked = starter.length === 1 && !starter[0].part ? [{ ...starter[0], part: row.part.key }] : starter;
    const fresh = ensureUids(marked);
    if (fresh.length === 0) return;

    if (last.length === 1) {
      change([...nodes.slice(0, last[0] + 1), ...fresh, ...nodes.slice(last[0] + 1)]);
    } else {
      const parentPath = last.slice(0, -1);
      const parent = getNodeAtPath(nodes, parentPath);
      if (!parent) return;
      const at = last[last.length - 1] + 1;
      const children = [...(parent.children ?? [])];
      children.splice(at, 0, ...fresh);
      change(updateNodeAtPath(nodes, parentPath, { ...parent, children }));
    }
  };

  const removeLast = (row: RepeatRow) => change(removeNodeAtPath(nodes, row.paths[row.paths.length - 1]));

  // The counters sit in the same column as the section's content (owner 2026-11-18: "these notices/markers/counters
  // should use appropriate left padding"): its frame's width, gutters and own side padding, read from the section itself,
  // so they line up with the words at every width and whatever padding the section was given.
  const frame = nodes[index] ? splitSectionFrame(nodes[index]) : null;
  const container = frame?.framed ? resolvePrimitiveStyle(frame.container) : null;
  const column = frame?.framed && container ? `mx-auto w-full ${FRAME_MAX_WIDTH[frame.width]} ${frame.defaultGutter ? FRAME_GUTTER : ''} ${container.className}`.replace(/\s+/g, ' ').trim() : '';

  return (
    <div className="mt-1 space-y-1.5" data-builder-keep-panel="">
      {counters.length > 0 ? (
      <div className={`${column} space-y-1.5`.trim()} style={container?.style}>
      {counters.map((c) => {
        const ok = (c.min === undefined || c.words >= c.min) && (c.max === undefined || c.words <= c.max);

        return (
          <p key={c.key} className={`font-mono text-[11px] ${ok ? 'text-[#15803D]' : 'text-[#C62828]'}`}>
            {counters.length > 1 || c.label !== parts.get(nodes[index]?.part as string)?.label ? `${c.label}: ` : ''}
            {counterWords(c)}
          </p>
        );
      })}
      </div>
      ) : null}
      {rows.map((row) => {
        const count = row.paths.length;
        // Owner 2026-11-18: no element is locked, so neither the template's max nor its min refuses; the publish checks
        // name a count outside them. Add needs only a starter to copy.
        const canAdd = (row.part.starter?.length ?? 0) > 0;
        const canRemove = count > 0;

        if (!canAdd && !canRemove) return null;

        return (
          <div key={row.part.key} className="flex flex-wrap justify-center gap-2 py-1">
            {canAdd ? (
              <button type="button" onClick={() => add(row)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-[#C8C7F5] bg-white px-3 py-1 text-xs font-semibold text-[#4F46E5] outline-none hover:border-solid">
                <Plus className="h-3 w-3" aria-hidden="true" />
                Add {row.part.label.toLowerCase()}
              </button>
            ) : null}
            {canRemove ? (
              <button type="button" onClick={() => removeLast(row)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-dashed border-[#C8C7F5] bg-white px-3 py-1 text-xs font-semibold text-[#4F46E5] outline-none hover:border-solid">
                <Minus className="h-3 w-3" aria-hidden="true" />
                Remove last {row.part.label.toLowerCase()}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** A starter node without ids, so ensureUids gives the new instance its own. */
function strip(node: PmlNode): PmlNode {
  const { uid: _uid, ...rest } = node;

  return { ...rest, children: node.children?.map(strip) } as PmlNode;
}
