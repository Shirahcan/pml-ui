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
