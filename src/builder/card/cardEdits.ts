import type { PmlNode } from '../../pml/primitives';

/**
 * The no-code edits a person makes on a share card (shared program E4c-3), as pure functions over the card's nodes:
 * words, picture, colour and alignment, plus removing a part. Every product's card canvas uses these, so a card is
 * edited the same way everywhere.
 *
 * ⚠ ONE AUTHORITY FOR THE RULES. Whether a card reads well (size, blocks, words) and what it may hold are decided on
 * the server (pml-kit `CardChecks`, `CardDesign`, `CardGuard`) and come back with the card after each save; nothing
 * here restates them. These functions only refuse what would break the card's contract outright: a pinned identity
 * line can never be removed or emptied.
 */

/** Where a node sits: its index at each level, from the card's top-level list down. */
export type CardPath = number[];

/** The colours a card may use: the theme's own tokens, never a raw colour (pml-kit `CardSpec`). */
export const CARD_TEXT_COLOURS = ['default', 'muted', 'accent', 'on-accent', 'success', 'danger'] as const;
export const CARD_BACKGROUNDS = ['none', 'surface', 'accent', 'gradient', 'image'] as const;
export const CARD_ALIGNMENTS = ['left', 'center', 'right'] as const;

export type CardTextColour = (typeof CARD_TEXT_COLOURS)[number];
export type CardBackground = (typeof CARD_BACKGROUNDS)[number];
export type CardAlignment = (typeof CARD_ALIGNMENTS)[number];

/** What can be done to a part, so the edit bar offers only those. */
export interface CardPartAbilities {
  words: boolean;
  picture: boolean;
  textColour: boolean;
  background: boolean;
  align: boolean;
  remove: boolean;
  /** Why it cannot be removed, when it cannot. */
  pinned: boolean;
}

/** The prop that holds an element's words, or null when its words are not a single prop. */
export function wordsProp(node: PmlNode): 'text' | 'value' | null {
  if (node.primitive === 'heading') return 'text';
  if (node.primitive === 'text') return 'value';
  return null;
}

export function isPinned(node: PmlNode): boolean {
  return node.primitive === 'credentials' || (node.children ?? []).some(isPinned);
}

export function nodeAt(nodes: PmlNode[], path: CardPath): PmlNode | null {
  let level: PmlNode[] = nodes;
  let found: PmlNode | null = null;

  for (const index of path) {
    found = level[index] ?? null;
    if (found === null) return null;
    level = found.children ?? [];
  }

  return found;
}

export function abilities(node: PmlNode): CardPartAbilities {
  const pinned = isPinned(node);
  const words = wordsProp(node) !== null;
  const isBox = node.primitive === 'box' || node.primitive === 'layer';

  return {
    words,
    picture: node.primitive === 'image' || (isBox && node.style?.background === 'image'),
    textColour: words,
    background: isBox,
    align: words || isBox,
    remove: !pinned,
    pinned,
  };
}

/** A short, plain name for a part, for the parts list and the edit bar ("Heading: Study permit…"). */
export function partLabel(node: PmlNode): string {
  const prop = wordsProp(node);
  const words = prop ? String(node.props?.[prop] ?? '').trim() : '';
  const name: Record<string, string> = {
    heading: 'Heading', text: 'Words', image: 'Picture', box: 'Area', layer: 'Shape', credentials: 'Identity line',
    icon: 'Icon', spacer: 'Space', divider: 'Line',
  };
  const primitive = node.primitive ?? '';
  const kind = name[primitive] ?? (primitive || 'Part');

  return words === '' ? kind : `${kind}: ${words.length > 32 ? `${words.slice(0, 31)}…` : words}`;
}

/** Applies a change to the node at `path`, returning a NEW card (never mutating the one on screen). */
function update(nodes: PmlNode[], path: CardPath, change: (node: PmlNode) => PmlNode): PmlNode[] {
  if (path.length === 0) return nodes;
  const [index, ...rest] = path;

  return nodes.map((node, i) => {
    if (i !== index) return node;
    if (rest.length === 0) return change(node);

    return { ...node, children: update(node.children ?? [], rest, change) };
  });
}

export function setWords(nodes: PmlNode[], path: CardPath, words: string): PmlNode[] {
  return update(nodes, path, (node) => {
    const prop = wordsProp(node);

    return prop === null ? node : { ...node, props: { ...node.props, [prop]: words } };
  });
}

/** A picture element gets the new address (and alt); an area with a background picture gets it as its background. */
export function setPicture(nodes: PmlNode[], path: CardPath, url: string, alt?: string): PmlNode[] {
  return update(nodes, path, (node) => {
    if (node.primitive === 'image') {
      return { ...node, props: { ...node.props, src: url, ...(alt !== undefined ? { alt } : {}) } };
    }

    return { ...node, style: { ...node.style, background: 'image', background_image_url: url } };
  });
}

export function setTextColour(nodes: PmlNode[], path: CardPath, colour: CardTextColour): PmlNode[] {
  return update(nodes, path, (node) => ({ ...node, style: { ...node.style, text_color: colour } }));
}

export function setBackground(nodes: PmlNode[], path: CardPath, background: CardBackground): PmlNode[] {
  return update(nodes, path, (node) => ({ ...node, style: { ...node.style, background } }));
}

export function setAlign(nodes: PmlNode[], path: CardPath, align: CardAlignment): PmlNode[] {
  return update(nodes, path, (node) => ({ ...node, style: { ...node.style, align } }));
}

/**
 * Removes the part at `path`. A pinned identity line (or a part holding one) is never removed: the card is returned
 * unchanged with `refused: true`, so the canvas can say why.
 */
export function removeAt(nodes: PmlNode[], path: CardPath): { nodes: PmlNode[]; refused: boolean } {
  const target = nodeAt(nodes, path);
  if (target === null || isPinned(target)) return { nodes, refused: target !== null };

  const parent = path.slice(0, -1);
  const index = path[path.length - 1];
  if (parent.length === 0) return { nodes: nodes.filter((_, i) => i !== index), refused: false };

  return {
    nodes: update(nodes, parent, (node) => ({ ...node, children: (node.children ?? []).filter((_, i) => i !== index) })),
    refused: false,
  };
}

/** Every part of the card with its path, depth first, for the parts list. */
export function parts(nodes: PmlNode[], at: CardPath = []): { path: CardPath; node: PmlNode }[] {
  return nodes.flatMap((node, i) => [{ path: [...at, i], node }, ...parts(node.children ?? [], [...at, i])]);
}
