/**
 * One-click style presets: named bundles of whitelisted style tokens a consultant can apply to an
 * element without touching individual axes. Every token here is a value from STYLE_TOKENS, so a
 * preset can never introduce anything the compiler would reject. Applying a preset MERGES its tokens
 * over the element's existing style (it never clears an unrelated token the consultant already set).
 */

export interface StylePreset {
  /** Stable id (used as the React key). */
  name: string;
  /** Human label shown on the button. */
  label: string;
  /** One-line description of the look. */
  description: string;
  /** The token bundle merged over the node's style. All values are STYLE_TOKENS members. */
  tokens: Record<string, string>;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    name: 'card',
    label: 'Card',
    description: 'A bordered, rounded surface with a soft shadow.',
    tokens: { border: 'hairline', border_color: 'muted', radius: 'lg', shadow: 'sm', padding: 'normal', background: 'surface' },
  },
  {
    name: 'pill_button',
    label: 'Pill button',
    description: 'Fully rounded with a light shadow.',
    tokens: { radius: 'full', shadow: 'sm' },
  },
  {
    name: 'quiet',
    label: 'Quiet',
    description: 'Muted, smaller text for secondary notes.',
    tokens: { text_color: 'muted', body_size: 'sm' },
  },
  {
    name: 'banner',
    label: 'Banner',
    description: 'A roomy, centered accent band.',
    tokens: { padding: 'spacious', background: 'accent', align: 'center' },
  },
];

/**
 * Merge a preset's tokens over an existing style object. Existing tokens not named by the preset are
 * preserved; the preset's tokens win where they overlap. Returns a new object (never mutates).
 */
export function applyPreset(style: Record<string, unknown>, preset: StylePreset): Record<string, unknown> {
  return { ...style, ...preset.tokens };
}
