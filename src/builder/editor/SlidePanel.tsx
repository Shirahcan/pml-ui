'use client';

import React, { startTransition, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';

/**
 * What a press may land on without closing the panel: the canvas (which selects THAT element instead, the panel
 * following it), the assistant's console, a Code view, controls a host marks as acting on the selection
 * (`data-builder-keep-panel`), and anything the panel opened in a portal (a select's list, a menu, a dialog).
 */
const KEEPS_OPEN = [
  '[data-pml-path]',
  '[data-pml-section]',
  '[data-ai-terminal]',
  '[data-studio-code]',
  '[data-builder-keep-panel]',
  '[data-creator-keep-panel]',
  '[data-radix-popper-content-wrapper]',
  '[role="dialog"]',
  '[role="alertdialog"]',
  '[role="menu"]',
  '[role="listbox"]',
].join(', ');

/** The narrowest and widest a person may drag the panel to (owner 2026-11-18: "make side panel wider"). */
export const PANEL_MIN_WIDTH = 360;
export const PANEL_MAX_WIDTH = 720;

function rememberedWidth(key: string): number | null {
  if (typeof window === 'undefined') return null;

  try {
    const value = Number(window.localStorage.getItem(key));

    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function rememberWidth(key: string, width: number): void {
  try {
    window.localStorage.setItem(key, String(Math.round(width)));
  } catch {
    // Private browsing: the width lasts for this visit only.
  }
}

const clampWidth = (width: number): number => Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, width));

/** Close on a press outside the panel, except where that press means something to it (see KEEPS_OPEN). */
function useDismissOnOutside(panel: RefObject<HTMLElement | null>, open: boolean, onDismiss: () => void): void {
  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;

      if (!target || panel.current?.contains(target) || target.closest(KEEPS_OPEN)) return;
      // While a menu, a list or a dialog is open the page is inert, so this press closes THAT layer only.
      if (document.querySelector('[data-radix-popper-content-wrapper], [role="dialog"], [role="alertdialog"]')) return;

      onDismiss();
    };

    document.addEventListener('pointerdown', onPointerDown, true);

    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [panel, open, onDismiss]);
}

/**
 * The editor's options panel (owner 2026-11-17: "Maintain the same slide in/out panels for options/configs/etc - the
 * design area shouldn't be shrunken"; moved from Portify's page builder, CreatorPanel). It FLOATS over the canvas from
 * the right, so the design never narrows when it opens; it is closed by default; a press outside it or Escape closes
 * it. Deliberately not a modal: the author watches the canvas while editing and may click another element to switch.
 * Fixed under the host's top bar (`--shell-top-bar-h`, or `top`) with its own scroll, so every control stays reachable
 * on a short screen. While closed it is `inert`.
 */
export function SlidePanel({
  open,
  title,
  onClose,
  openKey,
  top = 'var(--shell-top-bar-h,0px)',
  defaultWidth = 420,
  widthKey = 'pml.panel.width',
  children,
}: {
  open: boolean;
  /** What is shown, e.g. "Heading", "Layers", "Details". */
  title: string;
  onClose: () => void;
  /** Changes on every request to open, so a request made just after a dismiss shows it again. */
  openKey?: number;
  /** Where the panel starts from the top of the window (under the host's bar). */
  top?: string;
  /** Its width until the person drags it (an element's options are wider than a list). */
  defaultWidth?: number;
  /** Where the person's own width is remembered on this device; panels of one kind share it. */
  widthKey?: string;
  children: ReactNode;
}): React.JSX.Element {
  const panel = useRef<HTMLElement>(null);
  // The person's width per kind of panel: dragged by the left edge, remembered on this device, never wider than the
  // window. The panel still floats over the canvas (owner: the design never narrows).
  const [dragged, setDragged] = useState<Record<string, number>>({});
  const width = clampWidth(dragged[widthKey] ?? rememberedWidth(widthKey) ?? defaultWidth);
  const setWidth = (next: number, keep: boolean) => {
    const clamped = clampWidth(next);
    setDragged((all) => ({ ...all, [widthKey]: clamped }));
    if (keep) rememberWidth(widthKey, clamped);
  };
  // Dismissed here first so the panel starts sliding out at once; the editor is told as a transition.
  const [dismissed, setDismissed] = useState(false);
  const [seenKey, setSeenKey] = useState(openKey);

  if (!open && dismissed) setDismissed(false);

  if (openKey !== seenKey) {
    setSeenKey(openKey);
    if (dismissed) setDismissed(false);
  }

  const shown = open && !dismissed;
  const dismiss = useCallback(() => {
    setDismissed(true);
    startTransition(onClose);
  }, [onClose]);

  useDismissOnOutside(panel, shown, dismiss);

  useEffect(() => {
    if (!shown) return undefined;

    const onKey = (event: KeyboardEvent) => {
      // A dialog or menu the panel opened handles its own Escape first.
      if (event.key === 'Escape' && !event.defaultPrevented && !document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) dismiss();
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [shown, dismiss]);

  return (
    <aside
      ref={panel}
      aria-label={title}
      aria-hidden={!shown}
      inert={!shown}
      data-builder-panel=""
      style={{ top, width: `min(${width}px, 100vw)` }}
      className={`fixed bottom-0 right-0 z-40 flex flex-col border-l border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-text)] shadow-[-12px_0_40px_rgb(15,23,42,0.12)] transition-transform duration-200 ease-out motion-reduce:transition-none ${
        shown ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Drag the left edge to resize; arrow keys do the same. Inline styles, so a host need not generate new classes. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the panel"
        aria-valuemin={PANEL_MIN_WIDTH}
        aria-valuemax={PANEL_MAX_WIDTH}
        aria-valuenow={Math.round(width)}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) setWidth(window.innerWidth - event.clientX, false);
        }}
        onPointerUp={(event) => {
          if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) return;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
          setWidth(window.innerWidth - event.clientX, true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            setWidth(width + (event.key === 'ArrowLeft' ? 24 : -24), true);
          }
        }}
        style={{ position: 'absolute', top: 0, bottom: 0, left: -4, width: 8, cursor: 'ew-resize', zIndex: 1, outline: 'none' }}
      />
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--pb-border)] px-5 py-3">
        <h2 className="truncate text-sm font-semibold">{title}</h2>
        <button type="button" onClick={dismiss} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--pb-muted)] outline-none hover:bg-black/5">
          <X aria-hidden="true" className="h-3.5 w-3.5" />
          Done
        </button>
      </div>

      {/* The bottom padding lets the last rows scroll clear of a host's floating buttons. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5 pb-28">{children}</div>
    </aside>
  );
}
