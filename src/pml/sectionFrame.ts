import { isCommentNode } from './nodeTree';
import type { PmlNode } from './primitives';

/**
 * The section + container model for a page's TOP-LEVEL nodes (PML v2 S2a-01).
 *
 * Every top-level node renders inside a full-width BAND (its background, vertical rhythm, border)
 * holding a centred CONTAINER (its width and side padding), so content is never flush to the edges
 * and a background always runs edge to edge. This module is the pure half: it splits a node's style
 * into the three layers by key and supplies sensible defaults; `SectionFrame` renders them.
 */

/** Style keys that belong to the full-width band. */
const BAND_KEYS = new Set([
  'background',
  'background_color',
  'background_gradient',
  'background_image_url',
  'background_overlay',
  'padding',
  'padding_top_px',
  'padding_bottom_px',
  'margin_y',
  'min_height',
  'border',
  'border_color',
  'border_color_custom',
  'shadow',
  'radius',
  'text_color',
  'text_color_custom',
]);

/** Style keys that belong to the centred container. */
const CONTAINER_KEYS = new Set(['width', 'padding_x', 'padding_left_px', 'padding_right_px']);

/**
 * Nodes that keep their own layout: these server-resolved modules carry their own inner container,
 * and a script renders nothing. (Credentials has no inner container, so it is framed like any
 * element. A sticky node IS framed: the band itself becomes the sticky element, see `sticky`.)
 */
const SELF_FRAMED = new Set(['packages', 'testimonials', 'contact_form', 'porter_intake', 'script']);

/** Containers whose style describes a whole section (band + column). */
const SECTION_CONTAINERS = new Set(['box', 'grid', 'header', 'nav', 'footer', 'table', 'list', 'form']);

/** A page's landmarks stay full-width strips, whatever their style says. */
const LANDMARKS = new Set(['header', 'nav', 'footer']);

/**
 * Does this container draw its own edge (a border, a shadow, a corner)? Then it is a CARD sitting in
 * the column, not a strip across the screen: its border belongs around the card, with the theme's
 * corners, exactly as it renders inside a grid. Split onto the band it ran edge to edge with square
 * corners, because the corner class is applied to the inner node, which no longer had a border.
 */
function drawsOwnEdge(style: Record<string, unknown>): boolean {
  return [style.border, style.shadow, style.radius].some((value) => typeof value === 'string' && value !== 'none');
}

/**
 * `page` is the site's STANDARD page width (owner 2026-11-12: "The platform has a standard page width for most pages -
 * that's supposed to be maintained ... everything block element should feed off this standard width (default) with
 * the ability to be customized"): the column the public header and footer draw in. It is not a token anyone writes;
 * it is what every block gets when it sets no width. The tokens (narrow ... full) are the customisations.
 */
export type FrameWidth = 'page' | 'narrow' | 'normal' | 'wide' | 'xwide' | 'full';

/** The container's maximum width for each frame width (the ONE copy; SectionFrame draws with it). */
export const FRAME_MAX_WIDTH: Record<FrameWidth, string> = {
  page: 'container',
  narrow: 'max-w-2xl',
  normal: 'max-w-4xl',
  wide: 'max-w-6xl',
  xwide: 'max-w-7xl',
  full: 'max-w-none',
};

/** The container's side gutters when the author set no side padding of their own: the site header's own. */
export const FRAME_GUTTER = 'px-4';

/**
 * The site's ONE standard page column: the public header (MarketingNav), the footer (MarketingFooter), a designed
 * blog post's title and reader questions, and every block that sets no width all draw in it, so a page's edges line
 * up from the logo down. Change it here and every one of them moves together.
 */
export const SITE_COLUMN = `${FRAME_MAX_WIDTH.page} mx-auto ${FRAME_GUTTER}`;

/** The width a block gets when its author set none: the site's standard page width, for every kind of block. */
export const DEFAULT_FRAME_WIDTH: FrameWidth = 'page';

const WIDTHS: ReadonlySet<string> = new Set(['narrow', 'normal', 'wide', 'xwide', 'full']);

export interface SectionFrameParts {
  /** False when the node renders as before, unframed. */
  framed: boolean;
  /** The band is the sticky element (the node asked for motion=sticky). */
  sticky: boolean;
  /** Style for the band (always carries a vertical `padding`). */
  band: Record<string, unknown>;
  /** Style for the container (`padding_x` / custom side paddings only; width is separate). */
  container: Record<string, unknown>;
  /** True when the author set no side padding, so the container uses the default gutters. */
  defaultGutter: boolean;
  width: FrameWidth;
  /** The container's text alignment, so inline children (a lone button) follow `align`. */
  align: string | null;
  /** The node with the band and container keys removed. */
  node: PmlNode;
}

function styleOf(node: PmlNode): Record<string, unknown> {
  const s = node.style;

  return s && typeof s === 'object' && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
}

export function splitSectionFrame(node: PmlNode): SectionFrameParts {
  const style = styleOf(node);
  const primitive = node.primitive;
  // A comment renders nothing, so it must not get an empty padded band either.
  const selfFramed = isCommentNode(node) || (primitive !== undefined && SELF_FRAMED.has(primitive));

  if (selfFramed) {
    return { framed: false, sticky: false, band: {}, container: {}, defaultGutter: false, width: DEFAULT_FRAME_WIDTH, align: null, node };
  }

  // Sticky only sticks within its containing block, so it moves OUT to the band (the whole bar
  // sticks, edge to edge) and off the node.
  const sticky = style.motion === 'sticky';

  const band: Record<string, unknown> = {};
  const container: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  // A CONTAINER's style describes its section (its background is the band, its width the column).
  // A single ELEMENT's style describes the element itself (a button's radius, shadow and colour are
  // the button's), so only its width moves to the frame and everything else stays on it.
  const splitsFully =
    primitive !== undefined && SECTION_CONTAINERS.has(primitive) && (LANDMARKS.has(primitive) || !drawsOwnEdge(style));

  for (const [key, value] of Object.entries(style)) {
    // A responsive override (`md:padding`, S2-01) goes wherever its base key goes.
    const baseKey = key.replace(/^(md|lg):/, '');

    // Hiding a top-level element hides its whole band, so no empty padded strip is left behind.
    if (baseKey === 'hide') band[key] = value;
    else if (splitsFully && BAND_KEYS.has(baseKey)) band[key] = value;
    else if (splitsFully && CONTAINER_KEYS.has(baseKey)) container[key] = value;
    else if (baseKey === 'width') container[key] = value;
    else if (key === 'motion' && sticky) continue;
    else rest[key] = value;
  }

  // A custom padding is per side: top/bottom stay on the band, left/right move to the container.
  // (An element's own padding stayed on the element above, so its band just gets the default.)
  if (band.padding === 'custom') {
    container.padding = 'custom';
  } else if (band.padding === undefined) {
    band.padding = 'compact';
  }

  const width = typeof container.width === 'string' && WIDTHS.has(container.width)
    ? (container.width as FrameWidth)
    : DEFAULT_FRAME_WIDTH;
  delete container.width;

  const defaultGutter = container.padding_x === undefined && container.padding_left_px === undefined && container.padding_right_px === undefined;

  return {
    framed: true,
    sticky,
    band,
    container,
    defaultGutter,
    width,
    align: typeof rest.align === 'string' ? rest.align : null,
    node: { ...node, style: rest },
  };
}

/**
 * The column a host draws its own words in around a design (a designed blog post's title, summary and reader
 * questions): ALWAYS the site's standard page column (owner 2026-11-12, "The platform has a standard page width for
 * most pages - that's supposed to be maintained"), so the post lines up with the header and footer and with every
 * block that keeps the default width. A block the author narrowed or widened is their choice; the page's frame is
 * not. The design is still passed so a caller never has to change.
 */
export function designColumnClass(_nodes: readonly PmlNode[]): string {
  return SITE_COLUMN;
}
