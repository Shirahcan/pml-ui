'use client';

import React, { createContext, useContext, type ReactNode } from 'react';

/**
 * What kind of document the shared editor is drawing (pml-email C2b). The settings and words editors are shared by
 * pages and emails, but some of their controls only mean something on a page: an element's #link name (an email has
 * no anchors and no table of contents) and "Insert page data" (an email fills `{{variables}}` at send time, never page
 * data). An email editor says so once at its root; everything inside reads it.
 */
export type EditorSurface = 'page' | 'email';

const SurfaceContext = createContext<EditorSurface>('page');

export function EditorSurfaceProvider({ surface, children }: { surface: EditorSurface; children: ReactNode }): React.JSX.Element {
  return <SurfaceContext.Provider value={surface}>{children}</SurfaceContext.Provider>;
}

/** `page` unless an editor above said otherwise. */
export function useEditorSurface(): EditorSurface {
  return useContext(SurfaceContext);
}

const NounContext = createContext<string | null>(null);

/**
 * What the document is called ("post"), so shared parts speak of it in the host's words: an empty canvas says "This
 * post is empty", never "This page is empty". Absent, the parts keep their page wording.
 */
export function EditorNounProvider({ noun, children }: { noun: string; children: ReactNode }): React.JSX.Element {
  return <NounContext.Provider value={noun}>{children}</NounContext.Provider>;
}

/** The document's noun, or null when no editor above named it. */
export function useEditorNoun(): string | null {
  return useContext(NounContext);
}
