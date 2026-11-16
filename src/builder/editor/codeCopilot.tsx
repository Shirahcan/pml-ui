'use client';

import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

import { Button, Textarea } from '../ui/controls';

/*
 * The code pane's assistant box and its prompt history (shared program E4a4f3, split from PmlCodePane).
 *
 * Prompt history persists per document so Up-arrow recall survives a reload (an assistant that forgets what you just
 * asked the moment you refresh is annoying). A local convenience only: stored in localStorage, never sent anywhere, so
 * a storage failure (private mode, quota) degrades silently to in-memory history rather than surfacing an error. The
 * key prefix is the host's, so a product keeps the history its people already have.
 */

export const DEFAULT_COPILOT_HISTORY_KEY = 'pml-copilot-history:';
export const COPILOT_HISTORY_LIMIT = 50;

export function loadCopilotHistory(prefix: string, documentId: string): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(prefix + documentId);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function persistCopilotHistory(prefix: string, documentId: string, history: string[]): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(prefix + documentId, JSON.stringify(history.slice(-COPILOT_HISTORY_LIMIT)));
  } catch {
    // Storage unavailable/full: history stays in-memory for this session. Not worth a notice.
  }
}

/** "Edit with Porter": describe a change, the assistant rewrites the code above, the author reviews it as a diff. */
export function CopilotBox({
  assistant,
  value,
  onChange,
  onKeyDown,
  busy,
  canSend,
  onSend,
  notice,
}: {
  /** The host's assistant as a phrase ("Porter", or "the assistant"). */
  assistant: string;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  busy: boolean;
  canSend: boolean;
  onSend: () => void;
  notice: string | null;
}): React.JSX.Element {
  return (
    <div className="mt-3 rounded-xl border border-[var(--pb-border)] bg-white/50 p-3 backdrop-blur">
      <div className="mb-1 flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-[var(--pb-accent)]" />
        Edit with {assistant}
      </div>
      <p className="mb-2 text-xs text-[var(--pb-muted)]">
        Describe a change and {assistant} rewrites the code above. Review it, then Apply. Enter to send, Shift+Enter for a new line, Up arrow for a past
        prompt.
      </p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={2}
        disabled={busy}
        placeholder={`Ask ${assistant} to write, review, fix, or extend your page code (Enter to send).`}
      />
      {notice ? <p className="mt-2 rounded-lg border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-sm text-amber-900">{notice}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button onClick={onSend} disabled={!canSend}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Update with {assistant}
        </Button>
      </div>
    </div>
  );
}
