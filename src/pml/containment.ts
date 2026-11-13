import { getNodeAtPath, isCommentNode, removeNodeAtPath, updateNodeAtPath } from './nodeTree';
import type { PmlNode } from './primitives';
import { CONTAINER_ELEMENTS, ELEMENTS, type PmlElementDef } from './elements.generated';

/**
 * What may sit inside what, read from the ONE element definition (`elements.generated.ts`, generated from
 * backend/resources/pml/elements.json), so a drag refuses straight away exactly what the save would
 * refuse. The server stays the gate.
 */
export const CONTAINER_PRIMITIVES: readonly string[] = CONTAINER_ELEMENTS;

const DEFS = Object.entries(ELEMENTS) as [string, PmlElementDef][];

/** A parent that may hold ONLY these children (absent = any element). */
export const CHILD_WHITELIST: Record<string, string[]> = Object.fromEntries(
  DEFS.filter(([, def]) => def.children).map(([name, def]) => [name, [...(def.children ?? [])]]),
);

/** A child that may sit ONLY directly inside this one parent. */
export const REQUIRED_PARENT: Record<string, string> = Object.fromEntries(
  DEFS.filter(([, def]) => def.parent?.length === 1).map(([name, def]) => [name, (def.parent ?? [])[0]]),
);

/** A child that may sit only inside one of several parents. */
export const ALLOWED_PARENTS: Record<string, string[]> = Object.fromEntries(
  DEFS.filter(([, def]) => (def.parent?.length ?? 0) > 1).map(([name, def]) => [name, [...(def.parent ?? [])]]),
);

/** May this node sit directly inside `parent`? `null` is the page itself. */
export function canHold(parent: PmlNode | null, child: PmlNode): boolean {
  const primitive = child.primitive ?? '';
  const home = parent?.primitive ?? null;

  if (REQUIRED_PARENT[primitive] && REQUIRED_PARENT[primitive] !== home) return false;
  if (ALLOWED_PARENTS[primitive] && (home === null || !ALLOWED_PARENTS[primitive].includes(home))) return false;

  if (parent === null) return true;

  // A component's insides belong to its own design, and only containers hold anything.
  if (parent.component || !home || !CONTAINER_PRIMITIVES.includes(home)) return false;

  const allowed = CHILD_WHITELIST[home];

  return !allowed || allowed.includes(primitive);
}

function insertAt(nodes: PmlNode[], parentPath: number[], index: number, child: PmlNode): PmlNode[] {
  if (parentPath.length === 0) return [...nodes.slice(0, index), child, ...nodes.slice(index)];

  const parent = getNodeAtPath(nodes, parentPath);

  if (!parent) return nodes;

  const children = parent.children ?? [];

  return updateNodeAtPath(nodes, parentPath, { ...parent, children: [...children.slice(0, index), child, ...children.slice(index)] } as PmlNode);
}

export interface Moved {
  nodes: PmlNode[];
  /** Where the node ended up, so the selection can follow it. */
  path: number[];
}

/**
 * Move a node to `index` inside `toParent`, or null when that is not allowed: into itself, into one of
 * its own descendants, or somewhere the schema would refuse it.
 */
export function moveNode(nodes: PmlNode[], from: number[], toParent: number[], index: number): Moved | null {
  const node = getNodeAtPath(nodes, from);

  if (!node || isCommentNode(node)) return null;

  const isInsideItself = toParent.length >= from.length && from.every((step, i) => toParent[i] === step);

  if (isInsideItself) return null;

  const parent = toParent.length === 0 ? null : getNodeAtPath(nodes, toParent);

  if (toParent.length > 0 && !parent) return null;
  if (!canHold(parent, node)) return null;

  const removed = removeNodeAtPath(nodes, from);

  // Taking the node out shifts what follows it in the same list, and anything nested under those.
  const sibling = from.slice(0, -1);
  const last = from[from.length - 1];
  const shift = (path: number[]): number[] =>
    path.length >= from.length && sibling.every((step, i) => path[i] === step) && path[from.length - 1] > last
      ? path.map((step, i) => (i === from.length - 1 ? step - 1 : step))
      : path;

  const target = shift(toParent);
  const sameList = target.length === sibling.length && target.every((step, i) => step === sibling[i]);
  const position = sameList && index > last ? index - 1 : index;

  return { nodes: insertAt(removed, target, position, node), path: [...target, position] };
}

/** A copy of `node` placed right after `at`, or null when that spot cannot hold it. */
export function placeAfter(nodes: PmlNode[], at: number[], node: PmlNode): Moved | null {
  const parentPath = at.slice(0, -1);
  const parent = parentPath.length === 0 ? null : getNodeAtPath(nodes, parentPath);

  if (!canHold(parent, node)) return null;

  const position = at[at.length - 1] + 1;

  return { nodes: insertAt(nodes, parentPath, position, node), path: [...parentPath, position] };
}

/** Where a new element can go, relative to the selected one. */
export type Placement = 'before' | 'inside' | 'after';

const PLACEMENTS: Placement[] = ['before', 'inside', 'after'];

/** Does this node hold elements of its own (and not a component, whose insides are its design's)? */
function holdsElements(node: PmlNode | null): boolean {
  return node === null || (!node.component && CONTAINER_PRIMITIVES.includes(node.primitive ?? ''));
}

function parentOf(nodes: PmlNode[], path: number[]): PmlNode | null {
  return path.length <= 1 ? null : getNodeAtPath(nodes, path.slice(0, -1));
}

/**
 * The spots the Add menu offers for the element at `path`, in menu order. Inside needs a container;
 * before and after need a parent that holds elements, and a component's top element has no siblings.
 */
export function placementsFor(nodes: PmlNode[], path: number[], { rootIsComponent = false }: { rootIsComponent?: boolean } = {}): Placement[] {
  const node = getNodeAtPath(nodes, path);

  if (!node || isCommentNode(node)) return [];

  const besideAllowed = !(rootIsComponent && path.length === 1) && holdsElements(parentOf(nodes, path));

  return PLACEMENTS.filter((placement) => (placement === 'inside' ? holdsElements(node) : besideAllowed));
}

/** May `candidate` go at that spot? Used to offer only what fits there. */
export function fitsAt(nodes: PmlNode[], path: number[], placement: Placement, candidate: PmlNode): boolean {
  const parent = placement === 'inside' ? getNodeAtPath(nodes, path) : parentOf(nodes, path);

  if (placement === 'inside' && !parent) return false;

  return canHold(parent, candidate);
}

/** Put `node` before, inside (at the end) or after the element at `path`, or null when it may not go there. */
export function insertRelative(nodes: PmlNode[], path: number[], node: PmlNode, placement: Placement): Moved | null {
  if (!fitsAt(nodes, path, placement, node)) return null;

  if (placement === 'inside') {
    const parent = getNodeAtPath(nodes, path) as PmlNode;
    const position = (parent.children ?? []).length;

    return { nodes: insertAt(nodes, path, position, node), path: [...path, position] };
  }

  const parentPath = path.slice(0, -1);
  const position = path[path.length - 1] + (placement === 'after' ? 1 : 0);

  return { nodes: insertAt(nodes, parentPath, position, node), path: [...parentPath, position] };
}
