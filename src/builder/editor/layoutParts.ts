import { getNodeAtPath, isCommentNode, updateNodeAtPath, type PmlNode } from '../../language';
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

/**
 * Whether the element at `path` may be dragged or moved freely (the frame's Move up / Move down, a drag in Layers). A
 * template part keeps its place (moving the cover or the contents breaks the post's order and starts a layout
 * finding), and so does anything inside a locked part (the opening's pieces). A repeat instance moves with its
 * selection bar's Up / Down, among its own kind only.
 */
export function canReorder(nodes: PmlNode[], layout: DocumentLayout | null | undefined, path: number[]): boolean {
  if (partOf(layout, getNodeAtPath(nodes, path)?.part)) return false;

  for (let depth = 1; depth < path.length; depth++) {
    if (partOf(layout, getNodeAtPath(nodes, path.slice(0, depth))?.part)?.locked) return false;
  }

  return true;
}

/** A top-level block's start: the notes right before it travel with it, so each Purpose note stays with its block. */
function groupStart(nodes: PmlNode[], index: number): number {
  let start = index;
  while (start > 0 && isCommentNode(nodes[start - 1])) start--;

  return start;
}

/**
 * Move a whole block whose part names `moves_within` one step among that part's instances (owner 2026-11-17, ab: the
 * data table and the mid-post call to action hop between question sections, never above the first or below the last).
 * The block is its leading notes plus its run of nodes marked with its part; it moves past the neighbouring block
 * (that block's notes included).
 */
function moveWithinRange(nodes: PmlNode[], part: DocumentLayoutPart, index: number, direction: -1 | 1): { nodes: PmlNode[]; path: number[] } | null {
  const anchors = nodes.map((node, i) => (node.part === part.moves_within ? i : -1)).filter((i) => i >= 0);
  if (anchors.length === 0) return null;

  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  const start = groupStart(nodes, index);
  let end = index;
  while (end + 1 < nodes.length && nodes[end + 1].part === part.key) end++;

  const block = nodes.slice(start, end + 1);
  const rest = [...nodes.slice(0, start), ...nodes.slice(end + 1)];
  let at: number;

  if (direction < 0) {
    const previous = start - 1;
    // Never above the first instance of the range.
    if (previous <= first) return null;
    at = groupStart(nodes, previous);
  } else {
    let next = end + 1;
    while (next < nodes.length && isCommentNode(nodes[next])) next++;
    // Never below the last instance of the range.
    if (next >= nodes.length || next > last) return null;
    at = next - block.length + 1;
  }

  const out = [...rest.slice(0, at), ...block, ...rest.slice(at)];

  return { nodes: out, path: [out.indexOf(nodes[index])] };
}

/**
 * One step up (-1) or down (+1) for the element at `path`, by the layout's rules, or null when it may not move that
 * way. A repeat instance swaps with its nearest sibling of the same kind; a block with `moves_within` moves inside its
 * range; any other template part, or anything inside a locked part, keeps its place; an element the author added swaps
 * with its neighbour. One rule for the selection bar and the settings panel.
 */
export function reorder(
  nodes: PmlNode[],
  layout: DocumentLayout | null | undefined,
  path: number[],
  direction: -1 | 1,
): { nodes: PmlNode[]; path: number[] } | null {
  const node = getNodeAtPath(nodes, path);
  if (!node) return null;

  const part = partOf(layout, node.part);

  if (part?.kind === 'repeat') {
    const to = neighbourInstance(nodes, path, direction);

    return to === null ? null : { nodes: swapSiblings(nodes, path, to), path: [...path.slice(0, -1), to] };
  }

  if (part) return part.moves_within && path.length === 1 ? moveWithinRange(nodes, part, path[0], direction) : null;
  if (!canReorder(nodes, layout, path)) return null;

  const siblings = path.length > 1 ? (getNodeAtPath(nodes, path.slice(0, -1))?.children ?? []) : nodes;
  const to = path[path.length - 1] + direction;

  return to < 0 || to >= siblings.length ? null : { nodes: swapSiblings(nodes, path, to), path: [...path.slice(0, -1), to] };
}

/** Whether the element can move at all (the bar and the panel show their moves, greyed at an edge, only then). */
export function movable(nodes: PmlNode[], layout: DocumentLayout | null | undefined, path: number[]): boolean {
  const part = partOf(layout, getNodeAtPath(nodes, path)?.part);

  if (part?.kind === 'repeat' || (part?.moves_within && path.length === 1)) return true;

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
