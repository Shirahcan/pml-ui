'use client';

import React from 'react';
import { MousePointerClick } from 'lucide-react';

import { EMPTY_BLOCK } from './PmlPostFlavor';

/**
 * A call to action from the product's CTA library (post layouts C2d). The words are a library row baked into
 * `props.resolved` by pml-kit for this part's stage and variant, so editing the row once changes every post after
 * its next preview or publish. A subscribe action draws the page's own growth form (the host's, with its consent
 * box) instead of a button: the package never collects an address itself.
 *
 * Unset is never silent: the builder says no call to action is set for this stage; the public page draws nothing.
 */

interface Action {
  label?: string;
  href?: string | null;
  kind?: string;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const action = (value: unknown): Action => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Action) : {});

const STAGE_WORDS: Record<string, string> = { awareness: 'awareness', consideration: 'consideration', decision: 'decision' };

/**
 * The block's own button corners (0.7.89, owner 2026-11-23: blog buttons "obey the theme but they should also be able to
 * be modified in the studio"): set as `--site-button-radius` on the block, so its buttons (and a subscribe form's) take
 * it. Unset or `theme` sets nothing: Website > Theme > Corners decides, exactly as before. Square is the theme's own
 * Square button (4px), so "Square" reads the same wherever it is chosen.
 */
export const CTA_BUTTON_RADIUS: Record<string, string> = { pill: '9999px', rounded: '12px', square: '4px' };

export function PmlPostCta({
  props,
  className,
  style,
  inCanvas,
  subscribeForm,
}: {
  props: Record<string, unknown>;
  className: string;
  style: React.CSSProperties;
  inCanvas: boolean;
  /** The page's own growth form (the host's), drawn for a subscribe action. */
  subscribeForm: React.ReactNode;
}): React.JSX.Element | null {
  const row = props.resolved && typeof props.resolved === 'object' ? (props.resolved as Record<string, unknown>) : {};
  const stage = STAGE_WORDS[str(props.stage)] ?? 'awareness';
  const banner = str(props.variant) === 'banner';
  const headline = str(row.headline);

  if (!headline) {
    return inCanvas ? (
      <aside className={className} style={style}>
        {/* The one empty marker every empty piece wears (owner 2026-11-17), so an empty CTA reads as "to fill" like them. */}
        <div className="text-center text-sm" style={{ ...EMPTY_BLOCK, padding: '20px 16px', color: '#475569' }}>
          <MousePointerClick className="mx-auto mb-2 h-6 w-6 text-[#625FFB]" aria-hidden />
          No call to action is set for the {stage} stage yet. Add one in Calls to action, and it shows here.
        </div>
      </aside>
    ) : null;
  }

  const main = action(row.button);
  const second = action(row.secondary);
  const subscribe = main.kind === 'subscribe';
  // A sign-up box centres its words over a form of a reasonable width (owner 2026-11-18: "the free updates section
  // should center its content and use a reasonable input field width"), as a banner centres its own.
  const centred = banner || subscribe;
  const decision = stage === 'decision';
  const accent = decision ? '' : 'border-t-[var(--site-accent)]';
  // The decision stage wears the site's EMPHASIS colour (Website > Theme, --site-strong: the reference studio's navy),
  // with its readable text colour; unset, it falls back to the site's text colour as before. Inline, so the host's CSS
  // build never has to know these values.
  const strongEdge: React.CSSProperties | undefined = decision ? { borderTopColor: 'var(--site-strong, var(--site-text, currentColor))' } : undefined;
  const strongButton: React.CSSProperties | undefined = decision
    ? { background: 'var(--site-strong, var(--site-text))', color: 'var(--site-on-strong, var(--site-surface, #fff))' }
    : undefined;

  const corners = CTA_BUTTON_RADIUS[str(props.button_corners)];
  const buttonShape = corners ? ({ '--site-button-radius': corners } as React.CSSProperties) : undefined;

  return (
    <aside
      aria-label={headline}
      className={`rounded-[var(--site-radius)] border border-current/15 border-t-4 ${accent} p-6 ${centred ? 'text-center' : ''} ${className}`.replace(/\s+/g, ' ').trim()}
      style={{ ...strongEdge, ...buttonShape, ...style }}
    >
      {str(row.eyebrow) ? <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--site-accent)]">{str(row.eyebrow)}</p> : null}
      <p className={`mt-1 font-extrabold leading-snug ${banner ? 'text-2xl md:text-3xl' : 'text-xl'}`}>{headline}</p>
      {str(row.body) ? <p className={`mt-2 opacity-75 ${centred ? 'mx-auto max-w-[52ch]' : ''}`}>{str(row.body)}</p> : null}
      {subscribe ? (
        <div className="mx-auto mt-4 w-full max-w-md text-left">{subscribeForm}</div>
      ) : (
        <div className={`mt-4 flex flex-wrap gap-3 ${banner ? 'justify-center' : ''}`}>
          {str(main.label) && str(main.href) ? (
            <a
              href={str(main.href)}
              // Buttons wear the site's BUTTON shape (--site-button-radius, a pill unless the site says otherwise), as the
              // standard button does; the card radius made them squared tabs (owner 2026-11-18: "Portify uses pills globally").
              className={`inline-flex items-center whitespace-nowrap rounded-[var(--site-button-radius,9999px)] px-5 py-2.5 font-semibold ${decision ? '' : 'bg-[var(--site-accent)] text-white'}`.trim()}
              style={strongButton}
            >
              {str(main.label)}
            </a>
          ) : null}
          {str(second.label) && str(second.href) ? (
            <a href={str(second.href)} className="inline-flex items-center whitespace-nowrap rounded-[var(--site-button-radius,9999px)] border border-[var(--site-accent)] px-5 py-2.5 font-semibold text-[var(--site-accent)]">
              {str(second.label)}
            </a>
          ) : null}
        </div>
      )}
    </aside>
  );
}
