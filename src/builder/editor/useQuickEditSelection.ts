'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * How long a click waits before the side column shows the block's settings, so the double-click that starts a quick
 * edit never flashes them (the page builder's window, owner 2026-11-16).
 */
export const QUICK_EDIT_WINDOW_MS = 250;

/**
 * The selection of an editor that offers quick edits (blog-on-growth-service S7b; lifted from EmailEditor, portify-ab
 * 0.7.34, so the page and email editors share ONE rule). "The right panel shouldn't be open when quick editing"
 * (owner 2026-11-16): with quick edits on, a click selects the block at once but its settings wait out the double-click
 * window; a quick edit puts the column back on what it showed before, until the next click. With quick edits off, a
 * click shows the settings at once.
 */
export function useQuickEditSelection(quickEdit: boolean) {
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null);
  const [settingsShown, setSettingsShown] = useState(false);
  const pendingSettings = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingSettings = useCallback(() => {
    if (pendingSettings.current) clearTimeout(pendingSettings.current);
    pendingSettings.current = null;
  }, []);
  useEffect(() => cancelPendingSettings, [cancelPendingSettings]);

  const selectPath = useCallback(
    (path: number[] | null) => {
      setSelectedPath(path);
      cancelPendingSettings();
      if (path === null) {
        setSettingsShown(false);
      } else if (!quickEdit) {
        setSettingsShown(true);
      } else if (!settingsShown) {
        pendingSettings.current = setTimeout(() => {
          pendingSettings.current = null;
          setSettingsShown(true);
        }, QUICK_EDIT_WINDOW_MS);
      }
    },
    [cancelPendingSettings, quickEdit, settingsShown],
  );

  const onQuickEdit = useCallback(
    (editing: boolean) => {
      if (!editing) return;
      cancelPendingSettings();
      setSettingsShown(false);
    },
    [cancelPendingSettings],
  );

  return { selectedPath, selectPath, settingsShown, onQuickEdit };
}
