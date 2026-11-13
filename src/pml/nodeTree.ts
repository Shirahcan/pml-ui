import { ELEMENTS } from './elements.generated';
import type { PmlNode } from './primitives';

/**
 * Path-based edits on a PML node tree, the builder's equivalent of blockTree for blocks.
 *
 * A path is a list of child indices: [2] is the third top-level section, [2, 0] is the first
 * child of that section. Containers hold their children under one uniform `children` key
 * (unlike blocks, whose children key varied by type), so these operations are type-agnostic.
 * Every operation returns a NEW tree; nothing mutates in place (React state safety).
 */

/**
 * True for a first-class comment node (`<!-- -->` -> `{comment: text}`). A comment carries no
 * primitive/component, so the renderer and the canvas must skip it (it never renders), while the
 * stored AST keeps it so it round-trips to the Code view. Mirrors the backend PmlParser::isCommentNode.
 */
export function isCommentNode(node: PmlNode): boolean {
  // The backend tests the KEY (array_key_exists). An empty note saved as "" comes back as null
  // (Laravel turns empty strings into null on the way in), and was then drawn as a blank section that
  // shifted every later preview by one (2026-11-07). Null is still a comment.
  return typeof node.comment === 'string' || (node.comment === null && 'comment' in node);
}

/** An element id: 6 to 16 lowercase letters and digits. Mirrors the backend PmlUids::PATTERN. */
const UID = /^[a-z0-9]{6,16}$/;

export function newUid(): string {
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);

  return Array.from(bytes, (b) => (b % 36).toString(36)).join('');
}

/**
 * A word run (PML v3 L4): plain `text` holding only its value. Inside a paragraph it is written bare,
 * with no tag to carry an id, so it gets none. Mirrors the backend PmlUids::isRun.
 */
export function isRunNode(node: PmlNode): boolean {
  const props = node.props ?? {};

  return node.primitive === 'text' && Object.keys(props).length === 1 && 'value' in props && !node.style && !node.children && !node.key && !node.if && !node.else_if && !node.else && !node.each && !node.on;
}

/** Whether an element's content is words: text runs and inline elements (`p`, `strong`...). */
export function holdsWords(node: PmlNode): boolean {
  const def = node.primitive ? (ELEMENTS as Record<string, { holds?: string }>)[node.primitive] : undefined;

  return def?.holds === 'inline';
}

/**
 * Give every element without an id a new one, and a NEW one to the second of any two that share one
 * (a duplicate or a paste). Existing ids never change otherwise. Returns the SAME array when nothing
 * needed an id, so an unchanged tree stays unchanged. Mirrors the backend PmlUids::ensure.
 */
export function ensureUids(nodes: PmlNode[]): PmlNode[] {
  const seen = new Set<string>();

  const walk = (list: PmlNode[], words = false): PmlNode[] => {
    let changed = false;
    const out = list.map((node) => {
      if (isCommentNode(node)) return node;

      let next = node;

      if (words && isRunNode(node)) {
        if (node.uid !== undefined) {
          next = { ...node };
          delete next.uid;
        }
      } else {
        let uid = typeof node.uid === 'string' && UID.test(node.uid) ? node.uid : null;

        while (uid === null || seen.has(uid)) uid = newUid();

        seen.add(uid);
        if (uid !== node.uid) next = { ...node, uid };
      }

      if (next.children) {
        const children = walk(next.children, holdsWords(next));

        if (children !== next.children) next = { ...next, children };
      }

      if (next !== node) changed = true;

      return next;
    });

    return changed ? out : list;
  };

  return walk(nodes);
}

/** Where the element with this id is now, or null when it is gone. */
export function findPathByUid(nodes: PmlNode[], uid: string): number[] | null {
  for (let i = 0; i < nodes.length; i += 1) {
    if (nodes[i].uid === uid) return [i];

    const inner = nodes[i].children ? findPathByUid(nodes[i].children ?? [], uid) : null;

    if (inner) return [i, ...inner];
  }

  return null;
}

/**
 * The compiled tree drops comments and expands components, so a position on the canvas is not always
 * a position in the source. These two convert between them. A component is opaque: a click inside
 * one selects the component, because its insides belong to its design.
 */
export function sourcePathFor(nodes: PmlNode[], renderedPath: number[]): number[] {
  const out = renderedPath.slice(0, 1);
  let node: PmlNode | undefined = nodes[renderedPath[0]];

  for (const position of renderedPath.slice(1)) {
    if (!node || node.component || !node.children) break;

    let seen = -1;
    const index = node.children.findIndex((child) => !isCommentNode(child) && ++seen === position);

    if (index < 0) break;

    out.push(index);
    node = node.children[index];
  }

  return out;
}

export function renderedPathFor(nodes: PmlNode[], sourcePath: number[]): number[] {
  const out = sourcePath.slice(0, 1);
  let node: PmlNode | undefined = nodes[sourcePath[0]];

  for (const index of sourcePath.slice(1)) {
    const children: PmlNode[] = node?.children ?? [];

    out.push(children.slice(0, index).filter((child) => !isCommentNode(child)).length);
    node = children[index];
  }

  return out;
}

export function getNodeAtPath(nodes: PmlNode[], path: number[]): PmlNode | null {
  if (path.length === 0) return null;

  let current: PmlNode | undefined = nodes[path[0]];

  for (let i = 1; i < path.length; i++) {
    if (!current?.children) return null;
    current = current.children[path[i]];
  }

  return current ?? null;
}

/**
 * Where this very node object sits in the tree, or null. Every edit copies only the branch it changes,
 * so an element nobody edited keeps its object: after a move, a paste or a removal elsewhere, this finds
 * where it went.
 */
export function findNodePath(nodes: PmlNode[], target: PmlNode): number[] | null {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i] === target) return [i];

    const inside = findNodePath(nodes[i].children ?? [], target);

    if (inside) return [i, ...inside];
  }

  return null;
}

export function updateNodeAtPath(nodes: PmlNode[], path: number[], next: PmlNode): PmlNode[] {
  if (path.length === 0) return nodes;

  const [head, ...rest] = path;

  if (rest.length === 0) {
    const copy = [...nodes];
    copy[head] = next;

    return copy;
  }

  const target = nodes[head];
  if (!target?.children) return nodes;

  const copy = [...nodes];
  copy[head] = { ...target, children: updateNodeAtPath(target.children, rest, next) };

  return copy;
}

export function removeNodeAtPath(nodes: PmlNode[], path: number[]): PmlNode[] {
  if (path.length === 0) return nodes;

  const [head, ...rest] = path;

  if (rest.length === 0) {
    return nodes.filter((_, i) => i !== head);
  }

  const target = nodes[head];
  if (!target?.children) return nodes;

  const copy = [...nodes];
  copy[head] = { ...target, children: removeNodeAtPath(target.children, rest) };

  return copy;
}

/** Append a child into the container at parentPath. */
export function insertChild(nodes: PmlNode[], parentPath: number[], child: PmlNode): PmlNode[] {
  const parent = getNodeAtPath(nodes, parentPath);
  if (!parent) return nodes;

  return updateNodeAtPath(nodes, parentPath, {
    ...parent,
    children: [...(parent.children ?? []), child],
  });
}

/** Move a top-level section up or down (for the reorder controls). */
export function moveTopLevel(nodes: PmlNode[], from: number, to: number): PmlNode[] {
  if (to < 0 || to >= nodes.length || from < 0 || from >= nodes.length) return nodes;

  const copy = [...nodes];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);

  return copy;
}

/** Every component/primitive name present anywhere in the tree (for singleton checks). */
export function namesUsed(nodes: PmlNode[]): Set<string> {
  const names = new Set<string>();

  const walk = (list: PmlNode[]): void => {
    for (const node of list) {
      if (node.component) names.add(node.component);
      if (node.primitive) names.add(node.primitive);
      if (node.children) walk(node.children);
    }
  };

  walk(nodes);

  return names;
}
