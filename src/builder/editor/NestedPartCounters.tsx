'use client';

import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { renderedPathFor, type PmlNode } from '../../language';
import type { DocumentLayout } from '../document';
import { counterWords, nestedCounters } from './PartGuides';
import { pathElement } from './pathElement';

/** Marks an instance the canvas leaves room under, so its count never sits on the next instance's words. */
const SPACE = 'data-pml-counter-space';

/**
 * The word count of each part instance NESTED inside a section (an FAQ's question and answer), drawn directly under THAT
 * instance (owner 2026-11-18: "these should be appropriately placed individually below each item/question"; they had all
 * stacked after the FAQ). A layer over the canvas, measured like the comment pins: from the instance's own box, again
 * after any change to the drawn page and on a resize, so it follows an added or removed item. The canvas leaves a
 * little room under each counted instance; a live page never sees the counts or the room.
 */
export function NestedPartCounters({ nodes, layout }: { nodes: PmlNode[]; layout: DocumentLayout }): React.JSX.Element | null {
  const layer = useRef<HTMLDivElement>(null);
  const counters = useMemo(() => nestedCounters(nodes, layout), [nodes, layout]);
  const [spots, setSpots] = useState<Record<string, { x: number; y: number }>>({});

  useLayoutEffect(() => {
    const root = layer.current?.parentElement;

    if (!root || counters.length === 0) return undefined;

    let frame = 0;
    const marked = new Set<HTMLElement>();
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const origin = root.getBoundingClientRect();
        const next: Record<string, { x: number; y: number }> = {};
        const keep = new Set<HTMLElement>();

        for (const counter of counters) {
          const element = pathElement(root.querySelector<HTMLElement>(`[data-pml-path="${renderedPathFor(nodes, counter.path).join('.')}"]`));

          if (!element) continue;
          element.setAttribute(SPACE, '');
          keep.add(element);

          const box = element.getBoundingClientRect();
          next[counter.key] = { x: box.left - origin.left, y: box.bottom - origin.top + 2 };
        }

        marked.forEach((element) => {
          if (!keep.has(element)) element.removeAttribute(SPACE);
        });
        marked.clear();
        keep.forEach((element) => marked.add(element));
        setSpots(next);
      });
    };
    const resized = new ResizeObserver(measure);
    // An added or removed item, or the compile landing, changes the drawn page; changes inside this layer do not count.
    const drawn = new MutationObserver((records) => {
      if (records.every((record) => layer.current?.contains(record.target))) return;
      measure();
    });

    resized.observe(root);
    drawn.observe(root, { childList: true, subtree: true });
    measure();

    return () => {
      cancelAnimationFrame(frame);
      resized.disconnect();
      drawn.disconnect();
      marked.forEach((element) => element.removeAttribute(SPACE));
    };
  }, [nodes, counters]);

  if (counters.length === 0) return null;

  return (
    <div ref={layer} className="pointer-events-none absolute inset-0" style={{ zIndex: 20 }}>
      <style>{`[${SPACE}] { margin-bottom: 20px !important; }`}</style>
      {counters.map((counter) => {
        const at = spots[counter.key];

        if (!at) return null;

        const ok = (counter.min === undefined || counter.words >= counter.min) && (counter.max === undefined || counter.words <= counter.max);

        return (
          <p
            key={counter.key}
            data-part-counter={counter.key}
            style={{
              position: 'absolute',
              left: at.x,
              top: at.y,
              margin: 0,
              whiteSpace: 'nowrap',
              fontSize: 11,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              color: ok ? '#15803D' : '#C62828',
            }}
          >
            {counterWords(counter)}
          </p>
        );
      })}
    </div>
  );
}
