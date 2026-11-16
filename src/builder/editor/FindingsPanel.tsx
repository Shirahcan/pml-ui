'use client';

import React, { type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CloudOff, Copy, Lightbulb, ShieldAlert } from 'lucide-react';

import type { DocumentFinding, DocumentPreflight } from '../document';
import { useBuilderHost } from './host';

/**
 * The words a findings panel says around the findings. The rules behind the checks are the host's (a regulator's
 * advertising code, a job-ad law), so the host words them; these defaults name no rulebook.
 */
export interface FindingsWords {
  /** Nothing to change. */
  clean: ReactNode;
  /** A check that must run could not, so publishing waits. */
  incomplete: ReactNode;
  blockersTitle: (count: number) => string;
  warningsTitle: string;
  warningsIntro: ReactNode;
  structureTitle: string;
  structureIntro: ReactNode;
  suggestionTitle: string;
  copySuggestion: string;
  copied: string;
}

export const DEFAULT_FINDINGS_WORDS: FindingsWords = {
  clean: 'Nothing here needs to change. Ready to publish.',
  incomplete: (
    <>
      <strong className="font-medium">We could not fully check this just now.</strong> Your work is saved. Publishing waits until the
      check can run, so try again shortly.
    </>
  ),
  blockersTitle: (n) => (n === 1 ? 'One thing has to change before this can go public' : `${n} things have to change before this can go public`),
  warningsTitle: 'Worth a second look',
  warningsIntro: 'These will not stop you publishing. They were flagged because a reader could take them the wrong way.',
  structureTitle: 'Easier to read and find',
  structureIntro: 'Suggestions only. They help screen readers and search engines understand the page, and will not stop you publishing.',
  suggestionTitle: 'Try instead',
  copySuggestion: 'Copy this',
  copied: 'Rewrite copied.',
};

/**
 * What a preflight found, written for the author rather than for a log (shared program E4a4c, from Portify's
 * compliance panel). A refusal is never a dead end: every finding shows the exact words that triggered it, the reason
 * in plain language and, where the check offers one, a rewrite to copy. Structure advice (headings, alt text, button
 * names) sits apart because it never stops a publish. `info` findings are not shown.
 */
export function FindingsPanel({ preflight, words }: { preflight: DocumentPreflight; words?: Partial<FindingsWords> }): React.JSX.Element {
  const w = { ...DEFAULT_FINDINGS_WORDS, ...words };
  const structure = preflight.findings.filter((f) => f.source === 'structure');

  return (
    <div className="space-y-3">
      <Findings preflight={preflight} words={w} />
      {structure.length > 0 ? <StructureAdvice items={structure} words={w} /> : null}
    </div>
  );
}

function StructureAdvice({ items, words }: { items: DocumentFinding[]; words: FindingsWords }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-sky-200/70 bg-sky-50/70 p-4">
      <p className="mb-1 flex items-center gap-2 text-sm font-medium text-sky-900">
        <Lightbulb className="h-4 w-4 shrink-0" />
        {words.structureTitle}
      </p>
      <p className="mb-3 text-xs text-sky-800/80">{words.structureIntro}</p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="rounded-lg border border-sky-200/70 bg-white/70 p-3 text-sm leading-relaxed">
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Findings({ preflight, words }: { preflight: DocumentPreflight; words: FindingsWords }): React.JSX.Element {
  const shown = preflight.findings.filter((f) => f.source !== 'structure' && f.severity !== 'info');
  const blockers = shown.filter((f) => f.severity === 'block');
  const warnings = shown.filter((f) => f.severity !== 'block');

  if (preflight.incomplete === true) {
    return (
      <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-4">
        <p className="flex items-start gap-2 text-sm text-amber-900">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{words.incomplete}</span>
        </p>
      </div>
    );
  }

  if (shown.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-300/50 bg-emerald-50/70 p-3 text-sm text-emerald-900">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {words.clean}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {blockers.length > 0 ? (
        <div className="rounded-xl border border-red-300/60 bg-red-50/70 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-red-900">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            {words.blockersTitle(blockers.length)}
          </p>
          <div className="space-y-3">
            {blockers.map((finding, i) => (
              <FindingCard key={i} finding={finding} tone="block" words={words} />
            ))}
          </div>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-900">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {words.warningsTitle}
          </p>
          <p className="mb-3 text-xs text-amber-800/80">{words.warningsIntro}</p>
          <div className="space-y-3">
            {warnings.map((finding, i) => (
              <FindingCard key={i} finding={finding} tone="warn" words={words} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FindingCard({ finding, tone, words }: { finding: DocumentFinding; tone: 'block' | 'warn'; words: FindingsWords }): React.JSX.Element {
  const host = useBuilderHost();

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      host.onSuccess(words.copied);
    } catch (err) {
      // A clipboard refusal is not a failed request, so it goes to the host's error surface.
      host.onError(err);
    }
  };

  return (
    <div className={`rounded-lg border bg-white/70 p-3 ${tone === 'block' ? 'border-red-200' : 'border-amber-200'}`}>
      {finding.excerpt ? <p className="mb-2 border-l-2 border-current/20 pl-2 text-sm italic opacity-80">&ldquo;{finding.excerpt}&rdquo;</p> : null}

      <p className="text-sm leading-relaxed">{finding.message}</p>

      {finding.suggestion ? (
        <div className="mt-2 rounded-md bg-black/[0.03] p-2">
          <p className="mb-1 text-xs font-medium opacity-60">{words.suggestionTitle}</p>
          <p className="text-sm">{finding.suggestion}</p>
          <button
            type="button"
            onClick={() => void copy(finding.suggestion as string)}
            className="mt-1.5 inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium underline underline-offset-2 outline-none"
          >
            <Copy className="h-3 w-3" />
            {words.copySuggestion}
          </button>
        </div>
      ) : null}
    </div>
  );
}
