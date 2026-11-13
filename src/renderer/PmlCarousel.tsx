'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const GAP_PX: Record<string, number> = { none: 0, xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

/** Seconds between steps (`carousel_motion=step`), by `carousel_speed`. The runtime owns timing. */
const STEP_SECONDS: Record<string, number> = { slow: 8, normal: 5, fast: 3 };

/** A marquee's pace multiplier (`carousel_motion=scroll`), by `carousel_speed`. */
const SCROLL_PACE: Record<string, number> = { slow: 1.6, normal: 1, fast: 0.6 };

/** A visitor who asked their device for less motion gets none: no marquee, no timed steps. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener?.('change', sync);

    return () => query.removeEventListener?.('change', sync);
  }, []);

  return reduced;
}

/**
 * A press on a carousel's own controls moves the carousel and nothing else: in the builder canvas a
 * bubbling click selects the element under it, so the arrows would have moved it and then selected it.
 */
function own(event: React.MouseEvent): void {
  event.stopPropagation();
  event.preventDefault();
}

export interface PmlCarouselProps {
  /** Slides in view on a desktop (`carousel_per_view`, or its `lg:` value). */
  perView: number;
  /** Slides in view on a tablet (`md:carousel_per_view`); the desktop count when unset. */
  perViewMd?: number;
  gap?: string;
  label?: string;
  /** `carousel_motion`: none (the visitor moves it) or step (one view every few seconds). */
  motion?: string;
  speed?: string;
  /** `carousel_controls`: arrows (default), dots, both or none. */
  controls?: string;
  /** `carousel_loop`: on (default) goes back to the start after the last view; off stops there. */
  loop?: boolean;
  children: React.ReactNode;
}

/**
 * A box drawn as a carousel (PML style `display=carousel`, 2026-11-08): every slide kept, a set number in
 * view (one on phones), equal widths, moved by its arrows or dots or by swiping. Owner: "Porter should be
 * able to identify carousels on websites and not render them as a grid of items", and carousels "should
 * animate on previews - even left/right buttons should move them inside the studio".
 *
 * A scroll-snap track, so it works with a finger, a trackpad and the keyboard (the track is focusable and
 * scrolls with the arrow keys). Timed steps pause while the pointer or focus is on it and never run for a
 * visitor who asked for reduced motion.
 */
export function PmlCarousel({ perView, perViewMd, gap, label, motion = 'none', speed = 'normal', controls = 'arrows', loop = true, children }: PmlCarouselProps): React.JSX.Element {
  const track = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(false);
  const [page, setPage] = useState(0);
  const reduced = useReducedMotion();
  const slides = React.Children.toArray(children).filter(Boolean);
  const space = GAP_PX[gap ?? 'md'] ?? 16;
  const width = (n: number) => `calc((100% - ${(n - 1) * space}px) / ${n})`;
  const pages = Math.max(1, Math.ceil(slides.length / perView));

  const go = useCallback((target: number) => {
    const el = track.current;
    if (!el) return;
    const count = Math.max(1, Math.ceil(el.scrollWidth / Math.max(1, el.clientWidth)));
    const next = loop ? (target + count) % count : Math.min(Math.max(target, 0), count - 1);
    el.scrollTo?.({ left: next * el.clientWidth, behavior: 'smooth' });
    setPage(next);
  }, [loop]);

  const move = useCallback((direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const current = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    go(current + direction);
  }, [go]);

  // The dots follow a swipe or a keyboard scroll too.
  const onScroll = () => {
    const el = track.current;
    if (el && el.clientWidth > 0) setPage(Math.round(el.scrollLeft / el.clientWidth));
  };

  const stepping = motion === 'step' && !reduced && !held && slides.length > perView;

  useEffect(() => {
    if (!stepping) return undefined;
    const timer = window.setInterval(() => move(1), (STEP_SECONDS[speed] ?? 5) * 1000);

    return () => window.clearInterval(timer);
  }, [stepping, move, speed]);

  const showArrows = (controls === 'arrows' || controls === 'both') && slides.length > perView;
  const showDots = (controls === 'dots' || controls === 'both') && pages > 1;

  return (
    <div
      className="relative w-full"
      role="region"
      aria-roledescription="carousel"
      aria-label={label ?? 'Carousel'}
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <div
        ref={track}
        tabIndex={0}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ gap: `${space}px` }}
      >
        {slides.map((slide, index) => (
          <div
            key={index}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}`}
            className="w-[85%] shrink-0 snap-start sm:w-[var(--pml-slide-md)] lg:w-[var(--pml-slide)]"
            style={{ ['--pml-slide' as string]: width(perView), ['--pml-slide-md' as string]: width(perViewMd ?? perView) }}
          >
            {slide}
          </div>
        ))}
      </div>
      {showArrows || showDots ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {showDots
              ? Array.from({ length: pages }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Go to ${index + 1} of ${pages}`}
                    aria-current={page === index ? 'true' : undefined}
                    onClick={(event) => { own(event); go(index); }}
                    className={`h-2 rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-current ${page === index ? 'w-5 bg-current' : 'w-2 bg-current/30'}`}
                  />
                ))
              : null}
          </div>
          {showArrows ? (
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Previous"
                disabled={!loop && page === 0}
                onClick={(event) => { own(event); move(-1); }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-current/25 outline-none hover:bg-current/10 focus-visible:ring-2 focus-visible:ring-current disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Next"
                disabled={!loop && page >= pages - 1}
                onClick={(event) => { own(event); move(1); }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-current/25 outline-none hover:bg-current/10 focus-visible:ring-2 focus-visible:ring-current disabled:opacity-40"
              >
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A row that moves on its own, endlessly (PML `display=carousel carousel-motion=scroll`, 2026-11-08), like a
 * logo track: the items are drawn twice (the copy hidden from screen readers) and slide left in a loop,
 * pausing while the pointer is on them. For reduced motion it is a still, centred, wrapping row.
 */
export function PmlMarquee({ gap, label, speed = 'normal', children }: { gap?: string; label?: string; speed?: string; children: React.ReactNode }): React.JSX.Element {
  const reduced = useReducedMotion();
  const items = React.Children.toArray(children).filter(Boolean);
  const space = GAP_PX[gap ?? 'xl'] ?? 32;

  if (reduced) {
    return (
      <div className="flex flex-wrap items-center justify-center" style={{ gap: `${space}px` }} aria-label={label}>
        {items}
      </div>
    );
  }

  const seconds = Math.round(Math.max(12, items.length * 4) * (SCROLL_PACE[speed] ?? 1));

  return (
    <div className="group relative w-full overflow-hidden" aria-label={label} role="region" aria-roledescription="moving row">
      <style>{'@keyframes pml-marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}'}</style>
      <div
        className="flex w-max items-center group-hover:[animation-play-state:paused]"
        style={{ gap: `${space}px`, paddingRight: `${space}px`, animation: `pml-marquee ${seconds}s linear infinite` }}
      >
        {items}
        <div aria-hidden="true" className="contents">
          {items.map((item, index) => (
            <React.Fragment key={`copy-${index}`}>{item}</React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
