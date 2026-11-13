import React from 'react';

import { assertSafeUrl } from '../security/assertSafeUrl';
import { toText } from '../pml/expressions';

/**
 * The block elements of PML v3 L5, drawn with their real tags: a code block, a quote block, a native
 * disclosure (opens with no script, and with scripts off), a definition list and a figure. Theme colours
 * come through the site's CSS variables. Words inside a summary, a term or a caption are drawn by the
 * renderer as phrasing content (see PmlInline).
 */

/** Every element this file draws. */
export const BLOCK_ELEMENTS = ['pre', 'blockquote', 'details', 'summary', 'definitions', 'term', 'definition', 'figure', 'caption'] as const;

/** The parts that hold words (their children are text runs and inline elements). */
export const WORD_PARTS = ['summary', 'term', 'caption'];

/**
 * A part the browser only recognises as a DIRECT child (a `<summary>` in `<details>`, a `<figcaption>` in
 * `<figure>`): in the builder it carries its own path mark instead of being wrapped, like a table row.
 */
export const SELF_MARKED_PARTS = ['summary', 'caption'];

export function isBlockElement(primitive: string | undefined): boolean {
  return primitive !== undefined && (BLOCK_ELEMENTS as readonly string[]).includes(primitive);
}

interface Look {
  className: string;
  style?: React.CSSProperties;
  /** The element's #anchor, already checked. */
  id?: string;
  /** The builder's own path mark, for a self-marked part. */
  mark?: Record<string, string>;
}

/** One block element with its already-drawn children. */
export function renderBlock(primitive: string, props: Record<string, unknown>, kids: React.ReactNode, look: Look): React.JSX.Element | null {
  const cls = (base: string) => `${base} ${look.className}`.replace(/\s+/g, ' ').trim();

  switch (primitive) {
    case 'pre': {
      // Escaped text in <pre><code>, scrolling sideways on its own so a long line never widens the page.
      // The language is a label for the reader; nothing is executed or highlighted.
      const language = toText(props.language);

      // A plain wrapper, never a <figure>: a code block often sits INSIDE a figure, whose own caption must
      // be the only <figcaption> there.
      return (
        <div id={look.id} className={cls('scroll-mt-24')} style={look.style}>
          {language ? <div className="mb-1 text-xs font-medium opacity-60">{language}</div> : null}
          <pre className="max-w-full overflow-x-auto rounded-[var(--site-radius,12px)] bg-slate-950 p-4 text-sm leading-relaxed text-slate-100">
            <code className={language ? `language-${language}` : undefined}>{toText(props.text)}</code>
          </pre>
        </div>
      );
    }

    case 'blockquote': {
      const cite = toText(props.cite);

      return (
        <blockquote id={look.id} cite={cite ? assertSafeUrl(cite) : undefined} className={cls('scroll-mt-24 space-y-2 border-l-2 border-[var(--site-accent)] pl-4 italic')} style={look.style}>
          {kids}
        </blockquote>
      );
    }

    case 'details':
      return (
        <details id={look.id} open={props.open === true || undefined} className={cls('group scroll-mt-24 space-y-3 rounded-[var(--site-radius,12px)] border border-current/15 p-4')} style={look.style}>
          {kids}
        </details>
      );

    case 'summary':
      return (
        <summary {...look.mark} className={cls('cursor-pointer font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[var(--site-accent)]')} style={look.style}>
          {kids}
        </summary>
      );

    case 'definitions':
      return (
        <dl id={look.id} className={cls('grid scroll-mt-24 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]')} style={look.style}>
          {kids}
        </dl>
      );

    case 'term':
      return (
        <dt className={cls('font-semibold')} style={look.style}>
          {kids}
        </dt>
      );

    case 'definition':
      return (
        <dd className={cls('space-y-2 opacity-90')} style={look.style}>
          {kids}
        </dd>
      );

    case 'figure':
      return (
        <figure id={look.id} className={cls('scroll-mt-24 space-y-2')} style={look.style}>
          {kids}
        </figure>
      );

    case 'caption':
      return (
        <figcaption {...look.mark} className={cls('text-sm opacity-70')} style={look.style}>
          {kids}
        </figcaption>
      );

    default:
      return null;
  }
}
