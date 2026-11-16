import { useMemo } from 'react';

import { completionContextAt, type PmlEditContext } from '../../pml/completion';
import type { PmlDiagnostic } from '../../pml/diagnostics';

/**
 * What the code editor derives from its value, its diagnostics and the caret's line (shared program E4a4f2, lifted
 * out of PmlCodeEditor unchanged): each line's worst severity, the caret line's first problem, one fix per error line,
 * and a comment line that reads like an instruction.
 */
export function useCodeEditorFacts(value: string, diagnostics: PmlDiagnostic[], activeLine: number) {
  // Per-line worst severity, for the gutter number tint (an error outranks a warning).
  const lineSeverity = useMemo(() => {
    const map = new Map<number, PmlDiagnostic['severity']>();
    for (const d of diagnostics) {
      if (d.severity === 'error') map.set(d.line, 'error');
      else if (map.get(d.line) !== 'error') map.set(d.line, 'warning');
    }
    return map;
  }, [diagnostics]);

  // The first diagnostic on the caret's line, shown as a small message pill (a non-intrusive
  // stand-in for a hover tooltip: the textarea sits above the squiggles, so hover cannot reach them).
  const activeDiagnostic = useMemo(
    () => diagnostics.find((d) => d.line === activeLine + 1) ?? null,
    [diagnostics, activeLine],
  );

  // Error lines get a "Fix with <assistant>" gutter button (one per line; the first error's message).
  const errorLines = useMemo(() => {
    const byLine = new Map<number, string>();
    for (const d of diagnostics) {
      if (d.severity === 'error' && !byLine.has(d.line)) byLine.set(d.line, d.message);
    }
    return Array.from(byLine, ([line, message]) => ({ line, message }));
  }, [diagnostics]);

  // When the caret sits on a COMMENT line that reads like an instruction - a PML <!-- --> or a PSL //
  // or /* */ inside a <script> - offer to scaffold from it. The extracted instruction + its language
  // context (pml|psl, from the shared helper) are handed up; the pane owns the request + diff preview.
  const commentLine = useMemo<{ line: number; comment: string; context: PmlEditContext } | null>(() => {
    const lines = value.split('\n');
    const text = lines[activeLine] ?? '';
    const trimmed = text.trim();

    let offset = 0;
    for (let i = 0; i < activeLine; i++) offset += lines[i].length + 1;
    const context = completionContextAt(value, offset + text.length);

    let comment: string | null = null;
    if (context === 'psl') {
      if (trimmed.startsWith('//')) comment = trimmed.replace(/^\/\/+\s?/, '');
      else if (trimmed.startsWith('/*')) comment = trimmed.replace(/^\/\*\s?/, '').replace(/\s?\*\/$/, '');
    } else if (trimmed.startsWith('<!--')) {
      comment = trimmed.replace(/^<!--\s?/, '').replace(/\s?-->$/, '');
    }

    comment = (comment ?? '').trim();

    // Only offer scaffolding when the comment carries a real instruction (not a bare or tiny note).
    return comment.length >= 2 ? { line: activeLine + 1, comment, context } : null;
  }, [value, activeLine]);

  return { lineSeverity, activeDiagnostic, errorLines, commentLine };
}
