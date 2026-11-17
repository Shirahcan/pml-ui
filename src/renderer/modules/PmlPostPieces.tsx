'use client';

import React from 'react';
import { BadgeCheck, FileText } from 'lucide-react';

import { postDate } from './PmlPostParts';

/**
 * The Classic template's post pieces (owner 2026-11-17, T1: "breadcrumbs element built automatically (and rendered);
 * title slot ... properly inserted; author, date, etc also slotted in"), one element each so a template places, moves
 * or drops them one by one: post_breadcrumbs, post_title, post_dek, post_meta's post_author / post_date /
 * post_read_time / post_reviewer, post_tags. Each draws the post's OWN details, baked into `props.resolved` by pml-kit
 * (as post_header's are), so the designer and the public page draw the same words from the same data.
 *
 * A piece with nothing to show draws nothing on the public page; on the canvas it says where its words come from, so
 * the author sees the slot instead of a gap. ⚠ "Reviewed by" is an attestation: pml-kit bakes a reviewer ONLY when that
 * person confirmed this version; this file draws whatever it is given and never decides that itself.
 */

type Props = Record<string, unknown>;

interface PieceProps {
  props: Props;
  className: string;
  style: React.CSSProperties;
  inCanvas: boolean;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

const resolved = (props: Props): Record<string, unknown> => record(props.resolved);

/** On the canvas: where the words come from. On the page: nothing. */
function Slot({ inCanvas, className, style, children }: { inCanvas: boolean; className: string; style: React.CSSProperties; children: React.ReactNode }): React.JSX.Element | null {
  if (!inCanvas) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded border border-dashed border-current/25 px-2 py-0.5 text-sm opacity-60 ${className}`.trim()} style={style}>
      <FileText className="h-3.5 w-3.5" aria-hidden />
      {children}
    </span>
  );
}

export function PmlPostBreadcrumbs({ props, className, style }: PieceProps): React.JSX.Element {
  const category = record(resolved(props).category);
  const blogUrl = str(resolved(props).blog_url) || str(category.blog_url) || '/blog';

  return (
    <nav aria-label="Breadcrumb" className={`text-sm opacity-70 ${className}`.trim()} style={style}>
      <a href="/" className="hover:underline">Home</a>
      <span aria-hidden> › </span>
      <a href={blogUrl} className="hover:underline">Blog</a>
      {str(category.name) ? (
        <>
          <span aria-hidden> › </span>
          {str(category.url) ? <a href={str(category.url)} className="hover:underline">{str(category.name)}</a> : <span>{str(category.name)}</span>}
        </>
      ) : null}
    </nav>
  );
}

export function PmlPostTitle({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const title = str(resolved(props).title);

  if (!title) return <Slot inCanvas={inCanvas} className={className} style={style}>The post&rsquo;s title</Slot>;

  return (
    <h1 className={`text-3xl font-extrabold leading-tight tracking-tight md:text-5xl ${className}`.trim()} style={style}>
      {title}
    </h1>
  );
}

export function PmlPostDek({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const dek = str(resolved(props).dek);

  if (!dek) return <Slot inCanvas={inCanvas} className={className} style={style}>The line under the title</Slot>;

  return (
    <p className={`max-w-[62ch] text-lg opacity-75 ${className}`.trim()} style={style}>
      {dek}
    </p>
  );
}

export function PmlPostAuthor({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const name = str(resolved(props).author_name);

  if (!name) return <Slot inCanvas={inCanvas} className={className} style={style}>The author</Slot>;

  return (
    <span className={className} style={style}>
      By {name}
    </span>
  );
}

export function PmlPostDate({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const updated = str(props.kind) === 'updated';
  const when = postDate(updated ? resolved(props).updated_at : resolved(props).published_at);

  if (!when) return <Slot inCanvas={inCanvas} className={className} style={style}>{updated ? 'When it was last updated' : 'When it was published'}</Slot>;

  return (
    <span className={className} style={style}>
      {updated ? 'Updated' : 'Published'} {when}
    </span>
  );
}

export function PmlPostReadTime({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const minutes = resolved(props).read_minutes;

  if (typeof minutes !== 'number' || minutes <= 0) return <Slot inCanvas={inCanvas} className={className} style={style}>How long it takes to read</Slot>;

  return (
    <span className={className} style={style}>
      {minutes} min read
    </span>
  );
}

const BADGE = 'inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--site-accent)_12%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--site-accent)]';

export function PmlPostReviewer({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const reviewer = record(resolved(props).reviewer);

  // Only a reviewer who confirmed this version is baked in; nothing else may claim a review.
  if (!str(reviewer.name)) return <Slot inCanvas={inCanvas} className={className} style={style}>Reviewed by (once a reviewer confirms this version)</Slot>;

  return (
    <span className={`${BADGE} ${className}`.trim()} style={style}>
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
      Reviewed by {str(reviewer.name)}
      {str(reviewer.licence) ? `, RCIC ${str(reviewer.licence)}` : ''}
    </span>
  );
}

export function PmlPostTags({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const tags = Array.isArray(resolved(props).tags) ? (resolved(props).tags as unknown[]).filter((t): t is string => typeof t === 'string' && t !== '') : [];

  if (tags.length === 0) return <Slot inCanvas={inCanvas} className={className} style={style}>The post&rsquo;s tags</Slot>;

  return (
    <ul className={`flex flex-wrap gap-2 ${className}`.trim()} style={style} aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag} className="rounded-full border border-current/20 px-2.5 py-0.5 text-xs opacity-80">
          {tag}
        </li>
      ))}
    </ul>
  );
}
