'use client';

import React, { useEffect, useRef, useState } from 'react';

import type { PmlNode } from '../../language';

/** Which prop a double-click edits. Rich text stays in the panel, where its toolbar is. */
export function inlineField(node: PmlNode | null): string | null {
  if (!node || node.component) return null;

  const props = (node.props ?? {}) as Record<string, unknown>;
  const field = node.primitive === 'heading' ? 'text' : node.primitive === 'button' ? 'label' : node.primitive === 'text' ? 'value' : null;

  return field !== null && typeof (props[field] ?? '') === 'string' && props.doc === undefined ? field : null;
}

/** Words as a reader sees them: runs of white space collapsed, the ends trimmed. */
const words = (value: string): string => value.replace(/\s+/g, ' ').trim();

/**
 * Which of a component's own props a double-click on `text` edits (post layouts E1, owner 2026-11-16: "double
 * clicking on any element with text"). Only words that ARE one prop's value map back: words fixed in the
 * component's design belong to every page that uses it, and words mixed from several props have no single
 * home, so both stay with the panel. Exactly one match or none: two props holding the same words are
 * ambiguous, and a guess would change the wrong one.
 */
export function componentTextField(node: PmlNode | null, text: string): string | null {
  if (!node?.component) return null;

  const said = words(text);

  if (said === '') return null;

  const props = (node.props ?? {}) as Record<string, unknown>;
  const matches = Object.keys(props).filter((key) => typeof props[key] === 'string' && words(props[key] as string) === said);

  return matches.length === 1 ? matches[0] : null;
}

/**
 * The surface every quick edit types on (owner 2026-11-16: "The quick edit text field should use an opaque background
 * (e.g. white) - currently looks broken when it overlaps adjacent elements"). Solid white with dark words, whatever
 * the section's colours: a see-through box let the words below show through wherever the edit grew over them, and the
 * page colour alone turned white words on a banner white on white. The element's own type (font, size, weight,
 * spacing, alignment) is kept, only the colours are the editor's.
 */
export const EDIT_SURFACE: React.CSSProperties = { background: '#ffffff', color: '#0f172a', boxShadow: '0 10px 30px -12px rgba(15, 23, 42, 0.45)' };

export interface InlineEdit {
  path: number[];
  field: string;
  value: string;
  rect: { top: number; left: number; width: number; height: number };
  font: React.CSSProperties;
}

/** The text styles an overlay copies, so typing looks exactly like the element it covers. */
export function fontOf(element: Element): React.CSSProperties {
  const css = getComputedStyle(element);

  return {
    fontFamily: css.fontFamily,
    fontSize: css.fontSize,
    fontWeight: css.fontWeight,
    lineHeight: css.lineHeight,
    letterSpacing: css.letterSpacing,
    textAlign: css.textAlign as React.CSSProperties['textAlign'],
    color: css.color,
  };
}

/**
 * Edit text where it sits: a text box laid exactly over the element, in the element's own type. Enter
 * or clicking away keeps the words, Escape leaves them as they were, and Shift+Enter adds a line.
 */
export function InlineTextOverlay({
  edit,
  onCommit,
  onCancel,
}: {
  edit: InlineEdit;
  onCommit: (value: string) => void;
  onCancel: () => void;
}): React.JSX.Element {
  const box = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(edit.value);
  const finished = useRef(false);

  // One ending only: Enter must not depend on a blur, which never fires in an unfocused window.
  const finish = (keep: boolean) => {
    if (finished.current) return;

    finished.current = true;

    if (keep) onCommit(value);
    else onCancel();
  };

  useEffect(() => {
    box.current?.focus();
    box.current?.select();
  }, []);

  // The box grows with the words (never below the element's own height), so nothing typed is ever clipped.
  useEffect(() => {
    const el = box.current;

    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(edit.rect.height, el.scrollHeight)}px`;
  }, [value, edit.rect.height]);

  return (
    <textarea
      ref={box}
      aria-label="Edit this text"
      // One row, so the height measured below starts at one line (a textarea's default of two left an empty line).
      rows={1}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        event.stopPropagation();

        if (event.key === 'Escape') finish(false);

        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          finish(true);
        }
      }}
      style={{ ...edit.rect, ...edit.font, ...EDIT_SURFACE, position: 'absolute', zIndex: 20, resize: 'none', overflow: 'hidden', padding: 0, border: 0 }}
      className="rounded-sm outline outline-2 outline-offset-2 outline-[var(--site-accent)]"
    />
  );
}
