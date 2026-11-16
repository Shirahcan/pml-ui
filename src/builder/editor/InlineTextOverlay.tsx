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

  return (
    <textarea
      ref={box}
      aria-label="Edit this text"
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
      style={{ ...edit.rect, ...edit.font, position: 'absolute', zIndex: 20, resize: 'none', overflow: 'hidden', padding: 0, border: 0, background: 'var(--site-bg)' }}
      className="rounded-sm outline outline-2 outline-offset-2 outline-[var(--site-accent)]"
    />
  );
}
