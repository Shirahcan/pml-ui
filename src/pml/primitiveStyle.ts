import type { CSSProperties } from 'react';

import { paddingPair } from './paddingPair';

/**
 * Turns a PML node's `style` token object into concrete classes + inline CSS.
 *
 * This is the render-side twin of the backend PrimitiveSchema style vocabulary and the block
 * system's sectionStyle. It is intentionally self-contained (no import from the block system,
 * which the PML cutover retires): the token->class maps live here. Stored style is `unknown`
 * on purpose - a malformed value degrades to nothing, never throws inside a render.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;
const PX_MAX = 200;

// Space above and below, per side, phone / desktop. Halved on 2026-11-12 (owner: "normal vertical padding ...
// look/appear too/very spacious"): normal was 48/64px with no side padding, so a box inside a page floated in empty
// space, and nested boxes doubled it (168px between two sections of one article).
const PADDING: Record<string, string> = {
  none: 'py-0',
  compact: 'py-3 md:py-4',
  normal: 'py-6 md:py-8',
  spacious: 'py-12 md:py-16',
};

const WIDTH: Record<string, string> = {
  narrow: 'max-w-2xl',
  normal: 'max-w-4xl',
  wide: 'max-w-6xl',
  xwide: 'max-w-7xl',
  full: 'max-w-none',
};

const ALIGN: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

const GAP: Record<string, string> = {
  none: 'gap-0',
  xs: 'gap-2',
  sm: 'gap-3',
  md: 'gap-6',
  lg: 'gap-10',
  xl: 'gap-16',
};

// --- Placement (applied to a flex/grid container's own element; a no-op on a non-flex leaf).
const JUSTIFY: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

const ALIGN_ITEMS: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

/**
 * The colours an accent-filled button takes inside a background, read by every such button through
 * `ACCENT_BUTTON` (the PML button, the form submits, the package and intake buttons).
 */
const BUTTONS_ON_ACCENT = '[--pml-btn-bg:var(--site-accent-text)] [--pml-btn-fg:var(--site-accent)]';
const BUTTONS_ON_LIGHT = '[--pml-btn-bg:var(--site-accent)] [--pml-btn-fg:var(--site-accent-text)]';

/** An accent-filled button's colours: the brand's, or inverted when it sits on an accent band. */
export const ACCENT_BUTTON = 'bg-[var(--pml-btn-bg,var(--site-accent))] text-[var(--pml-btn-fg,var(--site-accent-text))]';

const SELF_ALIGN: Record<string, string> = {
  start: 'self-start',
  center: 'self-center',
  end: 'self-end',
  stretch: 'self-stretch',
};

// --- Spacing. Horizontal padding mirrors the vertical PADDING scale; outer vertical margin.
const PADDING_X: Record<string, string> = {
  none: 'px-0',
  compact: 'px-4 md:px-6',
  normal: 'px-6 md:px-10',
  spacious: 'px-10 md:px-16',
};

// One side each, for a paired value (`padding="none spacious"`, owner 2026-11-12): the same sizes as the two-sided
// scales above, written out LITERALLY per breakpoint (Tailwind only emits classes it can read in the source).
type SideMaps = { base: [Record<string, string>, Record<string, string>]; md: [Record<string, string>, Record<string, string>]; lg: [Record<string, string>, Record<string, string>] };

const SIDES: Record<'padding' | 'padding_x', SideMaps> = {
  padding: {
    base: [
      { none: 'pt-0', compact: 'pt-3 md:pt-4', normal: 'pt-6 md:pt-8', spacious: 'pt-12 md:pt-16' },
      { none: 'pb-0', compact: 'pb-3 md:pb-4', normal: 'pb-6 md:pb-8', spacious: 'pb-12 md:pb-16' },
    ],
    md: [
      { none: 'md:pt-0', compact: 'md:pt-4', normal: 'md:pt-8', spacious: 'md:pt-16' },
      { none: 'md:pb-0', compact: 'md:pb-4', normal: 'md:pb-8', spacious: 'md:pb-16' },
    ],
    lg: [
      { none: 'lg:pt-0', compact: 'lg:pt-4', normal: 'lg:pt-8', spacious: 'lg:pt-16' },
      { none: 'lg:pb-0', compact: 'lg:pb-4', normal: 'lg:pb-8', spacious: 'lg:pb-16' },
    ],
  },
  padding_x: {
    base: [
      { none: 'pl-0', compact: 'pl-4 md:pl-6', normal: 'pl-6 md:pl-10', spacious: 'pl-10 md:pl-16' },
      { none: 'pr-0', compact: 'pr-4 md:pr-6', normal: 'pr-6 md:pr-10', spacious: 'pr-10 md:pr-16' },
    ],
    md: [
      { none: 'md:pl-0', compact: 'md:pl-6', normal: 'md:pl-10', spacious: 'md:pl-16' },
      { none: 'md:pr-0', compact: 'md:pr-6', normal: 'md:pr-10', spacious: 'md:pr-16' },
    ],
    lg: [
      { none: 'lg:pl-0', compact: 'lg:pl-6', normal: 'lg:pl-10', spacious: 'lg:pl-16' },
      { none: 'lg:pr-0', compact: 'lg:pr-6', normal: 'lg:pr-10', spacious: 'lg:pr-16' },
    ],
  },
};

const MARGIN_Y: Record<string, string> = {
  none: 'my-0',
  sm: 'my-4',
  md: 'my-8',
  lg: 'my-16',
};

// --- Typography. Palette colours point at the site theme vars (no invented vars); success/danger
// are fixed semantic accents (the palette has no success/danger var). Custom colour is inline.
const TEXT_COLOR: Record<string, string> = {
  default: 'text-[var(--site-text)]',
  muted: 'text-[var(--site-muted)]',
  accent: 'text-[var(--site-accent)]',
  'on-accent': 'text-[var(--site-accent-text)]',
  success: 'text-emerald-600',
  danger: 'text-red-600',
};

const WEIGHT: Record<string, string> = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const LEADING: Record<string, string> = {
  tight: 'leading-tight',
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
  loose: 'leading-loose',
};

const TRACKING: Record<string, string> = {
  tight: 'tracking-tight',
  normal: 'tracking-normal',
  wide: 'tracking-wide',
};

const TEXT_TRANSFORM: Record<string, string> = {
  none: 'normal-case',
  uppercase: 'uppercase',
  capitalize: 'capitalize',
};

// --- Border & effects. Border width; border colour points at the site theme vars (custom is inline
// and only applies with a visible border). Radius/shadow/min-height as closed presets.
const BORDER: Record<string, string> = {
  none: 'border-0',
  hairline: 'border',
  thin: 'border-2',
  thick: 'border-4',
};

const BORDER_COLOR: Record<string, string> = {
  default: 'border-[var(--site-text)]',
  muted: 'border-[var(--site-muted)]',
  accent: 'border-[var(--site-accent)]',
};

const RADIUS: Record<string, string> = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};

const SHADOW: Record<string, string> = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
};

const MIN_HEIGHT: Record<string, string> = {
  none: '',
  sm: 'min-h-[320px]',
  md: 'min-h-[480px]',
  lg: 'min-h-[640px]',
};

// Sizes follow the site's type scale (S2-08): `--site-type-scale` is 1 by default, so these are
// exactly text-lg/xl/2xl/3xl/4xl/6xl and text-sm/base/lg until a theme picks compact or spacious.
const HEADING_SIZE: Record<string, string> = {
  sm: 'leading-tight text-[length:calc(1.125rem*var(--site-type-scale,1))] md:text-[length:calc(1.25rem*var(--site-type-scale,1))]',
  md: 'leading-tight text-[length:calc(1.5rem*var(--site-type-scale,1))] md:text-[length:calc(1.875rem*var(--site-type-scale,1))]',
  lg: 'leading-tight text-[length:calc(1.875rem*var(--site-type-scale,1))] md:text-[length:calc(2.25rem*var(--site-type-scale,1))]',
  xl: 'leading-tight text-[length:calc(2.25rem*var(--site-type-scale,1))] md:text-[length:calc(3.75rem*var(--site-type-scale,1))]',
};

const BODY_SIZE: Record<string, string> = {
  sm: 'text-[length:calc(0.875rem*var(--site-type-scale,1))] leading-relaxed',
  md: 'text-[length:calc(1rem*var(--site-type-scale,1))] leading-relaxed',
  lg: 'text-[length:calc(1.125rem*var(--site-type-scale,1))] leading-relaxed',
};

/** A heading's default scale by level, overridden when heading_size is set explicitly. */
const LEVEL_SIZE: Record<number, string> = { 1: 'lg', 2: 'md', 3: 'sm', 4: 'sm' };

// --- Responsive overrides (PML v2 S2-01/02). `md:` applies from 768px, `lg:` from 1024px. Every class
// is written out LITERALLY (Tailwind only emits classes it can read in the source), and each value is
// the token's large-screen look, so `md:padding=spacious` means "spacious from tablets up".
type ResponsiveMaps = { base: Record<string, string>; md: Record<string, string>; lg: Record<string, string> };

const RESPONSIVE: Record<string, ResponsiveMaps> = {
  padding: {
    base: PADDING,
    md: { none: 'md:py-0', compact: 'md:py-4', normal: 'md:py-8', spacious: 'md:py-16' },
    lg: { none: 'lg:py-0', compact: 'lg:py-4', normal: 'lg:py-8', spacious: 'lg:py-16' },
  },
  padding_x: {
    base: PADDING_X,
    md: { none: 'md:px-0', compact: 'md:px-6', normal: 'md:px-10', spacious: 'md:px-16' },
    lg: { none: 'lg:px-0', compact: 'lg:px-6', normal: 'lg:px-10', spacious: 'lg:px-16' },
  },
  margin_y: {
    base: MARGIN_Y,
    md: { none: 'md:my-0', sm: 'md:my-4', md: 'md:my-8', lg: 'md:my-16' },
    lg: { none: 'lg:my-0', sm: 'lg:my-4', md: 'lg:my-8', lg: 'lg:my-16' },
  },
  align: {
    base: ALIGN,
    md: { left: 'md:text-left', center: 'md:text-center', right: 'md:text-right' },
    lg: { left: 'lg:text-left', center: 'lg:text-center', right: 'lg:text-right' },
  },
  width: {
    base: WIDTH,
    md: { narrow: 'md:mx-auto md:max-w-2xl', normal: 'md:mx-auto md:max-w-4xl', wide: 'md:mx-auto md:max-w-6xl', xwide: 'md:mx-auto md:max-w-7xl', full: 'md:max-w-none' },
    lg: { narrow: 'lg:mx-auto lg:max-w-2xl', normal: 'lg:mx-auto lg:max-w-4xl', wide: 'lg:mx-auto lg:max-w-6xl', xwide: 'lg:mx-auto lg:max-w-7xl', full: 'lg:max-w-none' },
  },
  justify: {
    base: JUSTIFY,
    md: { start: 'md:justify-start', center: 'md:justify-center', end: 'md:justify-end', between: 'md:justify-between', around: 'md:justify-around', evenly: 'md:justify-evenly' },
    lg: { start: 'lg:justify-start', center: 'lg:justify-center', end: 'lg:justify-end', between: 'lg:justify-between', around: 'lg:justify-around', evenly: 'lg:justify-evenly' },
  },
  align_items: {
    base: ALIGN_ITEMS,
    md: { start: 'md:items-start', center: 'md:items-center', end: 'md:items-end', stretch: 'md:items-stretch', baseline: 'md:items-baseline' },
    lg: { start: 'lg:items-start', center: 'lg:items-center', end: 'lg:items-end', stretch: 'lg:items-stretch', baseline: 'lg:items-baseline' },
  },
  min_height: {
    base: MIN_HEIGHT,
    md: { none: 'md:min-h-0', sm: 'md:min-h-[320px]', md: 'md:min-h-[480px]', lg: 'md:min-h-[640px]' },
    lg: { none: 'lg:min-h-0', sm: 'lg:min-h-[320px]', md: 'lg:min-h-[480px]', lg: 'lg:min-h-[640px]' },
  },
  heading_size: {
    base: HEADING_SIZE,
    md: { sm: 'md:text-[length:calc(1.25rem*var(--site-type-scale,1))]', md: 'md:text-[length:calc(1.875rem*var(--site-type-scale,1))]', lg: 'md:text-[length:calc(2.25rem*var(--site-type-scale,1))]', xl: 'md:text-[length:calc(3.75rem*var(--site-type-scale,1))]' },
    lg: { sm: 'lg:text-[length:calc(1.25rem*var(--site-type-scale,1))]', md: 'lg:text-[length:calc(1.875rem*var(--site-type-scale,1))]', lg: 'lg:text-[length:calc(2.25rem*var(--site-type-scale,1))]', xl: 'lg:text-[length:calc(3.75rem*var(--site-type-scale,1))]' },
  },
  body_size: {
    base: BODY_SIZE,
    md: { sm: 'md:text-[length:calc(0.875rem*var(--site-type-scale,1))]', md: 'md:text-[length:calc(1rem*var(--site-type-scale,1))]', lg: 'md:text-[length:calc(1.125rem*var(--site-type-scale,1))]' },
    lg: { sm: 'lg:text-[length:calc(0.875rem*var(--site-type-scale,1))]', md: 'lg:text-[length:calc(1rem*var(--site-type-scale,1))]', lg: 'lg:text-[length:calc(1.125rem*var(--site-type-scale,1))]' },
  },
};

/** Visibility (S2-03): out on phones (< 768px), on tablets (768-1023px), or from laptops up (>= 1024px). */
const HIDE: Record<string, string> = {
  none: '',
  mobile: 'max-md:hidden',
  tablet: 'md:max-lg:hidden',
  desktop: 'lg:hidden',
};

/**
 * The classes for one layout token at one breakpoint, or undefined when the value is not one it knows. A padding
 * key also reads a PAIR (`"none spacious"`: one size per side).
 */
function tokenClasses(key: string, bp: 'base' | 'md' | 'lg', value: unknown): string | undefined {
  if (key === 'padding' || key === 'padding_x') {
    const pair = paddingPair(value);
    if (pair) {
      const [first, second] = SIDES[key][bp];

      return `${first[pair[0]]} ${second[pair[1]]}`;
    }
  }

  return typeof value === 'string' ? RESPONSIVE[key]?.[bp][value] : undefined;
}

/**
 * Lay a node's `md:` / `lg:` overrides over its base classes. The base value of a token may carry its
 * own md:/lg: step (padding compact is `py-3 md:py-4`); an override replaces that step rather than
 * competing with it, because two `md:py-*` classes would be resolved by stylesheet order, not intent.
 */
export function withResponsive(classes: string, raw: unknown, keys: readonly string[] = Object.keys(RESPONSIVE)): string {
  if (!raw || typeof raw !== 'object') return classes;

  const s = raw as Record<string, unknown>;
  let tokens = classes.split(/\s+/).filter(Boolean);

  for (const key of keys) {
    const maps = RESPONSIVE[key];
    if (!maps) continue;

    for (const bp of ['md', 'lg'] as const) {
      const override = tokenClasses(key, bp, s[`${bp}:${key}`]);
      if (override === undefined) continue;

      const base = tokenClasses(key, 'base', s[key]) ?? '';
      const replaced = new Set(base.split(/\s+/).filter((t) => (bp === 'md' ? /^(md|lg):/.test(t) : t.startsWith('lg:'))));
      tokens = tokens.filter((t) => !replaced.has(t)).concat(override.split(' '));
    }
  }

  return tokens.join(' ');
}

/**
 * Where an element sits as the page scrolls (owner 2026-11-08: "static, fixed, pinned/sticky"). Fixed and
 * sticky are anchored to an edge only. In the builder canvas a fixed bar is drawn sticky, so it stays inside
 * the canvas and never covers the editor around it (`inCanvas`).
 */
const STACKING: Record<string, string> = { base: 'z-0', raised: 'z-10', top: 'z-30' };
const OVERFLOW: Record<string, string> = { visible: 'overflow-visible', clip: 'overflow-hidden', 'scroll-x': 'overflow-x-auto' };
/** A leaf's display (words, a picture, a button); a box's display is the renderer's (flex, grid, carousel). */
const LEAF_DISPLAY: Record<string, string> = { block: 'block', inline: 'inline', 'inline-block': 'inline-block' };

export function placementClass(raw: unknown, inCanvas = false): string {
  if (!raw || typeof raw !== 'object') return '';
  const s = raw as Record<string, unknown>;
  const edge = s.placement_edge === 'bottom' ? 'bottom-0' : 'top-0';
  const cls: string[] = [];

  if (s.placement === 'sticky' || (s.placement === 'fixed' && inCanvas)) cls.push('sticky', edge);
  else if (s.placement === 'fixed') cls.push('fixed', 'inset-x-0', edge);

  // A pinned element sits above what scrolls under it unless told otherwise.
  if (typeof s.stacking === 'string' && STACKING[s.stacking]) cls.push(STACKING[s.stacking]);
  else if (s.placement === 'sticky' || s.placement === 'fixed') cls.push(s.placement === 'fixed' ? 'z-40' : 'z-20');
  if (typeof s.overflow === 'string' && OVERFLOW[s.overflow]) cls.push(OVERFLOW[s.overflow]);

  return cls.join(' ');
}

/** A leaf's display class (block | inline | inline-block), or ''. */
export function leafDisplayClass(raw: unknown): string {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).display : undefined;

  return typeof value === 'string' ? (LEAF_DISPLAY[value] ?? '') : '';
}

/** The classes that hide an element on one screen size (S2-03), or ''. */
export function hideClass(raw: unknown): string {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).hide : undefined;

  return typeof value === 'string' ? (HIDE[value] ?? '') : '';
}

/**
 * Premium gradient presets (background=gradient). Deliberately LIGHT washes so the default dark
 * text stays legible over them - contrast is a hard requirement (spec section 7). Palette-derived
 * gradients are a later refinement. Keyed by the closed background_gradient token.
 */
const GRADIENTS: Record<string, string> = {
  dawn: 'linear-gradient(135deg, #fff1eb 0%, #ffe4ec 100%)',
  dusk: 'linear-gradient(135deg, #ede7ff 0%, #dbeafe 100%)',
  ocean: 'linear-gradient(135deg, #e0f7fa 0%, #d6e8ff 100%)',
  forest: 'linear-gradient(135deg, #e6f4ea 0%, #d7f0e0 100%)',
  slate: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
};

/** The scrim opacity over a background image (background_overlay). The scrim is what keeps text
 *  legible over any photo, so a stronger overlay flips the container text to white. */
const OVERLAY_ALPHA: Record<string, number> = { none: 0, light: 0.25, dark: 0.5, strong: 0.7 };

/**
 * Render-side url guard for a CSS `url()`. The value already passed the server's scheme check, but
 * a render must also never let a quote/paren break out of the `url("...")`; a bad value degrades to
 * no image rather than injecting CSS.
 */
const safeCssUrl = (value: unknown): string | null =>
  typeof value === 'string' && /^https?:\/\//.test(value) && !/["'()\\<>]/.test(value) ? value : null;

export interface ResolvedStyle {
  className: string;
  style: CSSProperties;
}

const clampPx = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : NaN;

  if (!Number.isFinite(n)) return null;

  return Math.min(Math.max(Math.round(n), 0), PX_MAX);
};

const asHex = (value: unknown): string | null =>
  typeof value === 'string' && HEX.test(value) ? value : null;

/**
 * Whether white text reads on this colour (WCAG relative luminance low enough for 4.5:1). A band
 * painted a dark custom colour kept the site's dark text, so anything drawn in the current colour (an
 * outline button, a hairline) vanished on it: a mirrored page's "See all" on navy (2026-11-08).
 */
export function isDarkHex(hex: string): boolean {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);

  return 1.05 / (luminance + 0.05) >= 4.5;
}

export function resolvePrimitiveStyle(raw: unknown): ResolvedStyle {
  const s: Record<string, unknown> =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const cls: string[] = [];
  const style: CSSProperties = {};

  const padding = typeof s.padding === 'string' ? s.padding : null;

  if (padding === 'custom') {
    const top = clampPx(s.padding_top_px);
    const bottom = clampPx(s.padding_bottom_px);
    const left = clampPx(s.padding_left_px);
    const right = clampPx(s.padding_right_px);

    if (top !== null) style.paddingTop = `${top}px`;
    if (bottom !== null) style.paddingBottom = `${bottom}px`;
    if (left !== null) style.paddingLeft = `${left}px`;
    if (right !== null) style.paddingRight = `${right}px`;
  } else if (padding) {
    const classes = tokenClasses('padding', 'base', padding);
    if (classes) cls.push(classes);
  }

  const paddingX = tokenClasses('padding_x', 'base', s.padding_x);
  if (paddingX) cls.push(paddingX);
  if (typeof s.margin_y === 'string' && MARGIN_Y[s.margin_y]) cls.push(MARGIN_Y[s.margin_y]);

  const background = typeof s.background === 'string' ? s.background : 'none';

  // An accent button on an accent band is invisible (an admin page shipped "Start the check" as bare
  // words on the band, 2026-11-07). The band hands its buttons inverted colours through inherited
  // variables, and any other background hands the usual ones back, so the NEAREST background decides
  // (a white card inside an accent band gets accent buttons again).
  if (background !== 'none' && background !== 'accent') cls.push(BUTTONS_ON_LIGHT);

  if (background === 'surface') {
    cls.push('bg-[var(--site-surface)]');
  } else if (background === 'accent') {
    cls.push(`bg-[var(--site-accent)] text-[var(--site-accent-text)] ${BUTTONS_ON_ACCENT}`);
  } else if (background === 'custom') {
    const bg = asHex(s.background_color);
    if (bg) style.backgroundColor = bg;
    // The nearest paint decides the words' colour, unless the box names its own: light on a dark
    // colour, the site's text on a light one (so a white card inside a navy band reads dark again).
    if (bg && s.text_color === undefined && asHex(s.text_color_custom) === null) style.color = isDarkHex(bg) ? '#ffffff' : 'var(--site-text)';
  } else if (background === 'gradient') {
    const gradient = typeof s.background_gradient === 'string' ? GRADIENTS[s.background_gradient] : null;
    if (gradient) style.backgroundImage = gradient;
    // Every gradient is a light wash: the site's text, even inside a dark band.
    if (gradient && s.text_color === undefined && asHex(s.text_color_custom) === null) style.color = 'var(--site-text)';
  } else if (background === 'image') {
    const url = safeCssUrl(s.background_image_url);

    if (url) {
      const overlay = typeof s.background_overlay === 'string' ? s.background_overlay : 'none';
      const alpha = OVERLAY_ALPHA[overlay] ?? 0;
      // Layer the scrim IN the background (multiple backgrounds), so no overlay element is needed
      // and content still sits above it. A darker scrim flips text to white for legibility.
      const scrim = `linear-gradient(rgba(0,0,0,${alpha}), rgba(0,0,0,${alpha}))`;

      style.backgroundImage = alpha > 0 ? `${scrim}, url("${url}")` : `url("${url}")`;
      style.backgroundSize = 'cover';
      style.backgroundPosition = 'center';

      if (alpha >= 0.5) cls.push('text-white');
    }
  }

  if (typeof s.align === 'string' && ALIGN[s.align]) cls.push(ALIGN[s.align]);
  if (typeof s.width === 'string' && WIDTH[s.width]) cls.push(`mx-auto ${WIDTH[s.width]}`);

  // Placement (a no-op unless the element the class lands on is a flex/grid container or child).
  if (typeof s.justify === 'string' && JUSTIFY[s.justify]) cls.push(JUSTIFY[s.justify]);
  if (typeof s.align_items === 'string' && ALIGN_ITEMS[s.align_items]) cls.push(ALIGN_ITEMS[s.align_items]);
  if (typeof s.self_align === 'string' && SELF_ALIGN[s.self_align]) cls.push(SELF_ALIGN[s.self_align]);

  // Typography. A custom hex colour wins over the palette token (inline style beats a class), matching
  // the "explicit value > inherited" precedence; both may be present and the inline one takes effect.
  if (typeof s.text_color === 'string' && TEXT_COLOR[s.text_color]) cls.push(TEXT_COLOR[s.text_color]);
  const textColorCustom = asHex(s.text_color_custom);
  if (textColorCustom) style.color = textColorCustom;
  if (typeof s.font_weight === 'string' && WEIGHT[s.font_weight]) cls.push(WEIGHT[s.font_weight]);
  if (typeof s.line_height === 'string' && LEADING[s.line_height]) cls.push(LEADING[s.line_height]);
  if (typeof s.letter_spacing === 'string' && TRACKING[s.letter_spacing]) cls.push(TRACKING[s.letter_spacing]);
  if (typeof s.text_transform === 'string' && TEXT_TRANSFORM[s.text_transform]) cls.push(TEXT_TRANSFORM[s.text_transform]);
  // Which of the site's two fonts. Inline, because the site sets its headings' font with a
  // descendant selector that a class on the heading would lose to.
  if (s.font === 'body') style.fontFamily = 'var(--site-font-body)';
  else if (s.font === 'heading') style.fontFamily = 'var(--site-font-heading)';

  // Border & effects. A border colour (token or custom hex) only takes effect with a visible border.
  const border = typeof s.border === 'string' ? s.border : null;
  if (border && BORDER[border]) cls.push(BORDER[border]);
  if (border && border !== 'none') {
    if (typeof s.border_color === 'string' && BORDER_COLOR[s.border_color]) cls.push(BORDER_COLOR[s.border_color]);
    const borderColorCustom = asHex(s.border_color_custom);
    if (borderColorCustom) style.borderColor = borderColorCustom;
  }
  if (typeof s.radius === 'string' && RADIUS[s.radius]) cls.push(RADIUS[s.radius]);
  if (typeof s.shadow === 'string' && SHADOW[s.shadow]) cls.push(SHADOW[s.shadow]);
  if (typeof s.min_height === 'string' && MIN_HEIGHT[s.min_height]) cls.push(MIN_HEIGHT[s.min_height]);

  const hidden = hideClass(s);
  if (hidden) cls.push(hidden);

  // Placement, stacking and overflow (2026-11-08). The canvas variant is applied by the renderer.
  const placed = placementClass(s);
  if (placed) cls.push(placed);
  // A leaf's own display (block | inline | inline-block); a box's display is drawn by the renderer.
  const leaf = leafDisplayClass(s);
  if (leaf) cls.push(leaf);

  // Responsive overrides (S2-02). heading_size/body_size are applied by the renderer's own scale.
  const responsiveKeys = Object.keys(RESPONSIVE).filter((k) => k !== 'heading_size' && k !== 'body_size');

  return { className: withResponsive(cls.join(' '), s, responsiveKeys), style };
}

/** Backgrounds that paint a visible panel (a corner on `none` would round nothing). */
const PANEL_BACKGROUNDS = new Set(['surface', 'accent', 'custom', 'gradient', 'image']);

/**
 * The site's corner style for a container that paints a visible panel (a background or a border)
 * but names no radius of its own (PML v2 S2a-03): a card follows the theme's Corners choice instead
 * of rendering square on a "Round" site. An explicit radius token always wins, and a full-width band
 * never gets here (SectionFrame moves a top-level node's background onto the band).
 */
export function themeCornerClass(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';

  const s = raw as Record<string, unknown>;
  if (typeof s.radius === 'string' && RADIUS[s.radius]) return '';

  const panel = typeof s.background === 'string' && PANEL_BACKGROUNDS.has(s.background);
  const bordered = typeof s.border === 'string' && s.border !== 'none' && BORDER[s.border] !== undefined;

  return panel || bordered ? 'rounded-[var(--site-radius)]' : '';
}

/**
 * The corner a selection highlight takes, so it follows the element it surrounds: the element's own
 * radius when it sets one, otherwise the theme's (every painted panel uses that one).
 */
export function selectionCornerClass(raw: unknown): string {
  const radius = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).radius : undefined;

  return typeof radius === 'string' && RADIUS[radius] ? RADIUS[radius] : 'rounded-[var(--site-radius)]';
}

/**
 * A panel's default side padding (PML v2 S2-11): a box that paints a background or a border but
 * sets no horizontal padding of its own would otherwise put its text flush against its own edge.
 * An explicit `padding_x` (or custom px paddings) always wins.
 */
export function panelGutterClass(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return '';

  const s = raw as Record<string, unknown>;
  if (s.padding_x !== undefined || s['md:padding_x'] !== undefined || s.padding === 'custom') return '';

  const panel = typeof s.background === 'string' && PANEL_BACKGROUNDS.has(s.background);
  const bordered = typeof s.border === 'string' && s.border !== 'none' && BORDER[s.border] !== undefined;

  return panel || bordered ? 'px-5 md:px-8' : '';
}

export function gapClass(gap: unknown): string {
  return typeof gap === 'string' && GAP[gap] ? GAP[gap] : GAP.md;
}

export function headingScale(size: unknown, level: number): string {
  const key = typeof size === 'string' && HEADING_SIZE[size] ? size : (LEVEL_SIZE[level] ?? 'md');

  return HEADING_SIZE[key] ?? HEADING_SIZE.md;
}

export function bodyScale(size: unknown): string {
  return typeof size === 'string' && BODY_SIZE[size] ? BODY_SIZE[size] : BODY_SIZE.md;
}
