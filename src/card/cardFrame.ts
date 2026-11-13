import type { PmlNode } from '../pml/primitives';

/**
 * The social card's frame (shared program E1b, owner 2026-11-13: "proper real-world social cards").
 *
 * 1200x630 is what LinkedIn, Facebook, X's large card, Slack and iMessage draw (1.91:1). Text belongs inside the
 * 60 px safe margin, and out of the bottom-left band where X writes the link's domain over the picture.
 */
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;
export const CARD_SAFE_MARGIN = 60;

/** Where X draws the domain over a large card's picture: keep words out of it. */
export const CARD_X_DOMAIN_BAND = { left: 0, top: CARD_HEIGHT - 90, width: 640, height: 90 } as const;

/** What the snapshot waits for: set once the card's fonts and pictures have loaded. */
export const CARD_READY_ATTRIBUTE = 'data-card-ready';
export const CARD_READY_SELECTOR = `[${CARD_READY_ATTRIBUTE}="true"]`;

/**
 * The elements a card may hold: a picture, words and a few marks. No forms, embeds, scripts, grids or effects,
 * which mean nothing in a still picture. `credentials` is the host's pinned identity line (e.g. a regulated
 * professional's name and licence number), drawn by the host like on a page.
 */
export const CARD_ELEMENTS: readonly string[] = [
  'box', 'layer', 'heading', 'text', 'p', 'span', 'strong', 'emphasis', 'small', 'mark',
  'image', 'icon', 'spacer', 'divider', 'credentials',
];

const ALLOWED = new Set(CARD_ELEMENTS);

/** The card's nodes with everything outside the card subset removed (children of a removed node go with it). */
export function cardNodes(nodes: PmlNode[]): PmlNode[] {
  return nodes
    // A node without an element name (a source comment) has no place on a picture either.
    .filter((node) => node.primitive !== undefined && ALLOWED.has(node.primitive))
    .map((node) => (node.children ? { ...node, children: cardNodes(node.children) } : node));
}
