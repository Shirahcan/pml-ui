'use client';

import React from 'react';
import { BadgeCheck, CalendarCheck, FileText, ImageIcon } from 'lucide-react';

/**
 * The post parts (post layouts C2b, owner 2026-11-16: "the overall structure of what the post will look (title, tags,
 * breadcrumbs, author, date, estimate, etc) should be included in the visual designer"). They draw a post's OWN
 * fields, baked into `props.resolved` by pml-kit (`PmlSnapshotBuilder::postFields`), so the designer and the public
 * page show the same header from the same data. A host may draw any of them itself through `renderer.elements`.
 *
 * ⚠ "Reviewed by" is an attestation: pml-kit bakes a reviewer ONLY when that person confirmed this version, so this
 * file draws whatever reviewer it is given and never decides that itself. A field that is missing draws nothing on
 * the public page; the builder shows where the words come from instead of a blank band.
 */

type Fields = Record<string, unknown>;

interface Link {
  title?: string;
  url?: string;
  category?: string;
}

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

function fields(props: Record<string, unknown>): Fields {
  return record(props.resolved);
}

/** "16 November 2026": the reader's calendar words, never an ISO stamp. */
export function postDate(value: unknown): string {
  const text = str(value);
  const date = text ? new Date(text) : null;

  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-CA', { day: 'numeric', month: 'long', year: 'numeric' }).format(date) : '';
}

function Empty({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-[var(--site-radius)] border border-dashed border-current/25 px-6 py-8 text-center text-sm opacity-70">
      <Icon className="mx-auto mb-2 h-6 w-6 opacity-50" />
      {children}
    </div>
  );
}

const BADGE = 'inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--site-accent)_12%,transparent)] px-3 py-1 text-xs font-semibold text-[var(--site-accent)]';

export function PmlPostHeader({ props, className, style }: { props: Record<string, unknown>; className: string; style: React.CSSProperties }): React.JSX.Element {
  const f = fields(props);
  const title = str(f.title);

  if (!title) {
    return (
      <header className={className} style={style}>
        <Empty icon={FileText}>The post&rsquo;s breadcrumb, title, byline, read time, badges and tags show here, from the post&rsquo;s own details.</Empty>
      </header>
    );
  }

  const category = record(f.category);
  const reviewer = record(f.reviewer);
  const tags = Array.isArray(f.tags) ? f.tags.filter((t): t is string => typeof t === 'string') : [];
  const sources = Array.isArray(f.sources) ? f.sources.length : 0;
  const minutes = typeof f.read_minutes === 'number' && f.read_minutes > 0 ? f.read_minutes : 0;
  const byline = [str(f.author_name) ? `By ${str(f.author_name)}` : '', postDate(f.published_at) ? `Published ${postDate(f.published_at)}` : '', minutes ? `${minutes} min read` : ''].filter(Boolean);
  const verified = postDate(f.last_verified_at);

  return (
    <header className={`space-y-3 ${className}`.trim()} style={style}>
      <nav aria-label="Breadcrumb" className="text-sm opacity-70">
        <a href="/" className="hover:underline">Home</a>
        <span aria-hidden> › </span>
        <a href={str(category.blog_url) || '/blog'} className="hover:underline">Blog</a>
        {str(category.name) ? (
          <>
            <span aria-hidden> › </span>
            {str(category.url) ? <a href={str(category.url)} className="hover:underline">{str(category.name)}</a> : <span>{str(category.name)}</span>}
          </>
        ) : null}
      </nav>
      {str(category.name) ? <span className={`${BADGE} w-max rounded-md uppercase tracking-wider`}>{str(category.name)}</span> : null}
      <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">{title}</h1>
      {str(f.dek) ? <p className="max-w-[62ch] text-lg opacity-75">{str(f.dek)}</p> : null}
      {byline.length ? <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-75">{byline.map((part) => <span key={part}>{part}</span>)}</p> : null}
      {str(reviewer.name) || verified || sources ? (
        <ul className="flex flex-wrap gap-2" aria-label="About this post">
          {str(reviewer.name) ? (
            <li className={BADGE}>
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              Reviewed by {str(reviewer.name)}
              {str(reviewer.licence) ? `, RCIC ${str(reviewer.licence)}` : ''}
            </li>
          ) : null}
          {verified ? (
            <li className={BADGE}>
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
              Last verified {verified}
            </li>
          ) : null}
          {sources ? <li className={BADGE}>{sources === 1 ? '1 official source' : `${sources} official sources`}</li> : null}
        </ul>
      ) : null}
      {tags.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Tags">
          {tags.map((tag) => (
            <li key={tag} className="rounded-full border border-current/20 px-2.5 py-0.5 text-xs opacity-80">
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}

const RATIOS: Record<string, string> = { square: '1 / 1', '4:3': '4 / 3', '3:2': '3 / 2', '16:9': '16 / 9', '3:4': '3 / 4' };

/**
 * A cover's tallest (owner 2026-11-17, T1: "cover photo with appropriate/sensible default height"): 16:9 on a phone,
 * never taller than this on a wide page, where a full-width 16:9 photo would push the post below the fold.
 */
const COVER_MAX_HEIGHT = 420;

export function PmlPostCover({ props, className, style }: { props: Record<string, unknown>; className: string; style: React.CSSProperties }): React.JSX.Element {
  const cover = record(fields(props).cover);
  const url = str(cover.url);
  const ratio = RATIOS[str(props.ratio)] ?? '16 / 9';

  if (!url) {
    return (
      <figure className={className} style={style}>
        <div className="flex w-full items-center justify-center" style={{ aspectRatio: ratio, maxHeight: COVER_MAX_HEIGHT }}>
          <div className="w-full">
            <Empty icon={ImageIcon}>The post&rsquo;s cover photo and its caption show here.</Empty>
          </div>
        </div>
      </figure>
    );
  }

  return (
    <figure className={className} style={style}>
      <img src={url} alt={str(cover.alt)} className="w-full rounded-[var(--site-radius)] object-cover" style={{ aspectRatio: ratio, maxHeight: COVER_MAX_HEIGHT }} />
      {str(cover.caption) ? <figcaption className="mt-2 text-sm opacity-70">{str(cover.caption)}</figcaption> : null}
    </figure>
  );
}

export function PmlPostRelated({ props, className, style }: { props: Record<string, unknown>; className: string; style: React.CSSProperties }): React.JSX.Element {
  const related = (Array.isArray(fields(props).related) ? (fields(props).related as Link[]) : []).filter((r) => str(r?.title)).slice(0, 3);
  const heading = str(props.heading);

  return (
    <section className={className} style={style}>
      {heading ? <h2 className="mb-3 text-xl font-bold">{heading}</h2> : null}
      {related.length === 0 ? (
        <Empty icon={FileText}>Up to three related published guides show here.</Empty>
      ) : (
        <ul className="grid gap-3 md:grid-cols-3">
          {related.map((r) => (
            <li key={str(r.url) || str(r.title)} className="rounded-[var(--site-radius)] border border-current/15 p-4">
              {str(r.category) ? <span className="block text-xs font-bold uppercase tracking-wider text-[var(--site-accent)]">{str(r.category)}</span> : null}
              {str(r.url) ? <a href={str(r.url)} className="font-semibold hover:underline">{str(r.title)}</a> : <span className="font-semibold">{str(r.title)}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function PmlPostDisclaimer({ props, className, style }: { props: Record<string, unknown>; className: string; style: React.CSSProperties }): React.JSX.Element | null {
  const text = str(props.text);

  return text ? (
    <p className={`border-t border-current/15 pt-4 text-sm opacity-75 ${className}`.trim()} style={style}>
      {text}
    </p>
  ) : null;
}
