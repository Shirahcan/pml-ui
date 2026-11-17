import { getNodeAtPath, updateNodeAtPath, type PmlNode } from '../../language';
import type { DocumentLayout, DocumentLayoutPart } from '../document';

/**
 * What a document's layout says about one element (owner 2026-11-17, T2): which part it is, how many of that part the
 * document holds, whether it may go, and where a repeat instance may move. One place, so the canvas frame, the
 * settings panel and the selection bar can never disagree about what may be deleted or moved.
 */

/** The layout part a node names with `part`, if the layout has it. */
export function partOf(layout: DocumentLayout | null | undefined, key: unknown): DocumentLayoutPart | undefined {
  return typeof key === 'string' ? layout?.parts.find((part) => part.key === key) : undefined;
}

/** Every element marked as part `key`, anywhere in the tree (a repeat may be nested: FAQs inside the FAQ). */
export function instancePaths(nodes: PmlNode[], key: string): number[][] {
  const out: number[][] = [];
  const walk = (list: PmlNode[], base: number[]) =>
    list.forEach((node, i) => {
      const path = [...base, i];
      if (node.part === key) out.push(path);
      if (node.children) walk(node.children, path);
    });
  walk(nodes, []);

  return out;
}

/**
 * Whether the element at `path` may be deleted. Its OWN part decides first: a locked part never goes, and a part keeps
 * at least its minimum (one, when the post cannot do without it). An element that is no part of its own goes unless a
 * part around it is locked (the opening's pieces). Deleting the header or the cover just breaks the post.
 */
export function canDelete(nodes: PmlNode[], layout: DocumentLayout | null | undefined, path: number[]): boolean {
  const node = getNodeAtPath(nodes, path);
  const own = partOf(layout, node?.part);

  if (own) {
    if (own.locked) return false;

    return instancePaths(nodes, own.key).length > Math.max(own.min ?? 0, own.required ? 1 : 0);
  }

  for (let depth = 1; depth < path.length; depth++) {
    if (partOf(layout, getNodeAtPath(nodes, path.slice(0, depth))?.part)?.locked) return false;
  }

  return true;
}

/** The position of the nearest sibling before (-1) or after (+1) the element that is the same part, or null. */
export function neighbourInstance(nodes: PmlNode[], path: number[], direction: -1 | 1): number | null {
  const node = getNodeAtPath(nodes, path);
  if (typeof node?.part !== 'string') return null;

  const siblings = path.length > 1 ? (getNodeAtPath(nodes, path.slice(0, -1))?.children ?? []) : nodes;
  for (let i = path[path.length - 1] + direction; i >= 0 && i < siblings.length; i += direction) {
    if (siblings[i].part === node.part) return i;
  }

  return null;
}

/**
 * The element at `path` and its sibling at `other` change places. A swap, not a move, so whatever sits between them (a
 * part's Purpose note) stays where it is and each note keeps introducing a question section.
 */
export function swapSiblings(nodes: PmlNode[], path: number[], other: number): PmlNode[] {
  const parentPath = path.slice(0, -1);
  const at = path[path.length - 1];
  const siblings = [...(parentPath.length > 0 ? (getNodeAtPath(nodes, parentPath)?.children ?? []) : nodes)];

  [siblings[at], siblings[other]] = [siblings[other], siblings[at]];

  if (parentPath.length === 0) return siblings;

  const parent = getNodeAtPath(nodes, parentPath);

  return parent ? updateNodeAtPath(nodes, parentPath, { ...parent, children: siblings }) : nodes;
}
