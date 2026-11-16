'use client';

import React from 'react';
import { MessageSquareWarning } from 'lucide-react';

import type { DocumentPlaceholders } from '../document';
import { assistantsLabel, useBuilderHost } from './host';

/**
 * Why a document did not go live: it still shows placeholders the assistant marked (a picture to add, or words in
 * square brackets it could not supply truthfully). The host's own message says how many and how to clear them; the
 * assistant's notes are quoted so the person knows what to look for on the canvas.
 */
export function PlaceholdersLeftNotice({
  message,
  left,
}: {
  message: string;
  left: Pick<DocumentPlaceholders, 'total' | 'examples'>;
}): React.JSX.Element {
  const { assistantName } = useBuilderHost();
  const note = assistantsLabel(assistantName, 'note', 'Note');

  return (
    <div role="status" className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-4">
      <p className="mb-1 flex items-center gap-2 text-sm font-medium text-amber-900">
        <MessageSquareWarning aria-hidden="true" className="h-4 w-4 shrink-0" />
        Not ready yet: {left.total} {left.total === 1 ? 'placeholder is' : 'placeholders are'} still showing
      </p>
      <p className="text-sm leading-relaxed text-amber-900/90">{message}</p>
      {left.examples.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {left.examples.map((example, i) => (
            <li key={i} className="rounded-lg border border-amber-200/70 bg-white/70 px-3 py-2 text-xs text-amber-950">
              {note}: {example}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
