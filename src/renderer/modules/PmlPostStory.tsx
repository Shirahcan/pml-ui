'use client';

import React from 'react';
import { Quote } from 'lucide-react';

import { EMPTY_BLOCK, POST, POST_H2 } from './PmlPostFlavor';

/**
 * A client story from the product's story bank (post layouts C2e). pml-kit bakes it into `props.resolved` ONLY when
 * the story is verified with recorded written consent (`PmlSnapshotBuilder::storyFields`), and only its story fields:
 * never a name. So this file draws what it is given and never decides consent itself.
 *
 * Drawn as the reference studio's story card (owner 2026-11-17): "{heading}: {case type}", then three labelled parts
 * (the node's own labels, else the reference's words). The situation is the story's challenge; what happened is its
 * strategy then its outcome, two paragraphs.
 *
 * Nothing picked, or nothing allowed: the canvas shows the empty marker with where a story comes from; readers see
 * nothing.
 */

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The card's key line (`.story .k`). */
const KEY: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: POST.deep, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 12 };

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
  const heading = str(props.heading) || 'Client story';
  const parts: Array<[label: string, paragraphs: string[]]> = [
    [str(props.situation_label) || 'The situation', [str(story.challenge)]],
    [str(props.how_found_label) || 'How they found their consultant on Portify', [str(story.how_found)]],
    [str(props.outcome_label) || 'What happened', [str(story.strategy), str(story.outcome)]],
  ];
  const told = parts.map(([label, paragraphs]) => [label, paragraphs.filter(Boolean)] as const).filter(([, paragraphs]) => paragraphs.length > 0);

  if (told.length === 0) {
    return inCanvas ? (
      <section className={className} style={style}>
        <div className="text-center text-sm" style={{ ...EMPTY_BLOCK, padding: '24px 16px', color: POST.slate }}>
          <Quote className="mx-auto mb-2 h-6 w-6 opacity-50" aria-hidden />
          Pick a client story with written consent in Client stories, and it shows here.
        </div>
      </section>
    ) : null;
  }

  const caseType = str(story.case_type);

  return (
    <section className={className} style={style}>
      <h2 style={POST_H2}>{caseType ? `${heading}: ${caseType}` : heading}</h2>
      <div style={{ border: `1px solid ${POST.line}`, borderRadius: 12, padding: '6px 18px 10px' }}>
        {told.map(([label, paragraphs]) => (
          <React.Fragment key={label}>
            <div style={KEY}>{label}</div>
            {paragraphs.map((words) => (
              <p key={words} style={{ margin: '4px 0 0' }}>
                {words}
              </p>
            ))}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
