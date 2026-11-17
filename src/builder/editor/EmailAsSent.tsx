'use client';

import React, { useEffect, useState } from 'react';

import { Button } from '../ui/controls';
import { useBuilderHost } from './host';

/** What the host renders for a saved email: its delivery HTML and the plain-text part. */
export interface RenderedEmail {
  html: string;
  text?: string | null;
}

/**
 * Show a page in an email client's dark mode (pml-email C1a). The email's own dark rules sit under
 * `@media (prefers-color-scheme: dark)`, which an iframe cannot be told to match, so the dark preview applies them
 * unconditionally.
 */
export function forceDarkMode(html: string): string {
  return html.replace(/@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/gi, '@media all');
}

/**
 * The email exactly as the host sends it (pml-email C1a): its rendered HTML in a sandboxed frame (no scripts, no
 * navigation), light or dark, and the plain-text part. It renders the SAVED design, so the caller flushes first.
 */
export function EmailAsSent({ render, version }: { render: () => Promise<RenderedEmail>; version: number }): React.JSX.Element {
  const host = useBuilderHost();
  const [email, setEmail] = useState<RenderedEmail | null>(null);
  const [scheme, setScheme] = useState<'light' | 'dark' | 'text'>('light');

  useEffect(() => {
    let alive = true;

    render()
      .then((rendered) => alive && setEmail(rendered))
      .catch((err) => host.onError(err));

    return () => {
      alive = false;
    };
  }, [render, version, host]);

  return (
    <div className="space-y-3">
      <div role="group" aria-label="How to show the email" className="flex gap-2">
        {(['light', 'dark', 'text'] as const).map((s) => (
          <Button key={s} size="sm" variant={scheme === s ? 'primary' : 'outline'} aria-pressed={scheme === s} onClick={() => setScheme(s)}>
            {s === 'light' ? 'Light' : s === 'dark' ? 'Dark' : 'Plain text'}
          </Button>
        ))}
      </div>

      {!email ? (
        <p className="py-10 text-center text-sm text-[var(--pb-muted)]">Preparing the email as it is sent...</p>
      ) : scheme === 'text' ? (
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--pb-border)] bg-white p-4 text-sm">{email.text ?? 'This email has no plain-text part.'}</pre>
      ) : (
        <iframe
          title={scheme === 'dark' ? 'The email as sent, dark mode' : 'The email as sent'}
          sandbox=""
          srcDoc={scheme === 'dark' ? forceDarkMode(email.html) : email.html}
          className="h-[70vh] w-full rounded-xl border border-[var(--pb-border)] bg-white"
        />
      )}
    </div>
  );
}
