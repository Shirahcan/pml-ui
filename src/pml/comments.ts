import { findPathByUid, getNodeAtPath, isCommentNode, removeNodeAtPath, updateNodeAtPath } from './nodeTree';
import type { CommentColor, CommentNote, CommentPlacement, PmlNode } from './primitives';

/**
 * Studio comments (D1-D3, owner 2026-11-07): a `<comment for=uid>` node in the page itself, written
 * right before the element it is pinned to. Never rendered on a page (the compiler drops every comment
 * node); drawn as a pin in the creator and the Studio. These helpers are the one place the shape lives.
 */

export const COMMENT_PLACEMENTS: CommentPlacement[] = ['top-right', 'top-left', 'bottom-right', 'bottom-left', 'left', 'right'];
export const COMMENT_COLORS: CommentColor[] = ['yellow', 'blue', 'green', 'pink', 'purple', 'grey'];
export const COMMENT_MAX_CHARS = 2000;

export interface StudioComment {
  /** Where the comment node itself sits (its identity for edits). */
  path: number[];
  text: string;
  note: CommentNote;
  /** The element it is pinned to, or null when that element is gone (an orphan). */
  target: number[] | null;
}

export function isStudioComment(node: PmlNode): boolean {
  return isCommentNode(node) && node.note !== undefined && node.note !== null;
}

/** Every studio comment in the design, in reading order, with the element each is pinned to. */
export function collectComments(nodes: PmlNode[]): StudioComment[] {
  const out: StudioComment[] = [];

  const walk = (list: PmlNode[], prefix: number[]) => {
    list.forEach((node, index) => {
      const path = [...prefix, index];

      if (isStudioComment(node)) {
        const note = node.note ?? {};
        const found = note.for ? findPathByUid(nodes, note.for) : null;
        // Pinned to something that is itself a comment (old data): it has no box, so it is an orphan.
        const pinnedTo = found ? getNodeAtPath(nodes, found) : null;
        const target = found && pinnedTo && !isCommentNode(pinnedTo) ? found : null;
        out.push({ path, text: node.comment ?? '', note, target });

        return;
      }

      if (node.children) walk(node.children, path);
    });
  };

  walk(nodes, []);

  return out;
}

/**
 * A new comment pinned to the element at `targetPath`, written right before it. The element must have
 * a uid (every non-prose element does, see ensureUids); null when it has none.
 */
export function addComment(
  nodes: PmlNode[],
  targetPath: number[],
  text: string,
  note: CommentNote,
  options: { insideTop?: boolean } = {},
): { nodes: PmlNode[]; path: number[] } | null {
  const target = getNodeAtPath(nodes, targetPath);

  if (!target || typeof target.uid !== 'string') return null;

  // `for` is set LAST: it is always the target's id, whatever note was passed in.
  const comment: PmlNode = { comment: text.slice(0, COMMENT_MAX_CHARS), note: { ...note, for: target.uid } };

  // A component has exactly ONE top element, so a comment on it goes inside, as its first child.
  if (options.insideTop && targetPath.length === 1) {
    return { nodes: updateNodeAtPath(nodes, targetPath, { ...target, children: [comment, ...(target.children ?? [])] }), path: [...targetPath, 0] };
  }
  const index = targetPath[targetPath.length - 1];
  const parentPath = targetPath.slice(0, -1);

  if (parentPath.length === 0) {
    return { nodes: [...nodes.slice(0, index), comment, ...nodes.slice(index)], path: [index] };
  }

  const parent = getNodeAtPath(nodes, parentPath);

  if (!parent) return null;

  const children = parent.children ?? [];
  const next = { ...parent, children: [...children.slice(0, index), comment, ...children.slice(index)] };

  return { nodes: updateNodeAtPath(nodes, parentPath, next), path: [...parentPath, index] };
}

/** Change a comment's words or note (resolve, colour, placement), keeping the rest. */
export function updateComment(nodes: PmlNode[], path: number[], patch: { text?: string; note?: Partial<CommentNote> }): PmlNode[] {
  const node = getNodeAtPath(nodes, path);

  if (!node || !isStudioComment(node)) return nodes;

  const note = { ...(node.note ?? {}), ...(patch.note ?? {}) };

  // `resolved: false` is written as no attribute, as the backend serializes it.
  if (note.resolved !== true) delete note.resolved;

  return updateNodeAtPath(nodes, path, { comment: patch.text !== undefined ? patch.text.slice(0, COMMENT_MAX_CHARS) : node.comment, note });
}

export function removeComment(nodes: PmlNode[], path: number[]): PmlNode[] {
  const node = getNodeAtPath(nodes, path);

  return node && isStudioComment(node) ? removeNodeAtPath(nodes, path) : nodes;
}

/** Pin an orphan (its element was deleted) to another element: it moves to sit right before it. */
export function repinComment(nodes: PmlNode[], path: number[], targetPath: number[], options: { insideTop?: boolean } = {}): PmlNode[] {
  const node = getNodeAtPath(nodes, path);

  if (!node || !isStudioComment(node)) return nodes;

  const without = removeNodeAtPath(nodes, path);
  const target = getNodeAtPath(nodes, targetPath);
  const at = target?.uid ? findPathByUid(without, target.uid) : null;

  if (!at) return nodes;

  const rest: CommentNote = { ...(node.note ?? {}) };
  delete rest.for;
  const added = addComment(without, at, node.comment ?? '', rest, options);

  return added ? added.nodes : nodes;
}

/** The pin colours, as the canvas draws them (fill, then the readable ink on it). */
export const COMMENT_SWATCH: Record<CommentColor, { fill: string; ink: string; label: string }> = {
  yellow: { fill: '#facc15', ink: '#422006', label: 'Yellow' },
  blue: { fill: '#3b82f6', ink: '#ffffff', label: 'Blue' },
  green: { fill: '#22c55e', ink: '#052e16', label: 'Green' },
  pink: { fill: '#ec4899', ink: '#ffffff', label: 'Pink' },
  purple: { fill: '#8b5cf6', ink: '#ffffff', label: 'Purple' },
  grey: { fill: '#64748b', ink: '#ffffff', label: 'Grey' },
};
