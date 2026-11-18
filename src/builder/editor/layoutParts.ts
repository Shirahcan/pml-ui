import { getNodeAtPath, isCommentNode, updateNodeAtPath, type PmlNode } from '../../language';
import type { DocumentLayout, DocumentLayoutPart } from '../document';

/**
 * What a document's layout says about one element (owner 2026-11-17, T2): which part it is and how many of that part
 * the document holds. Every element may be deleted and moved (owner 2026-11-18: no element is locked); the layout's
 * rules are the publish checks. One place, so the canvas frame, the settings panel and the selection bar agree.
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
 * Whether the element at `path` may be deleted: always (owner 2026-11-18: "don't lock any element/component; admins
 * should be able to modify/remove/etc every element"). The template's rules (a part the post needs, a repeat's
 * minimum) are CHECKS a document runs before it is published, never locks in the designer. Kept as a function so every
 * caller asks one place, should a product ever need a rule again.
 */
export function canDelete(_nodes: PmlNode[], _layout: DocumentLayout | null | undefined, _path: number[]): boolean {
  return true;
}

/** Whether the element at `path` may be moved or dragged: always, for the same reason as {@link canDelete}. */
export function canReorder(_nodes: PmlNode[], _layout: DocumentLayout | null | undefined, _path: number[]): boolean {
  return true;
}

/**
 * One step up (-1) or down (+1) for the element at `path`, or null at an edge: it changes places with its nearest
 * sibling that is not a comment (a comment draws nothing on the canvas, so a step past one would look like nothing
 * happened). Every element moves, a template part too; where a part belongs is the publish checks' advice
 * (layout.outside_range), never a refusal here (owner 2026-11-18). One rule for the selection bar and the panel.
 */
export function reorder(
  nodes: PmlNode[],
  _layout: DocumentLayout | null | undefined,
  path: number[],
  direction: -1 | 1,
): { nodes: PmlNode[]; path: number[] } | null {
  const siblings = path.length > 1 ? (getNodeAtPath(nodes, path.slice(0, -1))?.children ?? []) : nodes;
  let to = path[path.length - 1] + direction;

  while (to >= 0 && to < siblings.length && isCommentNode(siblings[to])) to += direction;
  if (to < 0 || to >= siblings.length || !getNodeAtPath(nodes, path)) return null;

  return { nodes: swapSiblings(nodes, path, to), path: [...path.slice(0, -1), to] };
}

/** Whether the element can move at all (it has a sibling to change places with). */
export function movable(nodes: PmlNode[], layout: DocumentLayout | null | undefined, path: number[]): boolean {
  return reorder(nodes, layout, path, -1) !== null || reorder(nodes, layout, path, 1) !== null;
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
