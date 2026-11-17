import React from 'react';

/**
 * The canvas's reading look, from the editor's `flavor` (owner 2026-11-17): a post's designer passes `post`, so the
 * canvas draws the blog look the public post does (PmlRenderer `flavor`). Unset, the canvas keeps the plain look.
 */
export const CanvasFlavorContext = React.createContext<'post' | 'page' | undefined>(undefined);
