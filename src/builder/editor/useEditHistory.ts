'use client';

import { useCallback, useRef, useState } from 'react';

import type { PmlNode } from '../../language';

const LIMIT = 50;
/** Changes this close together (typing a word) are one step, so undo does not go letter by letter. */
const SAME_STEP_MS = 800;

/**
 * Undo and redo for the page tree (PML v2 S4-01). Each entry is a whole tree: they share their
 * unchanged branches, so this stays cheap, and the tree is what autosave already writes, so undoing
 * simply saves the earlier tree.
 */
export function useEditHistory() {
  const past = useRef<PmlNode[][]>([]);
  const future = useRef<PmlNode[][]>([]);
  const lastChange = useRef(0);
  const [depth, setDepth] = useState({ past: 0, future: 0 });

  const sync = useCallback(() => setDepth({ past: past.current.length, future: future.current.length }), []);

  /** Call with the tree as it was, just before a change. */
  const record = useCallback(
    (before: PmlNode[]) => {
      const now = Date.now();

      if (now - lastChange.current > SAME_STEP_MS) {
        past.current = [...past.current, before].slice(-LIMIT);
      }

      lastChange.current = now;
      future.current = [];
      sync();
    },
    [sync],
  );

  /** The tree to go back to, or null when there is none. */
  const undo = useCallback(
    (current: PmlNode[]): PmlNode[] | null => {
      const previous = past.current[past.current.length - 1];

      if (previous === undefined) return null;

      past.current = past.current.slice(0, -1);
      future.current = [...future.current, current];
      lastChange.current = 0;
      sync();

      return previous;
    },
    [sync],
  );

  const redo = useCallback(
    (current: PmlNode[]): PmlNode[] | null => {
      const next = future.current[future.current.length - 1];

      if (next === undefined) return null;

      future.current = future.current.slice(0, -1);
      past.current = [...past.current, current];
      lastChange.current = 0;
      sync();

      return next;
    },
    [sync],
  );

  return { record, undo, redo, canUndo: depth.past > 0, canRedo: depth.future > 0 };
}
