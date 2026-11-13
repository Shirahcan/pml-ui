'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * The trusted motion runtime (PML spec section 7). Each `motion` token is a CLOSED effect
 * implemented here in JS/CSS; no user timing, easing, or code ever runs. The compiler validated
 * the token against a fixed enum, so this is a lookup, never `eval`.
 *
 * Safety: every effect honours `prefers-reduced-motion` (it degrades to the final, static state)
 * and never touches layout or contrast - a grid still stacks, text stays legible. The reveal
 * family animates in on scroll via one IntersectionObserver; hover-lift and sticky are pure CSS.
 */

const REVEAL_MOTIONS = new Set(['reveal-up', 'reveal-in', 'stagger', 'parallax-soft', 'count-up']);

/** A reveal-family effect animates in on scroll; hover-lift and sticky do not. */
export function isRevealMotion(motion: string): boolean {
  return REVEAL_MOTIONS.has(motion);
}

/**
 * Whether the element should start already visible (no scroll-in animation): true under
 * reduced-motion (the whole point - no movement), or for a non-reveal effect that has no
 * hidden start state (hover-lift, sticky, none).
 */
export function initialRevealed(motion: string, reduced: boolean): boolean {
  return reduced || !isRevealMotion(motion);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function PmlMotion({
  motion,
  children,
}: {
  motion: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement | null>(null);
  const [reduced, setReduced] = useState(false);
  // Server + first client render: reveal effects start hidden (revealed=false) so there is no
  // flash of the final state before the observer fires. Non-reveal effects start revealed.
  const [revealed, setRevealed] = useState(() => !REVEAL_MOTIONS.has(motion));

  useEffect(() => {
    const rm = prefersReducedMotion();
    setReduced(rm);

    if (initialRevealed(motion, rm)) {
      setRevealed(true);

      return;
    }

    const node = ref.current;

    if (!node || typeof IntersectionObserver === 'undefined') {
      setRevealed(true); // no observer available: show it rather than hide it forever

      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.15 },
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [motion]);

  return (
    <div
      ref={ref}
      className="pml-motion"
      data-motion={motion}
      data-revealed={revealed ? 'true' : 'false'}
      data-reduced={reduced ? 'true' : 'false'}
    >
      {children}
    </div>
  );
}

/**
 * The effect stylesheet, injected ONCE at the top of the render tree (see PmlRenderer). Plain
 * authored CSS (never user input), keyed off the data-attributes PmlMotion sets. Kept here so the
 * runtime and its styles live together. Reduced-motion forces the static final state for every
 * effect, including disabling the hover lift.
 */
export const MOTION_CSS = `
.pml-motion { display: block; }
.pml-motion[data-motion="reveal-up"],
.pml-motion[data-motion="stagger"] {
  opacity: 0; transform: translateY(16px);
  transition: opacity 600ms ease, transform 600ms ease;
}
.pml-motion[data-motion="reveal-in"],
.pml-motion[data-motion="parallax-soft"],
.pml-motion[data-motion="count-up"] {
  opacity: 0; transition: opacity 700ms ease;
}
.pml-motion[data-revealed="true"] { opacity: 1; transform: none; }
.pml-motion[data-motion="hover-lift"] { transition: transform 200ms ease, box-shadow 200ms ease; }
.pml-motion[data-motion="hover-lift"]:hover { transform: translateY(-4px); box-shadow: 0 12px 30px rgba(0,0,0,0.12); }
.pml-motion[data-motion="sticky"] { position: sticky; top: 1rem; z-index: 10; }
.pml-motion[data-reduced="true"] { opacity: 1 !important; transform: none !important; transition: none !important; }
@media (prefers-reduced-motion: reduce) {
  .pml-motion { opacity: 1 !important; transform: none !important; transition: none !important; }
}
`;

/**
 * Hoisted to module scope so the object reference is STABLE across renders.
 * React 19 only short-circuits `dangerouslySetInnerHTML` on reference equality, then
 * writes `innerHTML` with no string comparison - so an inline literal re-parses this
 * stylesheet on every render, forcing a needless style recalculation (and restarting
 * any keyframes it declares). See components/shared/StaticHtml.tsx.
 */
const MOTION_CSS_MARKUP = { __html: MOTION_CSS };

/** Renders the effect stylesheet once. Duplicate tags (canvas + proposal) are harmless. */
export function MotionStyles(): React.JSX.Element {
  return <style data-pml-motion="" dangerouslySetInnerHTML={MOTION_CSS_MARKUP} />;
}
