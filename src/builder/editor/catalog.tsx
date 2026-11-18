'use client';

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';

import type { DocumentLibraryComponent, DocumentPartial } from '../components';

/**
 * The components a document on screen may hold (shared program E4a4d, from Portify's StudioCatalogContext): the
 * product's library and the site's own partials. A context rather than a prop, because the settings rail recurses into
 * nested elements and the Add dialog opens at every level. With no provider both are empty, so a builder surface that
 * never loads them behaves as a plain editor.
 */
const LibraryContext = createContext<DocumentLibraryComponent[]>([]);
const PartialsContext = createContext<DocumentPartial[]>([]);
/**
 * The document's OWN pieces (its profile's: a post's title, summary, byline, sources...), offered in every Add dialog so
 * an admin can put one back or add a new one anywhere (owner 2026-11-18: nothing is locked, so what can be removed must
 * be addable). Empty for a page, an email or a card.
 */
const PiecesContext = createContext<readonly string[]>([]);
const NO_PIECES: readonly string[] = [];

export function PiecesProvider({ pieces, children }: { pieces: readonly string[]; children: ReactNode }) {
  return <PiecesContext.Provider value={pieces}>{children}</PiecesContext.Provider>;
}

/** The document's own pieces, by element name; empty outside a provider. */
export function useDocumentPieces(): readonly string[] {
  return useContext(PiecesContext) ?? NO_PIECES;
}

const NO_PARTIALS: DocumentPartial[] = [];

export function CatalogProvider({
  components,
  partials = NO_PARTIALS,
  children,
}: {
  components: DocumentLibraryComponent[];
  partials?: DocumentPartial[];
  children: ReactNode;
}) {
  return (
    <LibraryContext.Provider value={components}>
      <PartialsContext.Provider value={partials}>{children}</PartialsContext.Provider>
    </LibraryContext.Provider>
  );
}

/** The library's components. */
export function useCatalog(): DocumentLibraryComponent[] {
  return useContext(LibraryContext);
}

/** One library component by its PML name, or undefined when this catalog has no such thing. */
export function useCatalogComponent(key: string | undefined): DocumentLibraryComponent | undefined {
  const catalog = useCatalog();

  return useMemo(() => (key ? catalog.find((component) => component.key === key) : undefined), [catalog, key]);
}

/** The site's own partials. */
export function useCatalogPartials(): DocumentPartial[] {
  return useContext(PartialsContext);
}

/** One of the site's own partials by its PML name (`cta_band` for the handle `cta-band`). */
export function useCatalogPartial(key: string | undefined): DocumentPartial | undefined {
  const partials = useCatalogPartials();

  return useMemo(() => (key ? partials.find((partial) => partial.handle.replace(/-/g, '_') === key) : undefined), [partials, key]);
}
