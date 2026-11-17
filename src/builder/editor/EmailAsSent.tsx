'use client';

import React, { useEffect, useRef, useState } from 'react';

import { Button } from '../ui/controls';
import { useBuilderHost } from './host';

/** What the host renders for an email: its delivery HTML and the plain-text part (never with an open-tracking pixel). */
export interface RenderedEmail {
  html: string;
  text?: string | null;
}

/** Any `(prefers-color-scheme: …)` feature, wherever it sits in a media query's prelude. */
const SCHEME_FEATURE = /\(\s*prefers-color-scheme\s*:\s*(dark|light)\s*\)/gi;

/** Always true / never true stand-ins for a media feature, valid anywhere a feature is. */
const ALWAYS = '(min-width: 0px)';
const NEVER = '(max-width: 0px)';

/**
 * Show an email as a mail client in the given scheme would (pml-email C1a). An iframe's `prefers-color-scheme`
 * follows the VIEWER's system, so both schemes are forced: every scheme feature becomes always or never true, wherever
 * it sits in the query (`screen and (prefers-color-scheme: dark)` too), and the document declares the scheme so the
 * page's own canvas matches.
 */
export function forceColorScheme(html: string, scheme: 'light' | 'dark'): string {
  const forced = html.replace(SCHEME_FEATURE, (_m, wanted: string) => (wanted.toLowerCase() === scheme ? ALWAYS : NEVER));
  const declare = `<meta name="color-scheme" content="${scheme}"><style>:root{color-scheme:${scheme}}</style>`;

  return /<head[^>]*>/i.test(forced) ? forced.replace(/<head[^>]*>/i, (head) => head + declare) : declare + forced;
}

/** @deprecated Use `forceColorScheme(html, 'dark')`. */
export function forceDarkMode(html: string): string {
  return forceColorScheme(html, 'dark');
}

/** Links open in a new tab, never inside the preview (the frame cannot navigate back). */
function linksOpenOutside(html: string): string {
  const base = '<base target="_blank">';

  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (head) => head + base) : base + html;
}

/**
 * The email exactly as the host sends it (pml-email C1a): its rendered HTML in a sandboxed frame (no scripts; links
 * open in a new tab), light or dark, and the plain-text part. `version` asks for a fresh render; `stale` says the last
 * change did not save, so what shows is the email without it. `render` is read through a ref, so a host may pass an
 * inline function without re-rendering in a loop.
 */
export function EmailAsSent({ render, version, stale = false }: { render: () => Promise<RenderedEmail>; version: number; stale?: boolean }): React.JSX.Element {
  const host = useBuilderHost();
  const hostRef = useRef(host);
  const renderRef = useRef(render);
  useEffect(() => {
    hostRef.current = host;
    renderRef.current = render;
  });
  const [email, setEmail] = useState<RenderedEmail | null>(null);
  const [scheme, setScheme] = useState<'light' | 'dark' | 'text'>('light');

  useEffect(() => {
    let alive = true;

    renderRef.current()
      .then((rendered) => alive && setEmail(rendered))
      .catch((err) => hostRef.current.onError(err));

    return () => {
      alive = false;
    };
  }, [version]);

  return (
    <div className="space-y-3">
      <div role="group" aria-label="How to show the email" className="flex gap-2">
        {(['light', 'dark', 'text'] as const).map((s) => (
          <Button key={s} size="sm" variant={scheme === s ? 'primary' : 'outline'} aria-pressed={scheme === s} onClick={() => setScheme(s)}>
            {s === 'light' ? 'Light' : s === 'dark' ? 'Dark' : 'Plain text'}
          </Button>
        ))}
      </div>

      {stale ? (
        <p role="status" className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Your last change is not saved yet, so this shows the email without it.
        </p>
      ) : null}

      {!email ? (
        <p className="py-10 text-center text-sm text-[var(--pb-muted)]">Preparing the email as it is sent...</p>
      ) : scheme === 'text' ? (
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--pb-border)] bg-white p-4 text-sm">{email.text ?? 'This email has no plain-text part.'}</pre>
      ) : (
        <iframe
          title={scheme === 'dark' ? 'The email as sent, dark mode' : 'The email as sent'}
          sandbox="allow-popups allow-popups-to-escape-sandbox"
          srcDoc={linksOpenOutside(forceColorScheme(email.html, scheme))}
          style={{ colorScheme: scheme }}
          className={`h-[70vh] w-full rounded-xl border border-[var(--pb-border)] ${scheme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}
        />
      )}
    </div>
  );
}
