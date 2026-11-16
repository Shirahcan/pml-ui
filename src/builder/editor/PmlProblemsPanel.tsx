'use client';

import React, { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';

import type { PmlDiagnostic } from '../../pml/diagnostics';
import { cx, useOwnVars } from '../ui/theme';

/**
 * The "Problems (N)" list under the Code editor: every diagnostic the diagnose pass found, errors first then by line.
 * Clicking a row jumps the caret to that line/col (the editor's imperative handle). It is also the home for any
 * diagnostic that (in a rare fallback) lacks a precise line, so nothing is ever silently dropped.
 */
export function PmlProblemsPanel({
  diagnostics,
  onJump,
}: {
  diagnostics: PmlDiagnostic[];
  onJump: (line: number, col: number) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(true);

  const sorted = useMemo(() => {
    const rank = (s: PmlDiagnostic['severity']): number => (s === 'error' ? 0 : 1);
    return [...diagnostics].sort((a, b) => rank(a.severity) - rank(b.severity) || a.line - b.line || a.col - b.col);
  }, [diagnostics]);

  const count = diagnostics.length;
  const vars = useOwnVars();

  return (
    <div className="rounded-xl border border-[var(--pb-border)] bg-white/50 text-[var(--pb-text)] backdrop-blur" style={vars}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium outline-none"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span>Problems</span>
        {count > 0 ? <span className="rounded-full bg-slate-900/[0.06] px-2 py-0.5 text-xs tabular-nums">{count}</span> : null}
      </button>

      {open ? (
        count === 0 ? (
          <div className="flex items-center gap-2 px-3 pb-3 text-sm text-[var(--pb-muted)]">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            No problems. Your code parses and compiles.
          </div>
        ) : (
          <ul className="max-h-48 overflow-auto border-t border-[var(--pb-border)]">
            {sorted.map((d, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => onJump(d.line, d.col)}
                  className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-sm outline-none hover:bg-slate-900/[0.04]"
                >
                  {d.severity === 'error' ? (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <span className="mt-0.5 shrink-0 text-xs tabular-nums text-[var(--pb-muted)]">
                    Ln {d.line}:{d.col}
                  </span>
                  <span className="min-w-0 flex-1">{d.message}</span>
                  <span
                    className={cx(
                      'mt-0.5 shrink-0 rounded px-1.5 text-[10px] font-medium uppercase tracking-wide',
                      'bg-slate-900/[0.06] text-[var(--pb-muted)]',
                    )}
                  >
                    {d.source}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
