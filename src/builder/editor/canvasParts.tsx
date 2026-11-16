'use client';

import React, { memo } from 'react';
import { MessageSquare, Sparkles } from 'lucide-react';

import type { pageOutline, PmlNativesPayload, PmlNode } from '../../language';
import { PmlRenderer, type PmlSite } from '../../renderer/PmlRenderer';
import { useOwnVars } from '../ui/theme';
import { useBuilderHost } from './host';

/**
 * One section's rendering, memoised: while the assistant builds a page, a section that is finished keeps the same
 * compiled object, so it is never redrawn as the next one lands (true incremental rendering). It draws through the
 * same renderer the public page uses, with the host's own elements (shared program E4a4e).
 */
export const SectionPreview = memo(function SectionPreview({
  preview,
  natives,
  site,
  mobile,
  outline,
  index,
}: {
  preview: PmlNode;
  natives: PmlNativesPayload | null;
  site: PmlSite;
  mobile: boolean;
  outline: ReturnType<typeof pageOutline>;
  /** The section's position when its elements are selectable one by one; null otherwise. */
  index: number | null;
}): React.JSX.Element {
  const { renderer } = useBuilderHost();

  return (
    <PmlRenderer
      nodes={[preview]}
      natives={natives}
      site={site}
      host={renderer}
      forceMobile={mobile}
      outline={outline}
      builderHints
      pathRoot={index === null ? undefined : [index]}
    />
  );
});

/**
 * Where the assistant is writing the next section: a flashing placeholder, so the page visibly grows into place. Calm
 * under reduced motion. The tints are `color-mix` values, never an opacity on a var() colour (Tailwind 3 drops that).
 */
export function SectionSkeleton({ label }: { label: string | null }): React.JSX.Element {
  const vars = useOwnVars();

  return (
    <div aria-hidden="true" className="px-6 py-8 sm:px-10" style={vars}>
      <div className="rounded-2xl border border-dashed border-[color-mix(in_srgb,var(--pb-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--pb-accent)_3%,transparent)] p-6 motion-safe:animate-pulse">
        <div className="mb-5 flex items-center gap-2 text-xs font-semibold text-[var(--pb-accent)]">
          <Sparkles className="h-3.5 w-3.5" />
          {label ? `Writing ${label}...` : 'Writing the next section...'}
        </div>
        <div className="h-6 w-2/3 rounded-full bg-slate-300/60" />
        <div className="mt-4 h-3 w-full rounded-full bg-slate-200/80" />
        <div className="mt-2 h-3 w-11/12 rounded-full bg-slate-200/80" />
        <div className="mt-2 h-3 w-3/4 rounded-full bg-slate-200/80" />
      </div>
    </div>
  );
}

/**
 * A first-class comment shown as an inert note strip. It never renders on the public page (the compiler drops it),
 * but here it stays visible and selectable so an author can see, move, or delete a note written in the Code view
 * without losing it (the stored tree keeps it, so it round-trips).
 */
export function CommentStrip({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="flex items-center gap-2 px-6 py-3 text-sm italic opacity-55">
      <MessageSquare className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{text.trim() || 'Comment'}</span>
    </div>
  );
}

export function FrameButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-black/10 bg-white/90 p-1 shadow-sm outline-none backdrop-blur hover:bg-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}
