'use client';

import React from 'react';

/**
 * The blog READING look (owner 2026-11-17, the reference studio's post column): a renderer given `flavor="post"` draws
 * a few shared primitives the way the reference does. Pages and emails never get it: `table`, `callout`, `faq` and the
 * level-2 heading are shared by every site, so the look is opt-in per render, never a global restyle.
 *
 * The values are the reference's own stylesheet; a product can restyle through the same --post-* custom properties
 * the post pieces read.
 */

export const POST = {
  indigo: 'var(--post-indigo, #6467F2)',
  deep: 'var(--post-accent, #4F46E5)',
  line: 'var(--post-line, #E2E8F0)',
  slate: 'var(--post-slate, #475569)',
  ink: 'var(--post-ink, #0F172A)',
} as const;

/** True inside a renderer drawing a post (and every renderer nested in it). */
export const PostFlavorContext = React.createContext<boolean>(false);

/** `.post h2`: the question headings. */
export const POST_H2: React.CSSProperties = { fontSize: 26, lineHeight: 1.22, fontWeight: 800, letterSpacing: '-.02em', margin: '0 0 12px' };

/** `.tbl`: the card a table sits in, scrolling sideways on its own when it is wide. */
export const POST_TABLE_CARD: React.CSSProperties = { overflowX: 'auto', border: `1px solid ${POST.line}`, borderRadius: 8 };
export const POST_TABLE: React.CSSProperties = { borderCollapse: 'collapse', width: '100%', fontSize: 14 };
export const POST_CAPTION: React.CSSProperties = { textAlign: 'left', fontWeight: 700, padding: '12px 14px 4px', fontSize: 14.5 };
export const POST_CELL: React.CSSProperties = { textAlign: 'left', padding: '9px 14px', borderBottom: `1px solid ${POST.line}`, verticalAlign: 'top' };
/** A header cell (`thead th`): the reference shades it and sets it a little smaller. */
export const POST_HEADER_CELL: React.CSSProperties = { ...POST_CELL, background: '#F8FAFC', fontSize: 12.5 };

/** `.ans`: a callout with no tone is the post's short answer, its title the small uppercase key above the words. */
export function PostAnswer({
  id,
  title,
  className,
  style,
  children,
}: {
  id?: string;
  title: string;
  className: string;
  style: React.CSSProperties;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <aside
      role="note"
      id={id}
      aria-label={title || 'Short answer'}
      className={className}
      style={{ borderLeft: `4px solid ${POST.indigo}`, boxShadow: `inset 0 0 0 1px ${POST.line}`, borderRadius: 8, padding: '12px 16px', margin: '0 0 14px', ...style }}
    >
      {title ? <span style={{ display: 'block', fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: POST.deep, fontWeight: 700 }}>{title}</span> : null}
      {children}
    </aside>
  );
}

/**
 * `.faq`: one question and its answer under a rule. On the canvas it is always open, as the reference draws it, so the
 * answer can be read and selected; a reader gets the same look as a native <details> that opens with JS off.
 */
export function PostFaqItem({
  question,
  inCanvas,
  questionStyle,
  children,
}: {
  question: string;
  inCanvas: boolean;
  /** The question's own look on top of the reference's (a template's example reads grey on the canvas). */
  questionStyle?: React.CSSProperties;
  children: React.ReactNode;
}): React.JSX.Element {
  const box: React.CSSProperties = { borderBottom: `1px solid ${POST.line}`, padding: '10px 0' };
  const q: React.CSSProperties = { fontWeight: 700, fontSize: 17, ...questionStyle };
  const a: React.CSSProperties = { color: POST.ink, marginTop: 4 };

  if (inCanvas) {
    return (
      <div style={box}>
        <div style={q}>{question}</div>
        <div style={a}>{children}</div>
      </div>
    );
  }

  return (
    <details style={box}>
      <summary className="cursor-pointer list-none outline-none [&::-webkit-details-marker]:hidden" style={q}>
        {question}
      </summary>
      <div style={a}>{children}</div>
    </details>
  );
}

/**
 * The ONE canvas marker for something still empty (owner 2026-11-17: "Sections that are initialized empty ... should
 * use appropriate markers (e.g. borders or bg) to make them easily identifiable"): a dashed accent border, a light
 * accent tint, its placeholder words inside. Only ever drawn on the canvas; a reader never sees an empty piece.
 */
export const EMPTY_MARK: React.CSSProperties = {
  border: '1.5px dashed color-mix(in srgb, #625FFB 45%, transparent)',
  background: '#EEEEFF',
  borderRadius: 10,
};

/** The marker as a block with room for its words. */
export const EMPTY_BLOCK: React.CSSProperties = { ...EMPTY_MARK, padding: '8px 12px' };
