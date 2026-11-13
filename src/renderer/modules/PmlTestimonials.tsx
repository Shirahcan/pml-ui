'use client';

import React from 'react';
import { Quote, Star } from 'lucide-react';

/**
 * The testimonials module, rendered from the snapshot the publish (and builder-preview) pipeline
 * bakes into the primitive as `resolved`. Only the consultant's ATTESTED + visible testimonials
 * are ever baked (CICC s.45; the store filters, and the publish scan re-verifies), so this
 * component never has to reason about attestation, it just renders what it is given.
 *
 * The empty state is honest in the builder, where nothing is baked yet: it tells the consultant
 * WHERE the content comes from rather than showing a blank band, exactly like PmlPackages.
 */

interface ResolvedTestimonial {
  id?: string | number;
  author_name?: string | null;
  author_role?: string | null;
  quote?: string | null;
  rating?: number | null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function Rating({ value }: { value: number }): React.JSX.Element | null {
  const stars = Math.max(0, Math.min(5, Math.round(value)));

  if (stars === 0) return null;

  return (
    <div className="mb-3 flex gap-0.5" aria-label={`${stars} out of 5`}>
      {Array.from({ length: stars }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-[var(--site-accent)] text-[var(--site-accent)]" />
      ))}
    </div>
  );
}

export function PmlTestimonials({
  props,
  className,
  style,
}: {
  props: Record<string, unknown>;
  className: string;
  style: React.CSSProperties;
}): React.JSX.Element {
  const items = Array.isArray(props.resolved) ? (props.resolved as ResolvedTestimonial[]) : [];
  const heading = str(props.heading);
  const intro = str(props.intro);
  const layout = str(props.layout) === 'stack' ? 'stack' : 'grid';

  if (items.length === 0) {
    return (
      <section className={className} style={style}>
        <div className="mx-auto max-w-3xl rounded-[var(--site-radius)] border border-dashed border-current/25 px-6 py-10 text-center">
          <Quote className="mx-auto mb-3 h-7 w-7 opacity-40" />
          <p className="text-sm opacity-70">
            Your attested client testimonials will appear here. Add one from the Testimonials tab of
            your Library, record the client’s written approval, and it will show when you publish.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={className} style={style}>
      <div className="mx-auto max-w-5xl">
        {heading ? (
          <h2 className="text-center text-2xl font-semibold tracking-tight md:text-3xl">{heading}</h2>
        ) : null}
        {intro ? (
          <p className="mx-auto mt-3 max-w-2xl text-center leading-relaxed opacity-80">{intro}</p>
        ) : null}

        <div
          className={
            layout === 'stack'
              ? 'mx-auto mt-10 flex max-w-2xl flex-col gap-6'
              : 'mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'
          }
        >
          {items.map((t, i) => (
            <figure
              key={String(t.id ?? i)}
              className="flex flex-col rounded-[var(--site-radius)] border border-current/10 bg-[var(--site-surface)] p-6 shadow-sm"
            >
              {typeof t.rating === 'number' ? <Rating value={t.rating} /> : null}
              <Quote className="mb-2 h-5 w-5 shrink-0 text-[var(--site-accent)] opacity-70" />
              <blockquote className="flex-1 leading-relaxed opacity-90">{str(t.quote)}</blockquote>
              {str(t.author_name) ? (
                <figcaption className="mt-4 text-sm">
                  <span className="font-semibold">{str(t.author_name)}</span>
                  {str(t.author_role) ? <span className="opacity-70"> · {str(t.author_role)}</span> : null}
                </figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
