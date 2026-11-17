'use client';

import React from 'react';
import { Quote } from 'lucide-react';

/**
 * A client story from the product's story bank (post layouts C2e). pml-kit bakes it into `props.resolved` ONLY when
 * the story is verified with recorded written consent (`PmlSnapshotBuilder::storyFields`), and only its story fields:
 * never a name. So this file draws what it is given and never decides consent itself.
 *
 * Nothing picked, or nothing allowed: the builder says where a story comes from; readers see nothing.
 */

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

const PARTS: Array<[key: string, label: string]> = [
  ['challenge', 'The challenge'],
  ['strategy', 'The Portify strategy'],
  ['outcome', 'The outcome'],
];

export function PmlPostStory({
  props,
  className,
  style,
  inCanvas,
}: {
  props: Record<string, unknown>;
  className: string;
  style: React.CSSProperties;
  inCanvas: boolean;
}): React.JSX.Element | null {
  const story = props.resolved && typeof props.resolved === 'object' ? (props.resolved as Record<string, unknown>) : {};
  const heading = str(props.heading);

  if (!PARTS.some(([key]) => str(story[key]))) {
    return inCanvas ? (
      <section className={className} style={style}>
        <div className="rounded-[var(--site-radius)] border border-dashed border-current/25 px-6 py-8 text-center text-sm opacity-70">
          <Quote className="mx-auto mb-2 h-6 w-6 opacity-50" />
          Pick a client story with written consent in Client stories, and it shows here.
        </div>
      </section>
    ) : null;
  }

  return (
    <section className={className} style={style}>
      {heading ? <h2 className="mb-3 text-2xl font-bold">{heading}</h2> : null}
      <div className="rounded-[var(--site-radius)] border border-current/15">
        {str(story.case_type) || str(story.how_found) ? (
          <p className="flex flex-wrap gap-x-4 gap-y-1 border-b border-current/15 px-5 py-3 text-sm opacity-80">
            {str(story.case_type) ? <span>{str(story.case_type)}</span> : null}
            {str(story.how_found) ? <span>How they found their consultant: {str(story.how_found)}</span> : null}
          </p>
        ) : null}
        <div className="space-y-3 px-5 py-4">
          {PARTS.filter(([key]) => str(story[key])).map(([key, label]) => (
            <div key={key}>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--site-accent)]">{label}</p>
              <p className="mt-1">{str(story[key])}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
