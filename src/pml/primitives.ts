import { CONTAINER_ELEMENTS, ELEMENTS, ELEMENT_NAMES, PML_ENUMS } from './elements.generated';
import type { PmlEach, PmlExpr } from './expressions';

/**
 * The trusted leaf vocabulary of Portify Markup Language (PML).
 *
 * The SERVER's PrimitiveSchema is the security boundary. The element names, what may hold children and
 * the closed value lists come from `elements.generated.ts`, generated from the ONE definition
 * (backend/resources/pml/elements.json, PML v3 L1) and checked current by a backend test, so this file
 * can no longer drift from the server. The style vocabulary below is still mirrored by hand
 * (styleParity.test.ts reads the PHP).
 */

export const PRIMITIVES = ELEMENT_NAMES;

export type Primitive = (typeof PRIMITIVES)[number];

/** The only primitives that may carry children. (list holds list_item; table holds row holds cell; form holds fields.) */
export const CONTAINER_PRIMITIVES = CONTAINER_ELEMENTS;

/**
 * The closed icon allowlist (FEATURE_ICONS + TIMELINE_ICONS), with no maple-leaf or shield
 * that could imply a relationship with the Government of Canada (s.44).
 */
export const ICON_NAMES = PML_ENUMS.icon;

export type IconName = (typeof ICON_NAMES)[number];

export const BUTTON_VARIANTS = PML_ENUMS.variant;

export const FIELD_KINDS = PML_ENUMS.field_kind;

/** Every element's definition (props and their types, containment), for code that needs more than names. */
export { ELEMENTS };

/**
 * The shared appearance token vocabulary (mirrors sectionStyle.ts and PrimitiveSchema's
 * STYLE_ENUMS). Tokens only; the bounded-free values (px padding, #rrggbb colour, and the
 * background image url) are validated on both sides. Motion + gradient/image backgrounds (Stage 2)
 * are closed enums here too: the trusted runtime owns all timing, so there is no user JS or timing.
 */
export const STYLE_TOKENS = {
  align: ['left', 'center', 'right'],
  width: ['narrow', 'normal', 'wide', 'xwide', 'full'],
  padding: ['none', 'compact', 'normal', 'spacious', 'custom'],
  background: ['none', 'surface', 'accent', 'custom', 'gradient', 'image'],
  background_gradient: ['dawn', 'dusk', 'ocean', 'forest', 'slate'],
  background_overlay: ['none', 'light', 'dark', 'strong'],
  heading_size: ['sm', 'md', 'lg', 'xl'],
  body_size: ['sm', 'md', 'lg'],
  motion: ['none', 'reveal-up', 'reveal-in', 'stagger', 'parallax-soft', 'hover-lift', 'sticky', 'count-up'],
  // How many columns/rows a child spans inside a grid or table row (bounded by the grid's 4-column
  // max; the renderer clamps anything larger than the real column count).
  col_span: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  row_span: ['1', '2', '3'],
  // Placement: how a container distributes/aligns its children on the flex axes (the nav-layout fix).
  justify: ['start', 'center', 'end', 'between', 'around', 'evenly'],
  align_items: ['start', 'center', 'end', 'stretch', 'baseline'],
  self_align: ['start', 'center', 'end', 'stretch'],
  // Spacing: horizontal padding + outer vertical margin (the existing `padding` stays vertical).
  padding_x: ['none', 'compact', 'normal', 'spacious'],
  margin_y: ['none', 'sm', 'md', 'lg'],
  // Typography: text_color is a PALETTE token (custom hex via STYLE_HEX_KEYS), never a free colour.
  text_color: ['default', 'muted', 'accent', 'on-accent', 'success', 'danger'],
  font_weight: ['normal', 'medium', 'semibold', 'bold'],
  line_height: ['tight', 'normal', 'relaxed', 'loose'],
  letter_spacing: ['tight', 'normal', 'wide'],
  text_transform: ['none', 'uppercase', 'capitalize'],
  // Which of the site's two fonts (never a free family).
  font: ['heading', 'body'],
  // Border & effects. border_color is a palette token (custom hex via STYLE_HEX_KEYS).
  border: ['none', 'hairline', 'thin', 'thick'],
  border_color: ['default', 'muted', 'accent'],
  radius: ['none', 'sm', 'md', 'lg', 'xl', 'full'],
  shadow: ['none', 'sm', 'md', 'lg'],
  // Sizing: a minimum band height as a closed set (never a free px/vh).
  min_height: ['none', 'sm', 'md', 'lg'],
  // Visibility (S2-03): leave an element out on one screen size.
  hide: ['none', 'mobile', 'tablet', 'desktop'],
  // Display (2026-11-08): how the element lays itself out; a carousel's own settings.
  display: ['block', 'flex', 'grid', 'carousel', 'inline', 'inline-block'],
  carousel_per_view: ['1', '2', '3', '4'],
  carousel_motion: ['none', 'step', 'scroll'],
  carousel_speed: ['slow', 'normal', 'fast'],
  carousel_controls: ['arrows', 'dots', 'both', 'none'],
  carousel_loop: ['on', 'off'],
  // Placement as the page scrolls (edge-anchored only), stacking order, sideways overflow.
  placement: ['static', 'sticky', 'fixed'],
  placement_edge: ['top', 'bottom'],
  stacking: ['base', 'raised', 'top'],
  overflow: ['visible', 'clip', 'scroll-x'],
} as const;

/** The display values a leaf may take; a container takes block | flex | grid | carousel. */
export const DISPLAY_FOR_LEAF = ['block', 'inline', 'inline-block'] as const;
export const DISPLAY_FOR_CONTAINER = ['block', 'flex', 'grid', 'carousel'] as const;

/**
 * Style keys whose value is a bounded free value, not a token, validated on the server:
 * clamped px paddings and #rrggbb colours. Mirrors PrimitiveSchema STYLE_PX_KEYS / STYLE_HEX_KEYS.
 */
/**
 * The layout tokens that may differ by screen size (S2-01): `md:` from 768px, `lg:` from 1024px.
 * Mirrors PrimitiveSchema::RESPONSIVE_STYLE_KEYS.
 */
export const RESPONSIVE_STYLE_KEYS = [
  'padding',
  'padding_x',
  'margin_y',
  'align',
  'width',
  'heading_size',
  'body_size',
  'justify',
  'align_items',
  'min_height',
  'col_span',
  'carousel_per_view',
] as const;

export const BREAKPOINTS = ['md', 'lg'] as const;

export const STYLE_PX_KEYS = ['padding_top_px', 'padding_bottom_px', 'padding_left_px', 'padding_right_px'] as const;

export const STYLE_HEX_KEYS = ['background_color', 'text_color_custom', 'border_color_custom'] as const;

/** Style keys whose value is a URL (scheme-checked on the server): the background image. */
export const STYLE_URL_KEYS = ['background_image_url'] as const;

/** Events a node may bind a PSL handler to. Closed set - a page visitor never wired anything else. */
/** The events an element may answer: `on-click={...}` (PML v3 L3). */
export type ReactiveEvent = 'click' | 'change' | 'submit' | 'input';

export const PML_EVENTS: readonly ReactiveEvent[] = ['click', 'change', 'submit', 'input'];

export function isPmlEvent(event: string): event is ReactiveEvent {
  return (PML_EVENTS as readonly string[]).includes(event);
}

/**
 * The canonical PML node. Components (`component` set) expand to primitive nodes at compile
 * time; the renderer only ever sees primitives.
 */
export interface PmlNode {
  primitive?: Primitive;
  component?: string;
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  children?: PmlNode[];
  /**
   * When and how often the element shows (PML v3 L3): `if` / `else_if` (a PSL expression), `else`,
   * `each={item in list}`, evaluated in the browser against the PSL natives. Absent on a plain node.
   */
  if?: PmlExpr;
  else_if?: PmlExpr;
  else?: true;
  each?: PmlEach;
  /** `on-click={...}` handlers: run only on an interactive page (the scripts gate on). */
  on?: Partial<Record<ReactiveEvent, PmlExpr>>;
  /** The stable id a PSL `dom.el(key)` handle targets for imperative edits (P3c); absent on a plain node. */
  key?: string;
  /**
   * The element's PERMANENT identity (B1, 2026-11-07): written once by the editor (see ensureUids),
   * kept through moves, Porter rewrites and the Code view. A bare Markdown paragraph has none.
   */
  uid?: string;
  /** Which named slot of the component around it this element goes into on a page (component props p04). */
  slot?: string;
  /**
   * A first-class, non-rendering comment (`<!-- -->`). Present ONLY on a comment node, which carries
   * no primitive/component. The compiler drops it from the render tree and the canvas shows it as an
   * inert note, but the stored AST keeps it so it round-trips to the Code view. See isCommentNode.
   */
  comment?: string | null;
  /**
   * A studio comment's note (D1, `<comment for=uid ...>`): present only on a comment node. Drawn as a
   * pin on its element in the creator and the Studio; like every comment it never renders on a page.
   */
  note?: CommentNote;
}

export type CommentPlacement = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'left' | 'right';
export type CommentColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'grey';

/** Mirrors the backend PmlParser::studioComment (the first placement and colour are the defaults). */
export interface CommentNote {
  for?: string;
  placement?: CommentPlacement;
  color?: CommentColor;
  author?: string;
  at?: string;
  resolved?: boolean;
}
