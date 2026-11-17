'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { PmlNativesPayload, PmlNode } from '../../language';
import type { EditableDocumentAdapter } from '../document';

/**
 * The canvas's live compile of a design, debounced (shared program E4a4i). A transiently invalid edit KEEPS the last
 * good compile and reports where it broke.
 *
 * ⚠ ONLY THE NEWEST REQUEST MAY LAND. Compiles are answered out of order (a big tree is slower than a small one), and
 * the canvas pairs `compiled[i]` with `nodes[i]` by position: a slow earlier answer arriving last would draw the old
 * tree's blocks under the new tree's handles. Every request takes a number; an answer whose number is not the latest is
 * dropped.
 */
export function useCompiledPreview(
  adapter: Pick<EditableDocumentAdapter, 'preview'>,
  id: string,
  nodes: PmlNode[],
  active: boolean,
  onError: (error: unknown) => void,
) {
  const [compiled, setCompiled] = useState<PmlNode[] | null>(null);
  const [natives, setNatives] = useState<PmlNativesPayload | null>(null);
  const [previewError, setPreviewError] = useState<{ message: string; path: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);
  // Bumped to compile the same design again (see `refresh`).
  const [nonce, setNonce] = useState(0);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!active) return;
    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      timer.current = null;
      const mine = ++latest.current;

      adapter
        .preview(id, nodes)
        .then((result) => {
          if (mine !== latest.current) return;

          if (result.error) {
            setPreviewError(result.error);
          } else {
            setCompiled(result.tree);
            setNatives(result.natives);
            setPreviewError(null);
          }
        })
        .catch((err) => {
          if (mine === latest.current) onErrorRef.current(err);
        });
    }, 500);
  }, [adapter, id, nodes, active, nonce]);

  // Leaving: no compile is asked for, and none still on its way may land.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      latest.current += 1;
    },
    [],
  );

  /** Forget the last compile (another document is opening): its blocks belong to a tree that is no longer here. */
  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    latest.current += 1;
    setCompiled(null);
    setNatives(null);
    setPreviewError(null);
  }, []);

  /**
   * Compile again with the same design: something the design READS changed outside it (a post's title or category saved
   * from a panel). Without it the canvas kept drawing the old title until the design itself changed (2026-11-17).
   */
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { compiled, natives, previewError, reset, refresh };
}
