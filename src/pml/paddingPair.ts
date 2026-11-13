/**
 * A padding value is ONE size, for both sides, or TWO, one per side (owner 2026-11-12: "if it's possible for the
 * paddings to support single (applies to both sides) and double - for better control and customization"):
 *
 *   padding="normal"           top and bottom normal
 *   padding="none spacious"    top none, bottom spacious
 *   padding-x="compact normal" left compact, right normal
 *
 * The same reading as the backend's PrimitiveSchema (PAIRED_STYLE_KEYS), so the builder never offers a value the
 * compiler refuses. `custom` (pixel sides) is a single value only.
 */
export const PADDING_SIZES = ['none', 'compact', 'normal', 'spacious'] as const;

export type PaddingSize = (typeof PADDING_SIZES)[number];

/** The style keys whose value may be a pair. */
export const PAIRED_STYLE_KEYS = ['padding', 'padding_x'] as const;

const SIZES: ReadonlySet<string> = new Set(PADDING_SIZES);

/** The two sides of a paired value ([top, bottom] or [left, right]); null for a single value or anything else. */
export function paddingPair(value: unknown): [PaddingSize, PaddingSize] | null {
  if (typeof value !== 'string') return null;

  const parts = value.trim().split(/\s+/);
  if (parts.length !== 2 || !parts.every((part) => SIZES.has(part))) return null;

  return [parts[0] as PaddingSize, parts[1] as PaddingSize];
}

/** Both sides written back as one value: a single size when they match, so the simple form stays the common one. */
export function joinPadding(first: PaddingSize, second: PaddingSize): string {
  return first === second ? first : `${first} ${second}`;
}
