import React from 'react';

import { assertSafeUrl } from '../security/assertSafeUrl';
import { toText } from '../pml/expressions';

/**
 * Words inside a paragraph (PML v3 L4): `<p>Book a call with <strong>{owner.name}</strong> today.</p>`.
 * A paragraph and its inline elements hold text runs and inline elements only, so everything drawn
 * under one is phrasing content. The renderer marks that with this context, and anything that would
 * otherwise wrap a child in a <div> (the builder's path marker, an event wrapper) uses a <span>: a
 * <div> inside a <p> is invalid HTML, and the browser would close the paragraph early.
 */
export const InlineContext = React.createContext<boolean>(false);

/** The tag each inline element draws, and its look (theme colours via CSS variables). */
const INLINE: Record<string, { tag: keyof React.JSX.IntrinsicElements; className: string }> = {
  span: { tag: 'span', className: '' },
  strong: { tag: 'strong', className: 'font-semibold' },
  emphasis: { tag: 'em', className: 'italic' },
  small: { tag: 'small', className: 'text-[0.85em]' },
  mark: { tag: 'mark', className: 'rounded-sm bg-[color-mix(in_srgb,var(--site-accent)_22%,transparent)] px-0.5 text-inherit' },
  quote: { tag: 'q', className: 'italic' },
  keyboard: { tag: 'kbd', className: 'rounded border border-current/25 px-1 py-px font-mono text-[0.85em]' },
  sub: { tag: 'sub', className: '' },
  sup: { tag: 'sup', className: '' },
  abbr: { tag: 'abbr', className: 'cursor-help underline decoration-dotted underline-offset-2' },
  time: { tag: 'time', className: '' },
};

/** The inline elements a paragraph can hold (besides `link`, `code` and `br`, drawn on their own). */
export const INLINE_ELEMENTS = Object.keys(INLINE);

/** True for every element that sits inside a paragraph. */
export function isInlinePrimitive(primitive: string | undefined): boolean {
  return primitive !== undefined && (primitive in INLINE || primitive === 'link' || primitive === 'code' || primitive === 'br');
}

/**
 * One inline element with its already-drawn children. `className` / `style` are the element's own
 * look (resolved by the renderer from its style tokens).
 */
export function renderInline(
  primitive: string,
  props: Record<string, unknown>,
  kids: React.ReactNode,
  look: { className: string; style?: React.CSSProperties },
): React.JSX.Element | null {
  if (primitive === 'br') return <br />;

  if (primitive === 'code') {
    return (
      <code className={`rounded bg-[color-mix(in_srgb,currentColor_8%,transparent)] px-1 py-px font-mono text-[0.9em] ${look.className}`.trim()} style={look.style}>
        {toText(props.text)}
      </code>
    );
  }

  if (primitive === 'link') {
    const href = toText(props.href);

    // A link with nowhere to go is its words, never a dead <a>.
    if (!href) return <span className={look.className || undefined} style={look.style}>{kids}</span>;

    return (
      <a
        href={assertSafeUrl(href)}
        className={`text-[var(--site-accent)] underline underline-offset-2 outline-none hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)] ${look.className}`.trim()}
        style={look.style}
      >
        {kids}
      </a>
    );
  }

  const def = INLINE[primitive];

  if (!def) return null;

  const Tag = def.tag as React.ElementType;
  const own: Record<string, unknown> = {};

  if (primitive === 'abbr' && toText(props.title)) own.title = toText(props.title);
  if (primitive === 'time' && toText(props.datetime)) own.dateTime = toText(props.datetime);
  if (primitive === 'quote' && toText(props.cite)) own.cite = assertSafeUrl(toText(props.cite));

  return (
    <Tag className={`${def.className} ${look.className}`.trim() || undefined} style={look.style} {...own}>
      {kids}
    </Tag>
  );
}

/** A word run: its words, in a <span> only when it carries a look of its own. */
export function renderRun(value: unknown, look: { className: string; style?: React.CSSProperties }): React.JSX.Element | null {
  const words = toText(value);

  if (words === '') return null;
  // An unstyled element resolves to an empty style object: still no look of its own.
  if (!look.className.trim() && (!look.style || Object.keys(look.style).length === 0)) return <>{words}</>;

  return (
    <span className={look.className || undefined} style={look.style}>
      {words}
    </span>
  );
}
