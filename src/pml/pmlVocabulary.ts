import { PML_CATALOG_BY_NAME } from './catalog';
import { PRIMITIVES, STYLE_HEX_KEYS, STYLE_PX_KEYS, STYLE_TOKENS, STYLE_URL_KEYS } from './primitives';

/**
 * The deterministic PML completion vocabulary: which tag names exist, which attributes a tag accepts,
 * and which values an attribute accepts. Derived from the SAME schema the compiler + the builder rail
 * use (StandardLibrary catalog + the style tokens), so it can only ever offer REAL, schema-valid
 * tokens - a completion built from this can never hallucinate an invalid attribute/value the way a
 * free-text AI guess does. It is a superset-of-common, not exhaustive: an omitted-but-valid attribute
 * is harmless (Apply is still the gate); a WRONG one is impossible.
 */

/** snake_case (internal) -> kebab-case (the form attribute + tag names take in PML SOURCE). */
const kebab = (s: string): string => s.replace(/_/g, '-');

/**
 * Every valid tag name in SOURCE (kebab, sorted): the raw primitives (incl. `script`, which is NOT in
 * the catalog) plus the std-library components. Deterministic tag-name autocomplete completes against it.
 */
export const KNOWN_TAG_NAMES: string[] = Array.from(
  new Set([...PRIMITIVES, ...Object.keys(PML_CATALOG_BY_NAME)].map(kebab)),
).sort();

/**
 * Style + special attributes valid on ANY tag (kebab): the appearance tokens, the bounded free-value
 * style keys, and the reactive / imperative-handle attributes. Mirrors what PmlScanner accepts on any
 * element (style tokens route to node.style; if / else-if / else / each / on-<event> / key are the control
 * attributes, PML v3).
 */
const GLOBAL_ATTRS: string[] = Array.from(
  new Set(
    [...Object.keys(STYLE_TOKENS), ...STYLE_PX_KEYS, ...STYLE_HEX_KEYS, ...STYLE_URL_KEYS].map(kebab),
  ),
).concat(['on-click', 'on-change', 'on-submit', 'on-input', 'if', 'else-if', 'else', 'each', 'key']);

/**
 * The attribute names (kebab, sorted) a tag accepts: its catalog-declared props plus the global style +
 * reactive attrs. Only ever real attributes, so it cannot suggest garbage.
 */
export function attributesForTag(tagKebab: string): string[] {
  const def = PML_CATALOG_BY_NAME[tagKebab.replace(/-/g, '_')];
  const props = def ? def.fields.map((f) => kebab(f.key)) : [];

  return Array.from(new Set([...props, ...GLOBAL_ATTRS])).sort();
}

/**
 * The enum values an attribute accepts, for value autocomplete. Looked up PER TAG so a shared name means
 * the right thing (a `<field name=>` is free text; an `<icon name=>` is the icon set): a catalog `select`
 * field's options win, else the global style token's values (align, radius, ...). Returns [] for a
 * free-text attribute (href, label, a heading's text), where the value is left to the AI / consultant.
 */
export function enumValuesFor(tagKebab: string, attrKebab: string): string[] {
  const def = PML_CATALOG_BY_NAME[tagKebab.replace(/-/g, '_')];
  const field = def?.fields.find((f) => kebab(f.key) === attrKebab);
  if (field?.options && field.options.length > 0) {
    return field.options;
  }

  const styleVals = (STYLE_TOKENS as Record<string, readonly string[]>)[attrKebab.replace(/-/g, '_')];

  return styleVals ? [...styleVals] : [];
}
