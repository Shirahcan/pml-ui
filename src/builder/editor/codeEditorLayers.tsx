'use client';

import React, { type RefObject } from 'react';
import { Sparkles } from 'lucide-react';

import { diagnosticRect, type PmlDiagnostic } from '../../pml/diagnostics';
import type { PmlEditContext } from '../../pml/completion';
import { cx } from '../ui/theme';
import { GAP, GUTTER, LINE, PAD, squiggle, TEXT_METRICS } from './codeEditorStyle';

/*
 * The code editor's drawn layers and its affordances (shared program E4a4f2, split from PmlCodeEditor). The editor
 * owns the state and the scroll sync; these draw what it hands them. The accent tints are color-mix values, never an
 * opacity on a var() colour (Tailwind 3 hosts drop that class).
 */

/** "Fix with Porter" with a name, "Fix" without one. */
function withAssistant(verb: string, name: string | undefined): string {
  return name ? `${verb} with ${name}` : verb;
}

const PILL =
  'absolute bottom-3 z-[5] flex items-center gap-1 whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--pb-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--pb-accent)_10%,transparent)] px-3 py-1 text-xs font-medium text-[var(--pb-accent)] shadow-sm outline-none hover:bg-[color-mix(in_srgb,var(--pb-accent)_20%,transparent)]';

/** The squiggles under each problem, and the ghost-text completion at the caret; both scroll-synced by the editor. */
export function CodeEditorLayers({
  diagnostics,
  charW,
  squiggleRef,
  suggestion,
  ghostPos,
  ghostRef,
}: {
  diagnostics: PmlDiagnostic[];
  charW: number;
  squiggleRef: RefObject<HTMLDivElement | null>;
  /** The completion to show, or null; the editor hides it while a diff is under review. */
  suggestion: string | null;
  ghostPos: { line: number; col: number } | null;
  ghostRef: RefObject<HTMLDivElement | null>;
}): React.JSX.Element {
  return (
    <>
      {/* Squiggle layer: the highlight <pre>'s exact geometry, scroll-synced, below the textarea. */}
      <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 top-0 z-[1] overflow-hidden" style={{ left: GUTTER, padding: `${PAD}px ${PAD}px ${PAD}px ${GAP}px` }}>
        <div ref={squiggleRef} className="relative">
          {diagnostics.map((d, idx) => {
            const r = diagnosticRect(d, { charW, lineH: LINE, padL: 0, padT: 0 });

            return (
              <div
                key={idx}
                data-testid="pml-squiggle"
                data-severity={d.severity}
                style={{
                  position: 'absolute',
                  left: r.left,
                  top: r.top + LINE - 3,
                  width: r.width,
                  height: 3,
                  backgroundImage: squiggle(d.severity),
                  backgroundRepeat: 'repeat-x',
                  backgroundSize: '6px 3px',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Ghost-text autocomplete: a dim inline suggestion at the caret. Tab accepts it, Escape (or typing) dismisses it. */}
      {suggestion && ghostPos ? (
        <div aria-hidden className="pointer-events-none absolute bottom-0 right-0 top-0 z-[1] overflow-hidden" style={{ left: GUTTER, padding: `${PAD}px ${PAD}px ${PAD}px ${GAP}px` }}>
          <div ref={ghostRef} className="relative">
            <span
              data-testid="pml-ghost"
              className="absolute text-[color-mix(in_srgb,var(--pb-muted)_50%,transparent)]"
              style={{ ...TEXT_METRICS, left: ghostPos.col * charW, top: ghostPos.line * LINE, whiteSpace: 'pre' }}
            >
              {suggestion}
            </span>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** The editor's assistant affordances and the caret line's problem; all hidden while a diff is under review. */
export function CodeEditorAffordances({
  assistantName,
  errorLines,
  onFixError,
  fixLayerRef,
  activeDiagnostic,
  selectionEdit,
  scaffold,
}: {
  assistantName?: string;
  errorLines: Array<{ line: number; message: string }>;
  onFixError?: (line: number, message: string) => void;
  fixLayerRef: RefObject<HTMLDivElement | null>;
  activeDiagnostic: PmlDiagnostic | null;
  /** Given while a selection can be edited: the Cmd-K pill, or its instruction box once open. */
  selectionEdit: { open: boolean; value: string; onValue: (value: string) => void; onOpen: (open: boolean) => void; onSubmit: () => void } | null;
  /** Given while the caret sits on a comment that reads like an instruction. */
  scaffold: { commentLine: { line: number; comment: string; context: PmlEditContext }; onScaffold: (params: { line: number; comment: string; context: PmlEditContext }) => void } | null;
}): React.JSX.Element {
  return (
    <>
      {/* Fix gutter buttons: one per error line, scroll-synced with the code, above the number gutter (z-[4]). */}
      {onFixError && errorLines.length > 0 ? (
        <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-[4] overflow-hidden" style={{ width: GUTTER }}>
          <div ref={fixLayerRef}>
            {errorLines.map(({ line, message }) => (
              <button
                key={line}
                type="button"
                title={`${withAssistant('Fix', assistantName)}: ${message}`}
                aria-label={withAssistant(`Fix the error on line ${line}`, assistantName)}
                data-testid="pml-fix-error"
                data-line={line}
                onClick={() => onFixError(line, message)}
                className="pointer-events-auto absolute left-0.5 flex h-4 w-4 items-center justify-center rounded bg-[color-mix(in_srgb,var(--pb-accent)_15%,transparent)] text-[var(--pb-accent)] shadow-sm outline-none hover:bg-[color-mix(in_srgb,var(--pb-accent)_30%,transparent)]"
                style={{ top: PAD + (line - 1) * LINE + 2 }}
              >
                <Sparkles className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* The caret line's first diagnostic, as a small non-focus-stealing message pill. */}
      {activeDiagnostic ? (
        <div
          className={cx(
            'pointer-events-none absolute right-2 top-2 z-[4] max-w-[72%] truncate rounded-md border px-2 py-1 text-xs shadow-sm',
            activeDiagnostic.severity === 'error' ? 'border-red-300/60 bg-red-50/90 text-red-700' : 'border-amber-300/60 bg-amber-50/90 text-amber-800',
          )}
        >
          Ln {activeDiagnostic.line}: {activeDiagnostic.message}
        </div>
      ) : null}

      {/* Cmd-K: a pill on a non-empty selection that opens an inline instruction box. */}
      {selectionEdit && !selectionEdit.open ? (
        <button
          type="button"
          onClick={() => {
            selectionEdit.onValue('');
            selectionEdit.onOpen(true);
          }}
          className={cx(PILL, 'right-3')}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {withAssistant('Edit', assistantName)}
          <kbd className="ml-1 rounded bg-[color-mix(in_srgb,var(--pb-accent)_15%,transparent)] px-1 text-[10px]">⌘K</kbd>
        </button>
      ) : null}

      {selectionEdit?.open ? (
        <div className="absolute bottom-3 right-3 z-[5] flex w-80 max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-lg border border-[var(--pb-border)] bg-white/95 p-1.5 shadow-md">
          <Sparkles className="ml-1 h-4 w-4 shrink-0 text-[var(--pb-accent)]" />
          <input
            autoFocus
            value={selectionEdit.value}
            onChange={(e) => selectionEdit.onValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                selectionEdit.onSubmit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                selectionEdit.onOpen(false);
              }
            }}
            placeholder="Describe the change to the selection"
            className="min-w-0 flex-1 bg-transparent px-1 py-1 text-xs outline-none"
          />
        </div>
      ) : null}

      {/* Scaffold from a comment that reads like an instruction; never beside the Cmd-K pill. */}
      {scaffold ? (
        <button type="button" onClick={() => scaffold.onScaffold(scaffold.commentLine)} data-testid="pml-scaffold-pill" className={PILL} style={{ left: GUTTER + GAP }}>
          <Sparkles className="h-3.5 w-3.5" />
          {withAssistant('Scaffold', assistantName)}
        </button>
      ) : null}
    </>
  );
}
