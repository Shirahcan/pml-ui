'use client';

import React, { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * The builder's section settings, as a panel that SLIDES IN FROM THE RIGHT when a section is
 * selected and slides back out when the author is done (owner, 2026-11-06). The canvas has the
 * full width the rest of the time.
 *
 * Deliberately NOT a modal: an author edits a section while watching the canvas, and may click
 * another section to switch, so nothing is blocked behind an overlay. It is fixed to the viewport
 * under the bar(s) with its own scroll, so every control stays reachable on a short screen. While
 * closed it is `inert` (no focus, no clicks). Esc closes it. Motion respects reduced-motion.
 */
export function SectionSettingsPanel({
  open,
  title,
  belowEditorHeader,
  onClose,
  children,
}: {
  open: boolean;
  /** The selected section's name, e.g. "Hero". */
  title: string;
  /** True when the editor's own sticky header (61px) sits under the shell bar (chrome not hoisted). */
  belowEditorHeader: boolean;
  onClose: () => void;
  children: ReactNode;
}): React.JSX.Element {
  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <aside
      aria-label="Section settings"
      inert={!open}
      className={`fixed bottom-0 right-0 z-40 flex w-full flex-col border-l border-white bg-white/90 shadow-[-12px_0_40px_rgb(15,23,42,0.08)] backdrop-blur-xl transition-transform duration-300 ease-out motion-reduce:transition-none dark:border-white/10 dark:bg-neutral-900/90 sm:w-[380px] ${
        belowEditorHeader ? 'top-[calc(var(--shell-top-bar-h,0px)+61px)]' : 'top-[var(--shell-top-bar-h,0px)]'
      } ${open ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-white/10">
        <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 outline-none hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
        >
          <X className="h-3.5 w-3.5" />
          Done
        </button>
      </div>

      {/* The bottom padding lets the last rows scroll clear of the floating Report + Porter buttons. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-28">{children}</div>
    </aside>
  );
}
