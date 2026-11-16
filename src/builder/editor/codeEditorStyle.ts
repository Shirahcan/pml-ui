import type React from 'react';

import type { PmlCompletionApi, PmlEditContext } from '../../pml/completion';
import type { PmlDiagnostic } from '../../pml/diagnostics';
import type { PmlTokenType } from '../../language';

/* The code editor's geometry, token colours and props (shared program E4a4f2, split from PmlCodeEditor). */

export const LINE = 20; // line box height, px (must match lineHeight below)
export const PAD = 12; // top / right / bottom padding, px
export const GUTTER = 44; // line-number column width, px
export const GAP = 12; // space between the gutter and the code, px

// A wavy underline as a tiny repeating SVG, tinted per severity. Encoded so the `#` in the colour
// survives the data URI. red = error, amber = warning; both read on the light and dark editor.
const SQUIGGLE_COLOR: Record<PmlDiagnostic['severity'], string> = { error: '#ef4444', warning: '#f59e0b' };

export const squiggle = (severity: PmlDiagnostic['severity']): string =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='6' height='3'><path d='M0 2.5 L1.5 0.5 L3 2.5 L4.5 0.5 L6 2.5' fill='none' stroke='${SQUIGGLE_COLOR[severity]}' stroke-width='1'/></svg>`,
  )}")`;

// The shared text metrics. Applied verbatim to BOTH the textarea and the <pre> so they lay out
// identically. Only the left padding differs (the textarea spans the gutter; the pre starts after it).
export const TEXT_METRICS: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  fontSize: '13px',
  lineHeight: `${LINE}px`,
  tabSize: 2,
  whiteSpace: 'pre',
  wordBreak: 'normal',
  overflowWrap: 'normal',
  letterSpacing: 'normal',
};

// Token colour, theme-aware. `plain` inherits the container foreground; `state` (the reactive root)
// is deliberately distinct from a baked binding so the two reading models stay visually separate.
export const TOKEN_CLASS: Record<PmlTokenType, string> = {
  plain: '',
  punct: 'text-slate-400',
  tag: 'text-sky-600',
  attr: 'text-violet-600',
  string: 'text-emerald-600',
  number: 'text-amber-600',
  keyword: 'text-rose-600',
  state: 'text-fuchsia-600 font-medium',
  binding: 'text-teal-600',
  operator: 'text-slate-500',
  comment: 'italic text-slate-400',
  // An unquoted attribute value: Apply refuses it, so it is marked before then. An underline never
  // changes a glyph's width, so the caret overlay stays aligned.
  error: 'text-red-600 underline decoration-wavy decoration-red-500',
};

export interface PmlCodeEditorHandle {
  /** Move the caret to a 1-based (line, col), focus the editor, and scroll the line into view. */
  jumpTo: (line: number, col: number) => void;
}

export interface PmlCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  diagnostics?: PmlDiagnostic[];
  /**
   * Cmd-K selection edit: called with the selected text, its char range, and the instruction. When
   * omitted, the selection affordance is not shown (so a plain editor stays plain).
   */
  onSelectionEdit?: (selectionText: string, range: { start: number; end: number }, instruction: string) => void;
  /**
   * "Scaffold with <assistant>" from a comment line: called with the comment's 1-based line, the extracted
   * instruction text, and whether it is a PML or PSL comment. When omitted, no scaffold pill is shown.
   */
  onScaffold?: (params: { line: number; comment: string; context: PmlEditContext }) => void;
  /** The page id, for inline autocomplete requests. When omitted, ghost-text autocomplete is off. */
  pageId?: string;
  /** The host's completion call (the adapter's `assistant.complete`). When omitted, ghost-text autocomplete is off. */
  completionApi?: PmlCompletionApi;
  /** Turns inline ghost-text autocomplete ON (the pane enables it once the source has loaded). */
  completionEnabled?: boolean;
  /**
   * "Fix with <assistant>" from an error line's gutter: called with the error's 1-based line + its message.
   * When omitted, no gutter fix button is shown.
   */
  onFixError?: (line: number, message: string) => void;
  /**
   * A review overlay (the assistant's diff) rendered INSIDE the editor frame - same box, same size - so a
   * proposed change is reviewed in place rather than in a second stacked panel. While it is present the
   * editor is read-only and its own affordances (ghost text, Cmd-K, scaffold + fix pills) are hidden.
   */
  reviewOverlay?: React.ReactNode;
  /** Where the caret is (a char offset), each time it moves: the Studio selects the element it sits in. */
  onCaret?: (offset: number) => void;
}

