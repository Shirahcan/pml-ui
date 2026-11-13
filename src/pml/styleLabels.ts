/**
 * Turns a raw PML token value into a proper human label for a select option: `narrow` -> `Narrow`,
 * `on-accent` -> `On accent`, `between` -> `Space between`, `sm` -> `Small`. The stored value is
 * always the token; this only changes what the consultant reads. One central formatter so every
 * inspector select stays consistent.
 */

/**
 * Non-obvious tokens whose humanized form would read poorly. The placement distribution tokens gain
 * a "Space" prefix (they only make sense as "space between/around/evenly"), and the shared size
 * scale (used by gap, spacing, heading/body size, radius, shadow, margin, min-height) gets friendly
 * names instead of the terse abbreviations.
 */
const OVERRIDES: Record<string, string> = {
  between: 'Space between',
  around: 'Space around',
  evenly: 'Space evenly',
  'space-between': 'Space between',
  'space-around': 'Space around',
  'space-evenly': 'Space evenly',
  xs: 'Extra small',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Extra large',
  xwide: 'Extra wide',
  // What a box IS (`as=`, S1-01), in words a consultant recognises.
  div: 'A plain group',
  section: 'A section of the page',
  article: 'An article that stands on its own',
  aside: 'A side note',
  main: 'The main content',
  figure: 'A figure (image or chart with its caption)',
  address: 'Contact details',
  blockquote: 'A quotation',
  // Visibility (S2-03): read as "Hide on: Phones".
  mobile: 'Phones',
  tablet: 'Tablets',
  desktop: 'Desktops',
};

export function tokenLabel(token: string): string {
  if (token in OVERRIDES) return OVERRIDES[token];

  const spaced = token.replace(/[-_]/g, ' ');

  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
