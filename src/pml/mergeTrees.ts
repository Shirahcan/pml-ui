import type { PmlNode } from './primitives';

/**
 * Merge Porter's result with what the person changed while Porter worked (B3, 2026-11-07).
 *
 * Before this, Porter's result REPLACED the page: in the stress test a headline edited mid-run was
 * silently put back when the result landed. Now three trees meet, matched by element id (B1):
 *   - base:   the page Porter was given,
 *   - theirs: Porter's result (built from base),
 *   - ours:   the page as it is now (base plus the person's edits during the run).
 *
 * Porter's result is the starting point, then the person's edits are laid back on top:
 *   - an element only the person changed keeps the person's change,
 *   - an element both changed keeps the PERSON's change (reported as a conflict),
 *   - an element the person added is put back next to the element it followed,
 *   - an element the person removed stays removed.
 * What it does not do: re-apply a MOVE the person made (Porter's arrangement wins), or merge the text
 * of a bare paragraph (it has no id; its container's version wins).
 */

export interface MergeResult {
  nodes: PmlNode[];
  /** Elements both the person and Porter changed; the person's version was kept. */
  conflicts: number;
  /** Whether anything the person did during the run had to be laid back on. */
  merged: boolean;
}

/**
 * A value written the same way however it was produced: keys in order, scalars as text. The editor's
 * copy and Porter's parsed copy of an untouched element differ in key order and in `1` versus `"1"`,
 * which must not read as a change (it reported a false conflict in the browser, 2026-11-07).
 */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;

  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value === null || value === undefined ? '' : String(value));
}

/** The element itself, without its children or id: what "changed this element" compares. */
function own(node: PmlNode): string {
  const { children: _children, uid: _uid, ...rest } = node;

  return stable(rest);
}

function index(nodes: PmlNode[], parent: string | null = null, out = new Map<string, { node: PmlNode; parent: string | null; before: string | null }>()) {
  let previous: string | null = null;

  for (const node of nodes) {
    if (node.uid) out.set(node.uid, { node, parent, before: previous });
    if (node.children) index(node.children, node.uid ?? parent, out);
    if (node.uid) previous = node.uid;
  }

  return out;
}

function mapTree(nodes: PmlNode[], fn: (node: PmlNode) => PmlNode | null): PmlNode[] {
  const out: PmlNode[] = [];

  for (const node of nodes) {
    const next = fn(node);

    if (next === null) continue;

    out.push(next.children ? { ...next, children: mapTree(next.children, fn) } : next);
  }

  return out;
}

/** Put `node` back after the element it followed, inside the parent it was in (top level when gone). */
function insertBack(nodes: PmlNode[], node: PmlNode, parent: string | null, before: string | null): PmlNode[] {
  const place = (list: PmlNode[]): PmlNode[] => {
    if (before === null) return [node, ...list];

    const at = list.findIndex((n) => n.uid === before);

    // The element it followed is gone: it goes at the end rather than nowhere.
    return at === -1 ? [...list, node] : [...list.slice(0, at + 1), node, ...list.slice(at + 1)];
  };

  if (parent === null) return place(nodes);

  let placed = false;
  const next = mapTree(nodes, (n) => {
    if (n.uid !== parent || placed) return n;

    placed = true;

    return { ...n, children: place(n.children ?? []) };
  });

  return placed ? next : place(nodes);
}

export function mergeTrees(base: PmlNode[], theirs: PmlNode[], ours: PmlNode[]): MergeResult {
  if (stable(ours) === stable(base)) return { nodes: theirs, conflicts: 0, merged: false };

  const baseIdx = index(base);
  const theirIdx = index(theirs);
  const ourIdx = index(ours);
  let conflicts = 0;

  // 1. Edits and removals the person made, laid onto Porter's tree.
  let nodes = mapTree(theirs, (node) => {
    if (!node.uid) return node;

    const was = baseIdx.get(node.uid);
    const now = ourIdx.get(node.uid);

    if (was && !now) return null; // the person removed it during the run

    if (was && now && own(now.node) !== own(was.node)) {
      if (own(node) !== own(was.node)) conflicts += 1;

      return { ...now.node, ...(node.children ? { children: node.children } : {}), uid: node.uid };
    }

    return node;
  });

  // 2. Elements the person added during the run, put back where they were.
  for (const [uid, entry] of ourIdx) {
    if (baseIdx.has(uid) || theirIdx.has(uid)) continue;
    if (entry.parent !== null && !baseIdx.has(entry.parent) && !theirIdx.has(entry.parent)) continue; // inside another new element: it travels with it

    nodes = insertBack(nodes, entry.node, entry.parent, entry.before);
  }

  return { nodes, conflicts, merged: true };
}
