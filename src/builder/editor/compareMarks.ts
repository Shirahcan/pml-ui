import { findPathByUid, renderedPathFor, type PmlNode } from '../../language';
import type { DocumentVersionChange } from '../document';
import { pathElement } from './pathElement';

/** The attribute a compare pane marks a changed element with: `removed`, `added` or `changed`. */
export const COMPARE_MARK = 'data-compare-mark';
/** The element the person picked in the list of changes. */
export const COMPARE_FOCUS = 'data-compare-focus';

/**
 * The marks' colours. An outline on the element itself (never a box around it), so the design keeps its layout: red
 * is only in the version, green only in the editor, amber dashed is in both but differs.
 */
export const COMPARE_STYLES = `
[${COMPARE_MARK}] { outline-offset: 3px; }
[${COMPARE_MARK}="removed"] { outline: 2px solid #DC2626; background-color: rgb(220 38 38 / 0.07); }
[${COMPARE_MARK}="added"] { outline: 2px solid #16A34A; background-color: rgb(22 163 74 / 0.07); }
[${COMPARE_MARK}="changed"] { outline: 2px dashed #D97706; }
[${COMPARE_FOCUS}] { outline-width: 3px; box-shadow: 0 0 0 6px rgb(67 97 238 / 0.28); }
`;

/** Which side shows which changes: the version holds what was removed, the editor what was added; both show a change. */
export function shownOn(side: 'version' | 'editor', how: DocumentVersionChange['how']): boolean {
  return how === 'changed' || (side === 'version' ? how === 'removed' : how === 'added');
}

/**
 * The drawn element for `uid` in one pane, or null when that side does not hold it. A top-level element is its whole
 * section; a nested one is found by its rendered path. An element the canvas cannot reach on its own (inside a
 * component, whose insides belong to its design) is shown by the nearest part that IS drawn.
 */
export function elementForUid(root: HTMLElement, nodes: PmlNode[], uid: string): HTMLElement | null {
  const path = findPathByUid(nodes, uid);
  if (!path) return null;

  for (let depth = path.length; depth >= 1; depth -= 1) {
    const at = path.slice(0, depth);
    const element =
      at.length === 1
        ? root.querySelector<HTMLElement>(`[data-compare-section="${at[0]}"]`)
        : pathElement(root.querySelector(`[data-pml-path="${renderedPathFor(nodes, at).join('.')}"]`));
    if (element) return element;
  }

  return null;
}

/** Marks every change this side shows, clearing the marks of an earlier compare first. */
export function markPane(root: HTMLElement, nodes: PmlNode[], changes: DocumentVersionChange[], side: 'version' | 'editor'): void {
  root.querySelectorAll(`[${COMPARE_MARK}]`).forEach((element) => element.removeAttribute(COMPARE_MARK));

  for (const change of changes) {
    if (!shownOn(side, change.how)) continue;
    elementForUid(root, nodes, change.uid)?.setAttribute(COMPARE_MARK, change.how);
  }
}

/** Scrolls a pane so `element` sits a quarter of the way down it. */
export function scrollPaneTo(pane: HTMLElement, element: HTMLElement): void {
  const top = element.getBoundingClientRect().top - pane.getBoundingClientRect().top + pane.scrollTop - pane.clientHeight / 4;
  pane.scrollTo?.({ top: Math.max(top, 0), behavior: 'smooth' });
}

/**
 * Scrolls a pane to where an element the OTHER side holds would be: the same share of the way down. A removed FAQ
 * has no place in the editor, so the editor shows the part of the page it used to sit in.
 */
export function scrollPaneAlong(pane: HTMLElement, from: HTMLElement, element: HTMLElement): void {
  const share = (element.getBoundingClientRect().top - from.getBoundingClientRect().top + from.scrollTop) / Math.max(from.scrollHeight, 1);
  pane.scrollTo?.({ top: Math.max(share * pane.scrollHeight - pane.clientHeight / 4, 0), behavior: 'smooth' });
}
