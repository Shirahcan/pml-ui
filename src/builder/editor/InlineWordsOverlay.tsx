'use client';

import React, { useEffect, useRef } from 'react';

import type { PmlNode } from '../../language';
import { EDIT_SURFACE } from './InlineTextOverlay';
import { ParagraphEditor } from './ParagraphEditor';

/** A paragraph's words opened for editing where they sit (post layouts E2). */
export interface InlineWordsEdit {
  path: number[];
  words: PmlNode[];
  /** What follows the words and is not words (a list item's nested list): kept as is, put back after them. */
  tail?: PmlNode[];
  rect: { top: number; left: number; width: number; height: number };
  font: React.CSSProperties;
}

/**
 * Rich words edited in place (post layouts E2, owner 2026-11-16: "a text area (simple or WYSIWYG/rich based on the
 * type/kind) in place"): the panel's own words editor, laid over the paragraph in its own type, with its toolbar
 * floating above. Clicking anywhere else or Ctrl+Enter keeps the words; Escape leaves them as they were. Keys stay
 * inside, so typing never reaches the canvas (Enter would select the section).
 */
export function InlineWordsOverlay({
  edit,
  onCommit,
  onCancel,
}: {
  edit: InlineWordsEdit;
  onCommit: (children: PmlNode[]) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const box = useRef<HTMLDivElement>(null);
  const latest = useRef<PmlNode[] | null>(null);
  const finished = useRef(false);
  const commit = useRef(onCommit);
  const cancel = useRef(onCancel);

  useEffect(() => {
    commit.current = onCommit;
    cancel.current = onCancel;
  });

  // One ending only. Keeping words nobody changed is the same as leaving them.
  const finish = useRef((keep: boolean) => {
    if (finished.current) return;
    finished.current = true;

    if (keep && latest.current) commit.current(latest.current);
    else cancel.current();
  });

  useEffect(() => {
    const away = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) finish.current(true);
    };

    document.addEventListener('mousedown', away, true);

    return () => document.removeEventListener('mousedown', away, true);
  }, []);

  return (
    <div
      ref={box}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();

        if (event.key === 'Escape') finish.current(false);

        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault();
          finish.current(true);
        }
      }}
      style={{ ...edit.rect, height: undefined, minHeight: edit.rect.height, ...edit.font, ...EDIT_SURFACE, position: 'absolute', zIndex: 20 }}
      className="rounded-sm outline outline-2 outline-offset-2 outline-[var(--site-accent)]"
    >
      <ParagraphEditor words={edit.words} variant="inline" autoFocus onChange={(children) => (latest.current = children)} />
    </div>
  );
}
