'use client';

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { tokenizePml } from '../../language';
import { usePmlCompletion, type PmlCompletionApi } from '../../pml/completion';
import { cx, useOwnVars } from '../ui/theme';
import { CodeEditorAffordances, CodeEditorLayers } from './codeEditorLayers';
import { useCodeEditorFacts } from './codeEditorFacts';
import { GAP, GUTTER, LINE, PAD, TEXT_METRICS, TOKEN_CLASS, type PmlCodeEditorHandle, type PmlCodeEditorProps } from './codeEditorStyle';
import { useBuilderHost } from './host';

export type { PmlCodeEditorHandle, PmlCodeEditorProps } from './codeEditorStyle';

/** No completion call: the hook is never enabled without one, so this is never asked. */
const NO_COMPLETION: PmlCompletionApi = { completePml: async () => ({ completion: null }) };

/**
 * A lightweight PML/PSL code editor: a transparent <textarea> layered over a highlighted <pre>, with
 * a synced line-number gutter and an active-line band. No dependency, and it stays a plain controlled
 * input (value / onChange), so an assistant writing to the buffer and the pane's own keydown
 * handling keep working unchanged.
 *
 * The one hard requirement is metric parity: the textarea and the highlight layer share the exact
 * same font, size, line-height, tab-size, padding, and (deliberately) no-wrap, so the coloured text
 * sits pixel-for-pixel under what the user types and the caret never drifts. Wrapping is off and long
 * lines scroll horizontally, which also makes the 1:1 gutter alignment exact. The tokenizer guarantees
 * its spans concatenate back to the input, so nothing shifts even mid-keystroke.
 */

export const PmlCodeEditor = forwardRef<PmlCodeEditorHandle, PmlCodeEditorProps>(function PmlCodeEditor(
  { value, onChange, disabled = false, className, ariaLabel = 'Page PML source', diagnostics = [], onSelectionEdit, onScaffold, pageId, completionApi, completionEnabled, onFixError, reviewOverlay, onCaret },
  ref,
) {
  // An assistant's diff is being reviewed inside the frame: freeze the editor and hide its own affordances so
  // nothing pokes through the overlay or edits the buffer behind it.
  const reviewing = !!reviewOverlay;
  const taRef = useRef<HTMLTextAreaElement>(null);
  const preInnerRef = useRef<HTMLDivElement>(null);
  const gutterInnerRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const squiggleInnerRef = useRef<HTMLDivElement>(null);
  const ghostInnerRef = useRef<HTMLDivElement>(null);
  const fixLayerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  // The caret target to apply after an accepted ghost-text insertion, once the controlled value updates.
  const pendingCaret = useRef<number | null>(null);

  const [activeLine, setActiveLine] = useState(0);
  const activeLineRef = useRef(0);
  // The caret's absolute offset, for inline autocomplete (the ghost position + the completion request).
  const [caret, setCaret] = useState(0);
  // One monospace character's width, measured once. Seeded with a close default so squiggles map
  // sensibly on the very first paint, then corrected from the real rendered font.
  const [charW, setCharW] = useState(7.8);
  // Cmd-K selection edit: the current non-empty selection range, and the inline instruction box.
  const [selRange, setSelRange] = useState<{ start: number; end: number } | null>(null);
  const [kbarOpen, setKbarOpen] = useState(false);
  const [kbarValue, setKbarValue] = useState('');

  const tokens = useMemo(() => tokenizePml(value), [value]);
  const lineCount = useMemo(() => value.split('\n').length, [value]);

  const { lineSeverity, activeDiagnostic, errorLines, commentLine } = useCodeEditorFacts(value, diagnostics, activeLine);

  // Inline autocomplete: a ghost-text completion for the caret (debounced, context-aware). Off unless
  // the pane provides a pageId and a completion call and turns it on; the ghost is accepted with Tab (see handleKeyDown).
  const { assistantName } = useBuilderHost();
  const vars = useOwnVars();
  const { suggestion, clear: clearSuggestion } = usePmlCompletion(
    completionApi ?? NO_COMPLETION,
    pageId ?? '',
    value,
    caret,
    // Off on a comment line: there the ✨ Scaffold pill owns the interaction, so ghost text does not
    // compete with it (and never tries to "complete" an instruction into a whole block). Off while a
    // diff is under review (the editor is frozen).
    !!pageId && !!completionApi && !!completionEnabled && !disabled && !commentLine && !reviewing,
  );

  // Where the ghost sits: the caret's 0-based line/col, so it renders right after the caret.
  const ghostPos = useMemo(() => {
    if (!suggestion) return null;

    const before = value.slice(0, caret);
    let line = 0;
    let lastNl = -1;
    for (let i = 0; i < before.length; i++) {
      if (before[i] === '\n') {
        line++;
        lastNl = i;
      }
    }

    return { line, col: before.length - (lastNl + 1) };
  }, [suggestion, value, caret]);

  // Keep the highlight layer, gutter, and active band locked to the textarea's scroll and caret.
  // Written imperatively (refs, not state) so a scroll never triggers a React render.
  const sync = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const top = ta.scrollTop;
    const left = ta.scrollLeft;

    if (preInnerRef.current) preInnerRef.current.style.transform = `translate(${-left}px, ${-top}px)`;
    if (squiggleInnerRef.current) squiggleInnerRef.current.style.transform = `translate(${-left}px, ${-top}px)`;
    if (ghostInnerRef.current) ghostInnerRef.current.style.transform = `translate(${-left}px, ${-top}px)`;
    if (gutterInnerRef.current) gutterInnerRef.current.style.transform = `translateY(${-top}px)`;
    if (fixLayerRef.current) fixLayerRef.current.style.transform = `translateY(${-top}px)`;
    if (bandRef.current) {
      bandRef.current.style.transform = `translateY(${PAD + activeLineRef.current * LINE - top}px)`;
    }
  }, []);

  // Measure the real character width once (a 100-char run in the editor's exact font), so the
  // squiggle rects sit under the right columns regardless of platform font rendering.
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const w = el.getBoundingClientRect().width / 100;
    if (w > 0 && Math.abs(w - charW) > 0.01) setCharW(w);
  }, [charW]);

  // Which line the caret is on: the count of newlines before it.
  // The latest caret listener, read by the stable syncCaret below (never a stale one from the first render).
  const onCaretRef = useRef(onCaret);

  useEffect(() => {
    onCaretRef.current = onCaret;
  });

  const syncCaret = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    const before = ta.value.slice(0, ta.selectionStart);
    let line = 0;
    for (let idx = 0; idx < before.length; idx++) {
      if (before[idx] === '\n') line++;
    }
    activeLineRef.current = line;
    setActiveLine(line);
    setCaret(ta.selectionStart);
    onCaretRef.current?.(ta.selectionStart);

    // Track a non-empty (non-whitespace) selection for the Cmd-K affordance.
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    setSelRange((prev) => {
      if (end > start && ta.value.slice(start, end).trim() !== '') {
        return prev && prev.start === start && prev.end === end ? prev : { start, end };
      }
      return null;
    });
  }, []);

  // Let the Problems panel jump the caret to a diagnostic. Clamps to the buffer, focuses, and
  // centres the target line so the underlined element is actually on screen. (Declared after
  // sync/syncCaret so it can reference them without a temporal-dead-zone error.)
  useImperativeHandle(
    ref,
    () => ({
      jumpTo: (line: number, col: number) => {
        const ta = taRef.current;
        if (!ta) return;

        const lines = ta.value.split('\n');
        const target = Math.min(Math.max(line, 1), lines.length);
        let offset = 0;
        for (let i = 0; i < target - 1; i++) offset += lines[i].length + 1;
        const column = Math.min(Math.max(col - 1, 0), lines[target - 1]?.length ?? 0);
        offset += column;

        ta.focus();
        ta.setSelectionRange(offset, offset);
        ta.scrollTop = Math.max(0, (target - 1) * LINE - ta.clientHeight / 2 + LINE);
        // Across too: focusing scrolls to where the caret last was (often the end of a long line), and
        // setting the caret elsewhere does not scroll back, so the line jumped to sat off to the left.
        const x = column * charW;
        const visible = ta.clientWidth - GUTTER - GAP - PAD;

        if (x < ta.scrollLeft || x > ta.scrollLeft + visible) ta.scrollLeft = Math.max(0, x - visible / 3);
        syncCaret();
        sync();
      },
    }),
    [sync, syncCaret, charW],
  );

  // Reapply positions after any render (value change, active-line change) and on mount.
  useLayoutEffect(() => {
    sync();
  });

  // After an accepted ghost-text insertion (Tab), move the caret to the end of the inserted text once
  // the controlled value has updated. Declared after syncCaret so it can call it without a TDZ error.
  useLayoutEffect(() => {
    if (pendingCaret.current !== null && taRef.current) {
      const p = pendingCaret.current;
      pendingCaret.current = null;
      taRef.current.selectionStart = p;
      taRef.current.selectionEnd = p;
      syncCaret();
    }
  });

  // Close the Cmd-K box when the selection is lost (clicking away, typing over it).
  useEffect(() => {
    if (!selRange) setKbarOpen(false);
  }, [selRange]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    syncCaret();
    clearSuggestion(); // typing dismisses the current ghost immediately
  };

  const submitSelectionEdit = () => {
    if (!selRange || !onSelectionEdit) return;
    const text = kbarValue.trim();
    if (text.length < 3) return;
    onSelectionEdit(value.slice(selRange.start, selRange.end), { start: selRange.start, end: selRange.end }, text);
    setKbarOpen(false);
    setKbarValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Inline autocomplete: Tab accepts the ghost (splice at the caret), Escape dismisses it. Only when
    // a suggestion is showing, so Tab/Escape behave normally otherwise.
    if (suggestion) {
      if (e.key === 'Tab') {
        e.preventDefault();
        const ta = taRef.current;
        if (ta) {
          const pos = ta.selectionStart;
          pendingCaret.current = pos + suggestion.length;
          onChange(value.slice(0, pos) + suggestion + value.slice(pos));
          clearSuggestion();
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        clearSuggestion();
        return;
      }
    }

    // Cmd/Ctrl-K on a non-empty selection opens the inline edit box; otherwise it passes through.
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K') && onSelectionEdit && selRange) {
      e.preventDefault();
      setKbarValue('');
      setKbarOpen(true);
    }
  };

  return (
    <div
      className={cx(
        'relative overflow-hidden rounded-xl border border-[var(--pb-border)] bg-white/70 text-[var(--pb-text)] backdrop-blur',
        disabled && 'opacity-60',
        className,
      )}
      style={vars}
    >
      {/* Active-line band: a full-width row tint behind everything. */}
      <div
        ref={bandRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 bg-slate-900/[0.05]"
        style={{ height: LINE }}
      />

      {/* Highlight layer: starts after the gutter and clips there, so nothing slides under it. */}
      <pre
        aria-hidden
        className="pointer-events-none absolute bottom-0 right-0 top-0 z-[1] m-0 overflow-hidden"
        style={{ ...TEXT_METRICS, left: GUTTER, padding: `${PAD}px ${PAD}px ${PAD}px ${GAP}px` }}
      >
        <div ref={preInnerRef}>
          {tokens.map((tok, idx) => (
            <span key={idx} className={TOKEN_CLASS[tok.type]}>
              {tok.value}
            </span>
          ))}
        </div>
      </pre>

      <CodeEditorLayers
        diagnostics={diagnostics}
        charW={charW}
        squiggleRef={squiggleInnerRef}
        suggestion={reviewing ? null : suggestion}
        ghostPos={ghostPos}
        ghostRef={ghostInnerRef}
      />

      {/* Off-screen ruler: a 100-char run in the editor font, measured once for the column width. */}
      <span ref={measureRef} aria-hidden className="pointer-events-none opacity-0" style={{ ...TEXT_METRICS, position: 'absolute', top: -9999, left: -9999 }}>
        {'0'.repeat(100)}
      </span>

      {/* The real input, transparent text with a visible caret, on top. */}
      <textarea
        ref={taRef}
        value={value}
        onChange={handleChange}
        onScroll={sync}
        onClick={syncCaret}
        onKeyUp={syncCaret}
        onKeyDown={handleKeyDown}
        onSelect={syncCaret}
        disabled={disabled}
        readOnly={reviewing}
        tabIndex={reviewing ? -1 : undefined}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        wrap="off"
        // A named field, so the browser's form checks (autofill, the "form field should have an id or name"
        // issue) can tell what it is.
        name="pml-code"
        aria-label={ariaLabel}
        className="absolute inset-0 z-[2] resize-none overflow-auto bg-transparent text-transparent outline-none"
        style={{
          ...TEXT_METRICS,
          padding: `${PAD}px ${PAD}px ${PAD}px ${GUTTER + GAP}px`,
          caretColor: 'var(--pb-text)',
        }}
      />

      {/* Line-number gutter: transparent background, so the active band tints its number too. */}
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 top-0 z-[3] select-none overflow-hidden border-r border-[color-mix(in_srgb,var(--pb-border)_60%,transparent)]"
        style={{ width: GUTTER }}
      >
        <div ref={gutterInnerRef} style={{ ...TEXT_METRICS, padding: `${PAD}px 6px ${PAD}px 0`, textAlign: 'right' }}>
          {Array.from({ length: lineCount }, (_, idx) => {
            const sev = lineSeverity.get(idx + 1);
            return (
              <div
                key={idx}
                className={
                  sev === 'error'
                    ? 'font-semibold text-red-500'
                    : sev === 'warning'
                      ? 'font-semibold text-amber-500'
                      : idx === activeLine
                        ? 'font-medium text-[var(--pb-text)]'
                        : 'text-[color-mix(in_srgb,var(--pb-muted)_60%,transparent)]'
                }
                style={{ height: LINE }}
              >
                {idx + 1}
              </div>
            );
          })}
        </div>
      </div>

      {reviewing ? null : (
        <CodeEditorAffordances
          assistantName={assistantName?.trim() || undefined}
          errorLines={errorLines}
          onFixError={onFixError}
          fixLayerRef={fixLayerRef}
          activeDiagnostic={activeDiagnostic}
          selectionEdit={
            onSelectionEdit && selRange ? { open: kbarOpen, value: kbarValue, onValue: setKbarValue, onOpen: setKbarOpen, onSubmit: submitSelectionEdit } : null
          }
          scaffold={onScaffold && commentLine && !selRange ? { commentLine, onScaffold } : null}
        />
      )}

      {/* Review overlay: the assistant's diff, mounted INSIDE the editor frame (fills it, above every layer)
          so a proposed change is reviewed in the same box - not a duplicate editor stacked above it. */}
      {reviewing ? (
        <div className="absolute inset-0 z-[6]" data-testid="pml-review-overlay">
          {reviewOverlay}
        </div>
      ) : null}
    </div>
  );
});
