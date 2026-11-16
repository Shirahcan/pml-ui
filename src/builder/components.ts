import type { PmlExpr } from '../pml/expressions';

/**
 * What the builder's "Add a section" menu offers beside the elements (shared program E4a2a): a site's own partials and
 * the product's component library. They are two shapes on purpose: a partial is imported by handle with its source; a
 * library component is versioned and has looks. Moved here from Portify's `lib/api/studio.ts` and `sitePartials.ts`
 * with the builder that reads them; Portify re-exports them from the package.
 */

export type StudioParamKind = 'text' | 'long_text' | 'url' | 'image' | 'enum' | 'number' | 'yes_no' | 'rich_text' | 'style' | 'list' | 'map';

/**
 * One field of a list's items or of a map (component props p02b): a name, a kind, and for a list or map its own
 * fields, nested up to three deep.
 */
export interface StudioParamField {
  name: string;
  label: string;
  kind: StudioParamKind;
  options?: string[];
  style_key?: string;
  /** A list of plain values holds this kind. */
  of?: StudioParamKind;
  /** A list of maps, or a map, holds these fields. */
  fields?: StudioParamField[];
}

/**
 * A component setting ("prop"). A scalar's default is its text ("49", "true"); a list's or map's default is its
 * JS-like value as an expression (`[{name: "Starter", price: 49}]`).
 */
export interface StudioParam extends StudioParamField {
  required?: boolean;
  default?: string | PmlExpr | null;
  help?: string | null;
}

/** A setting's default as text: a scalar's own text, a list's or map's JS-like value (`[{...}]`). */
export function paramDefaultText(param: Pick<StudioParam, 'default'>): string {
  const value = param.default;

  return typeof value === 'string' ? value : value && typeof value === 'object' ? value.$expr : '';
}

/** A place in a component's design for a page's own elements: `<slot name="actions" label="Buttons"/>`. */
export interface StudioSlot {
  /** '' for the unnamed slot. */
  name: string;
  label: string;
}

/** A site's own partial: imported as `@site/<handle>`. */
export interface DocumentPartial {
  id: string;
  /** The kebab handle an `@site/<handle>` import resolves. */
  handle: string;
  name: string;
  /** The PML source: a `<props>` block, then the body. */
  pml: string;
  /** Its settings, read from the `<props>` block by the host. */
  params: StudioParam[];
  /** The places a page can put its own elements ('' is the unnamed `<slot/>`). */
  slots: StudioSlot[];
  updated_at: string | null;
}

/** One component of the product's library (Portify's Studio). */
export interface DocumentLibraryComponent {
  key: string;
  tag: string;
  name: string;
  description: string | null;
  category: string;
  /** False on a deprecated component: it works where it is used, and is off the menu. */
  offered: boolean;
  current_version: number | null;
  replaced_by_key: string | null;
  versions: Record<
    string,
    {
      params: StudioParam[];
      looks: Array<{ name: string; label: string }>;
      has_slot: boolean;
      /** The places a page can put its own elements: '' is the unnamed one. */
      slots?: StudioSlot[];
    }
  >;
}

/** The menu's two sources. Each may fail on its own; the builder then shows no such group. */
export interface DocumentComponentsPort {
  partials(): Promise<DocumentPartial[]>;
  library(): Promise<DocumentLibraryComponent[]>;
}
