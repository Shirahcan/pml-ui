'use client';

import React, { useRef, useState } from 'react';

import { getNodeAtPath, holdsWords, renderedPathFor, sourcePathFor } from '../../language';
import type { PmlNode } from '../../language';
import { componentTextField, fontOf, InlineTextOverlay, inlineField, type InlineEdit } from './InlineTextOverlay';
import { InlineWordsOverlay, type InlineWordsEdit } from './InlineWordsOverlay';
import { canEditVisually } from './ParagraphEditor';
import { pathElement } from './pathElement';

export interface QuickEditOptions {
  nodes: PmlNode[];
  canvas: React.RefObject<HTMLDivElement | null>;
  onEditText?: (path: number[], field: string, value: string) => void;
  /** A paragraph's new words (its children), from the rich editor in place. */
  onEditWords?: (path: number[], children: PmlNode[]) => void;
  /** Text inside components and rich paragraphs too, not only plain headings, paragraphs and buttons. */
  quickEditAll: boolean;
  onQuickEdit?: (editing: boolean) => void;
}

/** Run-level tags: a paragraph's own words, never a wrapper around it. */
const RUN_TAGS = new Set(['SPAN', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'A', 'CODE', 'MARK', 'SMALL', 'BR', 'SUB', 'SUP']);

/**
 * The element a block of words renders as. A nested block is marked by its `data-pml-path` holder; a TOP-LEVEL one has
 * no mark (its section is the mark, as PmlCanvas finds a section's tools), so it is the first element its section
 * draws, past any wrapper around it. Without this a paragraph straight on the page, which is most of an email, could
 * never be quick-edited (found in the email designer's tests, 2026-11-17).
 */
function wordsElement(root: HTMLElement, nodes: PmlNode[], path: number[]): HTMLElement | null {
  if (path.length > 1) return pathElement(root.querySelector(`[data-pml-path="${renderedPathFor(nodes, path).join('.')}"]`));

  const section = root.querySelector(`[data-pml-section="${path[0]}"]`);
  let element: HTMLElement | null = section ? (drawn(section)[0] ?? null) : null;

  while (element && element.tagName !== 'P') {
    const inside = drawn(element);

    if (inside.length !== 1 || RUN_TAGS.has(inside[0].tagName)) break;
    element = inside[0];
  }

  return element;
}

/** Tags that draw nothing (a section's own `<style>` comes first): never the element a reader sees. */
const NOT_DRAWN = new Set(['STYLE', 'SCRIPT', 'TEMPLATE', 'LINK', 'META', 'NOSCRIPT']);

function drawn(parent: Element): HTMLElement[] {
  return [...parent.children].filter((child) => !NOT_DRAWN.has(child.tagName)) as HTMLElement[];
}

/**
 * The outermost element holding the words at `path`. A click lands on a run (`text`) or a bold or a link inside a
 * paragraph, so climb past those to the paragraph, and stop at the first container above it.
 */
function wordsHolder(nodes: PmlNode[], path: number[]): number[] | null {
  let found: number[] | null = null;

  for (let at = path; at.length > 0; at = at.slice(0, -1)) {
    const node = getNodeAtPath(nodes, at);

    if (node && holdsWords(node)) found = at;
    else if (found) break;
  }

  return found;
}

/**
 * Double-click to edit words where they sit (S4-05, widened by post layouts E1/E2). Plain text gets a plain box,
 * a paragraph with bold, links or page data gets the rich editor, and a component's words edit the one prop they
 * come from. The covered element is hidden meanwhile so the box can be see-through.
 */
export function useQuickEdit({ nodes, canvas, onEditText, onEditWords, quickEditAll, onQuickEdit }: QuickEditOptions): {
  start: (event: React.MouseEvent, index: number) => void;
  overlay: React.ReactNode;
} {
  const [text, setText] = useState<InlineEdit | null>(null);
  const [words, setWords] = useState<InlineWordsEdit | null>(null);
  const covered = useRef<HTMLElement | null>(null);

  const end = () => {
    if (covered.current) covered.current.style.visibility = '';
    covered.current = null;
    setText(null);
    setWords(null);
    onQuickEdit?.(false);
  };

  const cover = (element: Element) => {
    if (!(element instanceof HTMLElement)) return;
    element.style.visibility = 'hidden';
    covered.current = element;
  };

  const rectOf = (element: Element) => {
    const box = element.getBoundingClientRect();
    const frame = canvas.current!.getBoundingClientRect();

    return { top: box.top - frame.top, left: box.left - frame.left, width: box.width, height: box.height };
  };

  const start = (event: React.MouseEvent, index: number) => {
    if (!canvas.current || (!onEditText && !onEditWords)) return;

    const target = event.target as HTMLElement;
    const holder = target.closest<HTMLElement>('[data-pml-path]');
    const path = sourcePathFor(nodes, holder?.dataset.pmlPath?.split('.').map(Number) ?? [index]);
    const node = getNodeAtPath(nodes, path);

    // A paragraph with rich words: the rich editor, over the whole paragraph.
    const paragraph = quickEditAll && onEditWords ? wordsHolder(nodes, path) : null;
    const paragraphNode = paragraph ? getNodeAtPath(nodes, paragraph) : null;

    // Words held as children only: a heading or text whose words are a prop keeps the plain box below. A list item's
    // nested list is not words: it is left out of the editor and put back after them on commit (pml-kit 0.25.0).
    const all = paragraphNode?.children ?? [];
    const held = all.filter((child) => child.primitive !== 'list');
    const tail = all.filter((child) => child.primitive === 'list');

    if (paragraph && held.length > 0 && canEditVisually(held)) {
      const element = wordsElement(canvas.current, nodes, paragraph);

      if (element) {
        setWords({ path: paragraph, words: held, tail, rect: rectOf(element), font: fontOf(element) });
        cover(element);
        onQuickEdit?.(true);

        return;
      }
    }

    if (!onEditText) return;

    let field = inlineField(node);
    let element: Element | null | undefined = target.closest('h1, h2, h3, h4, h5, h6, p, a, button') ?? holder?.firstElementChild;

    // Inside a component: the innermost element under the pointer whose words are one of its props.
    if (!field && quickEditAll && node?.component) {
      const section = target.closest('[data-pml-section]');

      for (let at: HTMLElement | null = target; at && at !== section; at = at.parentElement) {
        field = componentTextField(node, at.textContent ?? '');

        if (field) {
          element = at;
          break;
        }
      }
    }

    if (!field || !element) return;

    setText({ path, field, value: String(((node?.props ?? {}) as Record<string, unknown>)[field] ?? ''), rect: rectOf(element), font: fontOf(element) });
    cover(element);
    onQuickEdit?.(true);
  };

  const overlay = text ? (
    <InlineTextOverlay
      key={text.path.join('.')}
      edit={text}
      onCancel={end}
      onCommit={(value) => {
        if (value !== text.value) onEditText?.(text.path, text.field, value);
        end();
      }}
    />
  ) : words ? (
    <InlineWordsOverlay
      key={words.path.join('.')}
      edit={words}
      onCancel={end}
      onCommit={(children) => {
        onEditWords?.(words.path, [...children, ...(words.tail ?? [])]);
        end();
      }}
    />
  ) : null;

  return { start, overlay };
}
