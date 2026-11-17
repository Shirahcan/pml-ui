'use client';

import React from 'react';
import { BadgeCheck, FileText } from 'lucide-react';

import { PmlPostCover, postDate } from './PmlPostParts';

/**
 * The Classic template's post pieces (owner 2026-11-17, T1: "breadcrumbs element built automatically (and rendered);
 * title slot ... properly inserted; author, date, etc also slotted in"), one element each so a template places, moves
 * or drops them one by one. Each draws the post's OWN details, baked into `props.resolved` by pml-kit, so the designer
 * and the public page draw the same words from the same data.
 *
 * The header pieces draw EXACTLY the reference studio's header (owner 2026-11-17: "The generated empty post still isn't
 * mirroring the artifact! ... this must be gotten right!"): breadcrumbs, the category pill, the 38px title, the dek, a
 * byline whose values are bold, and the trust badges. Sizes and colours are the reference's; a product restyles them
 * through the --post-* custom properties, never by forking a piece.
 *
 * An empty piece draws NOTHING on the public page. On the canvas it shows the reference's placeholder in grey, in the
 * piece's own shape, so the author sees the empty field where it will be. ⚠ "Reviewed by" is an attestation: pml-kit
 * bakes a reviewer ONLY when that person confirmed this version; this file draws whatever it is given and never
 * decides that itself.
 */

type Props = Record<string, unknown>;

interface PieceProps {
  props: Props;
  className: string;
  style: React.CSSProperties;
  inCanvas: boolean;
}

/** The reference's tokens; a product overrides them with the matching custom property. */
const INK = 'var(--post-ink, #0F172A)';
const SLATE = 'var(--post-slate, #475569)';
const ACCENT = 'var(--post-accent, #4F46E5)';
const ACCENT_SOFT = 'var(--post-accent-soft, #EEF0FF)';
/** An empty field's words on the canvas. */
const PLACEHOLDER = '#A0A8B8';

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

const resolved = (props: Props): Record<string, unknown> => record(props.resolved);

const cls = (...names: string[]): string => names.filter(Boolean).join(' ');

/** On the canvas: where the words come from. On the page: nothing. */
function Slot({ inCanvas, className, style, children }: { inCanvas: boolean; className: string; style: React.CSSProperties; children: React.ReactNode }): React.JSX.Element | null {
  if (!inCanvas) return null;

  return (
    <span className={cls('inline-flex items-center gap-1.5 rounded border border-dashed border-current/25 px-2 py-0.5 text-sm opacity-60', className)} style={style}>
      <FileText className="h-3.5 w-3.5" aria-hidden />
      {children}
    </span>
  );
}

/** A byline value: bold ink, or the grey placeholder on the canvas when there is none. */
function Value({ text, empty }: { text: string; empty: string }): React.JSX.Element {
  return text ? <b style={{ color: INK, fontWeight: 700 }}>{text}</b> : <b style={{ color: PLACEHOLDER, fontWeight: 700 }}>{empty}</b>;
}

const PILL: React.CSSProperties = { display: 'inline-block', fontSize: 12, fontWeight: 600, lineHeight: 1.5, borderRadius: 999, padding: '4px 11px', background: ACCENT_SOFT, color: ACCENT };

export function PmlPostBreadcrumbs({ props, className, style, inCanvas }: PieceProps): React.JSX.Element {
  const category = record(resolved(props).category);
  const homeUrl = str(resolved(props).home_url) || '/';
  const blogUrl = str(resolved(props).blog_url) || str(category.blog_url) || '/blog';
  const name = str(category.name);

  return (
    <nav aria-label="Breadcrumb" className={className} style={{ fontSize: 12.5, color: SLATE, ...style }}>
      <a href={homeUrl} className="hover:underline" style={{ color: 'inherit', textDecoration: 'none' }}>Home</a>
      <span aria-hidden> › </span>
      <a href={blogUrl} className="hover:underline" style={{ color: 'inherit', textDecoration: 'none' }}>Blog</a>
      {name ? (
        <>
          <span aria-hidden> › </span>
          {str(category.url) ? <a href={str(category.url)} className="hover:underline" style={{ color: 'inherit', textDecoration: 'none' }}>{name}</a> : <span>{name}</span>}
        </>
      ) : inCanvas ? (
        <>
          <span aria-hidden> › </span>
          <span style={{ color: PLACEHOLDER }}>Category</span>
        </>
      ) : null}
    </nav>
  );
}

/** The category pill above the title. */
export function PmlPostCategory({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const name = str(record(resolved(props).category).name);
  if (!name && !inCanvas) return null;

  return (
    <span
      className={className}
      style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: name ? ACCENT : PLACEHOLDER, background: ACCENT_SOFT, borderRadius: 5, padding: '3px 9px', margin: '8px 0 10px', ...style }}
    >
      {name || 'Category'}
    </span>
  );
}

export function PmlPostTitle({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const title = str(resolved(props).title);
  if (!title && !inCanvas) return null;

  return (
    <h1 className={className} style={{ fontSize: 38, lineHeight: 1.12, fontWeight: 800, letterSpacing: '-.025em', margin: '0 0 10px', color: title ? INK : PLACEHOLDER, textWrap: 'balance', ...style }}>
      {title || 'Add title'}
    </h1>
  );
}

export function PmlPostDek({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const dek = str(resolved(props).dek);
  if (!dek && !inCanvas) return null;

  return (
    <p className={className} style={{ fontSize: 18, lineHeight: 1.6, color: dek ? SLATE : PLACEHOLDER, margin: '0 0 12px', ...style }}>
      {dek || 'Add a one-line dek under the title'}
    </p>
  );
}

export function PmlPostAuthor({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const name = str(resolved(props).author_name);
  if (!name && !inCanvas) return null;

  return (
    <span className={className} style={style}>
      By <Value text={name} empty="Author not set" />
    </span>
  );
}

export function PmlPostDate({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const kind = str(props.kind);
  const field = kind === 'verified' ? 'last_verified_at' : kind === 'updated' ? 'updated_at' : 'published_at';
  const label = kind === 'verified' ? 'Last verified' : kind === 'updated' ? 'Updated' : 'Published';
  const when = postDate(resolved(props)[field]);
  if (!when && !inCanvas) return null;

  return (
    <span className={className} style={style}>
      {label} <Value text={when} empty="not set" />
    </span>
  );
}

export function PmlPostReadTime({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const minutes = resolved(props).read_minutes;
  const known = typeof minutes === 'number' && minutes > 0;
  if (!known && !inCanvas) return null;

  return (
    <span className={className} style={style}>
      <Value text={known ? `${minutes} min read` : ''} empty="Read time not set" />
    </span>
  );
}

/** The trust badges row: its two badges side by side, each its own element to move or drop. */
export function PmlPostBadges({ className, style, children }: { className: string; style: React.CSSProperties; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={className} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...style }}>
      {children}
    </div>
  );
}

/** "Reviewed by {reviewer}": only a reviewer who confirmed this version is baked in; nothing else may claim a review. */
export function PmlPostReviewerBadge({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const reviewer = record(resolved(props).reviewer);
  const name = str(reviewer.name);
  if (!name && !inCanvas) return null;

  return (
    <span className={className} style={{ ...PILL, ...style }}>
      Reviewed by {name ? `${name}${str(reviewer.licence) ? `, RCIC ${str(reviewer.licence)}` : ''}` : <span style={{ color: PLACEHOLDER }}>RCIC not set</span>}
    </span>
  );
}

/** "Sources: canada.ca, cic.gc.ca": the distinct sites of the post's sources, worked out once by pml-kit. */
export function PmlPostSourcesBadge({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const domains = Array.isArray(resolved(props).source_domains) ? (resolved(props).source_domains as unknown[]).filter((d): d is string => typeof d === 'string' && d !== '') : [];
  if (domains.length === 0 && !inCanvas) return null;

  return (
    <span className={className} style={{ ...PILL, ...style }}>
      Sources: {domains.length > 0 ? domains.join(', ') : <span style={{ color: PLACEHOLDER }}>none yet</span>}
    </span>
  );
}

/** The cover: the photo and its caption; on the canvas, the reference's empty panel and an "Add a caption" line. */
export function PmlPostCoverPiece({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const cover = record(resolved(props).cover);

  if (str(cover.url)) {
    if (str(cover.caption) || !inCanvas) return <PmlPostCover props={props} className={className} style={style} />;

    return (
      <div className={className} style={style}>
        <PmlPostCover props={props} className="" style={{}} />
        <p style={{ fontSize: 13, color: PLACEHOLDER, marginTop: 8 }}>Add a caption</p>
      </div>
    );
  }

  if (!inCanvas) return null;

  return (
    <figure className={className} style={{ margin: 0, ...style }}>
      <div style={{ aspectRatio: '16 / 9', maxWidth: '100%', borderRadius: 12, background: 'linear-gradient(135deg,#1E1B7B,#625FFB 60%,#A5A8FA)', display: 'grid', placeItems: 'end start', padding: 16, color: '#fff', fontSize: 13 }}>
        <span>
          <b style={{ display: 'block', fontSize: 14 }}>Featured image</b>
          {str(cover.alt) || 'No image yet. Choose one from the image bank.'}
        </span>
      </div>
      <figcaption style={{ fontSize: 13, color: PLACEHOLDER, marginTop: 8 }}>Add a caption</figcaption>
    </figure>
  );
}

const BADGE = 'inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--site-accent)_12%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--site-accent)]';

export function PmlPostReviewer({ props, className, style, inCanvas }: PieceProps): React.JSX.Element | null {
  const reviewer = record(resolved(props).reviewer);

  // Only a reviewer who confirmed this version is baked in; nothing else may claim a review.
  if (!str(reviewer.name)) return <Slot inCanvas={inCanvas} className={className} style={style}>Reviewed by (once a reviewer confirms this version)</Slot>;

  return (
    <span className={cls(BADGE, className)} style={style}>
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
    <ul className={cls('flex flex-wrap gap-2', className)} style={style} aria-label="Tags">
      {tags.map((tag) => (
        <li key={tag} className="rounded-full border border-current/20 px-2.5 py-0.5 text-xs opacity-80">
          {tag}
        </li>
      ))}
    </ul>
  );
}
