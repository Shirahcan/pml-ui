import { canHold, ensureUids, getNodeAtPath, holdsWords, isCommentNode, newUid, placeAfter, removeNodeAtPath, updateNodeAtPath, CONTAINER_PRIMITIVES, type Moved, type PmlNode } from '../../language';
import { reorder } from '../editor/layoutParts';

/**
 * What the Studio's element menu does to one element (shared PML Studio P3a: the site creator's element menu, built
 * once for every profile). Each action is a plain tree edit: it returns the new tree and where the element now is, or
 * null when the spot cannot take it (the schema's own containment rules, the same the save applies). Nothing here is
 * refused because of a template: every element may go and move (owner 2026-11-18).
 */

/**
 * Where a copied element waits: the tab's session, under the SAME key the site creator uses, so an element copied in
 * one designer (a page, a post, an email) pastes into another.
 */
export const CLIPBOARD_KEY = 'pml-clipboard';

/**
 * A copy of `node` with NEW ids all the way down. Never leave the copy's ids to `ensureUids`: it renews the SECOND of two
 * that share an id in tree order, so a copy pasted ABOVE its original would take the original's id and leave the
 * comments pinned to the original pinned to nothing.
 */
export function freshCopy(node: PmlNode): PmlNode {
  const strip = (each: PmlNode): PmlNode => {
    if (isCommentNode(each)) return { ...each };

    const { uid: _uid, ...rest } = each;

    return rest.children ? { ...rest, children: rest.children.map(strip) } : { ...rest };
  };

  return ensureUids([strip(JSON.parse(JSON.stringify(node)) as PmlNode)])[0];
}

/** Hold an element for pasting (the menu's Copy). False when the browser refuses session storage. */
export function holdElement(node: PmlNode): boolean {
  try {
    globalThis.sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(node));

    return true;
  } catch {
    return false;
  }
}

/** The element waiting to be pasted, or null (nothing copied, or what is there is not an element). */
export function heldElement(): PmlNode | null {
  try {
    const held = globalThis.sessionStorage.getItem(CLIPBOARD_KEY);
    const node = held ? (JSON.parse(held) as unknown) : null;

    return node && typeof node === 'object' && !Array.isArray(node) && typeof (node as PmlNode).primitive === 'string' ? (node as PmlNode) : null;
  } catch {
    return null;
  }
}

/**
 * Does this element hold BLOCKS of its own: a container, not a component (its insides are its design), and not one whose
 * content is words (a paragraph, a bold run), whose runs would land loose in the section.
 */
function holdsBlocks(node: PmlNode): boolean {
  return !node.component && (CONTAINER_PRIMITIVES as readonly string[]).includes(node.primitive ?? '') && !holdsWords(node);
}

function parentAt(nodes: PmlNode[], path: number[]): PmlNode | null {
  return path.length > 1 ? getNodeAtPath(nodes, path.slice(0, -1)) : null;
}

/** Replace the node at `path` with `replacement` (any number of nodes) in its own list. */
function spliceAt(nodes: PmlNode[], path: number[], replacement: PmlNode[]): PmlNode[] {
  const index = path[path.length - 1];

  if (path.length === 1) return [...nodes.slice(0, index), ...replacement, ...nodes.slice(index + 1)];

  const parentPath = path.slice(0, -1);
  const parent = getNodeAtPath(nodes, parentPath);

  if (!parent) return nodes;

  const children = parent.children ?? [];

  return updateNodeAtPath(nodes, parentPath, { ...parent, children: [...children.slice(0, index), ...replacement, ...children.slice(index + 1)] } as PmlNode);
}

export const elementActions = {
  /** One step up (-1) or down (+1), past any comment, by the same rule as the selection bar. */
  move(nodes: PmlNode[], path: number[], step: -1 | 1): Moved | null {
    return reorder(nodes, null, path, step);
  },

  /** A copy (new ids) right after the element. */
  duplicate(nodes: PmlNode[], path: number[]): Moved | null {
    const node = getNodeAtPath(nodes, path);

    return node && !isCommentNode(node) ? placeAfter(nodes, path, freshCopy(node)) : null;
  },

  /** The held element (new ids) right after the one at `path`, or at the end of the page with nothing selected. */
  pasteAfter(nodes: PmlNode[], path: number[] | null, held: PmlNode): Moved | null {
    const copy = freshCopy(held);

    if (path === null) return { nodes: [...nodes, copy], path: [nodes.length] };

    return placeAfter(nodes, path, copy);
  },

  /** Put the element inside a new box, where it stood (to give it a background, padding or a width of its own). */
  wrapInBox(nodes: PmlNode[], path: number[]): Moved | null {
    const node = getNodeAtPath(nodes, path);

    const parent = parentAt(nodes, path);

    // Words are wrapped by their paragraph, never one by one.
    if (!node || isCommentNode(node) || (parent && holdsWords(parent))) return null;

    // The element keeps its own id (its pinned comments stay on it); only the box is new.
    const wrapped = { primitive: 'box', uid: newUid(), children: [node] } as PmlNode;

    if (!canHold(parent, wrapped) || !canHold(wrapped, node)) return null;

    return { nodes: spliceAt(nodes, path, [wrapped]), path };
  },

  /** Take a container's elements out of it, in its place, and drop the container (its own look goes with it). */
  unwrap(nodes: PmlNode[], path: number[]): Moved | null {
    const node = getNodeAtPath(nodes, path);

    if (!node || isCommentNode(node) || !holdsBlocks(node)) return null;

    const children = node.children ?? [];
    const parent = parentAt(nodes, path);

    if (children.length === 0 || !children.every((child) => isCommentNode(child) || canHold(parent, child))) return null;

    const first = children.findIndex((child) => !isCommentNode(child));

    return { nodes: spliceAt(nodes, path, children), path: first < 0 ? path.slice(0, -1) : [...path.slice(0, -1), path[path.length - 1] + first] };
  },

  /** The element out of the tree; the selection goes to its parent (or to nothing at the top). */
  remove(nodes: PmlNode[], path: number[]): Moved {
    return { nodes: removeNodeAtPath(nodes, path), path: path.slice(0, -1) };
  },
};

/** Which of the menu's tree actions this element can take right now (an action that would be refused is not offered). */
export function availableActions(nodes: PmlNode[], path: number[], held: PmlNode | null = heldElement()) {
  return {
    up: elementActions.move(nodes, path, -1),
    down: elementActions.move(nodes, path, 1),
    duplicate: elementActions.duplicate(nodes, path),
    paste: held ? elementActions.pasteAfter(nodes, path, held) : null,
    wrap: elementActions.wrapInBox(nodes, path),
    unwrap: elementActions.unwrap(nodes, path),
  };
}
