# The Studio

One editor for every kind of PML document (shared PML Studio, plan `docs/plans/shared-pml-studio-2026-11-18` in
Portify). It is exported as `Studio` (the same component as `PageEditor`, its first name), and a document's purpose
is its **profile**: `page`, `post`, `email` or `card`, read from pml-kit's profiles through `src/pml/elements.generated.ts`.

```tsx
<Studio adapter={adapter} id={id} profile="post" layout={layout} />
```

A new feature that every document should have is built here once, as **shared chrome**. A feature only one kind of
document has is **profile chrome**, chosen by `profile`, never by a second editor.

## Shared chrome (every profile)

| Piece | Where |
|---|---|
| Canvas, selection, hover outline | `editor/PmlCanvas.tsx` |
| Selection bar (name, AI write / AI suggest, Comment, Up / Down, Remove) | `editor/SelectionBar.tsx` |
| Element menu (three dots or right-click: move, duplicate, copy, paste, wrap, unwrap, remove) | `studio/ElementMenu.tsx`, `studio/elementActions.ts` |
| Slide-in panels (element settings, details, checks, layers, host panels) | `editor/SlidePanel.tsx` |
| Layers, code view, undo / redo, autosave with conflict handling | `editor/PageLayers.tsx`, `editor/PmlCodePane.tsx`, `editor/useDocumentEditor.ts` |
| Pinned comments | `editor/useStudioComments.tsx`, `editor/CommentPins.tsx` |
| Template part guides (word counts, Add / Remove last) | `editor/PartGuides.tsx`, `editor/NestedPartCounters.tsx` |
| Add an element (the general groups) | `editor/PmlAddSectionDialog.tsx` |
| Host writes reaching the open editor (`refreshFields()`, `adoptSavedDraft()`) | controls on `Studio` |

Nothing in shared chrome may name a profile's elements. When it must know something about a document's own
elements, it asks the profile (`piecesOf`, `pieceOf`, `onlyPieces`, `draftsFor` in `src/pml/profiles.ts`).

## Profile chrome

| Profile | What it adds | Where |
|---|---|---|
| `post` | Its pieces (title, summary, cover, sources...) with their own fields in the element's panel and quick edit; the Post group in Add an element; the blog reading look on the canvas | `editor/PieceFields.tsx`, `PiecesProvider`, `CanvasFlavorContext` (`profile="post"`) |
| `page` | Nothing extra: the general groups only | |
| `email` | The inbox frame (subject, preview text), the email's checks, the as-sent view | still `editor/EmailEditor.tsx` until P2b moves it onto the Studio |
| `card` | The card frame | still `card/CardCanvas.tsx` until P2c |

Rules that follow from this:

- A profile's pieces are offered only in its own group of Add an element. Another profile's pieces are offered
  nowhere (a page never offers `post_cover`; pml-kit's page profile refuses post pieces on save).
- The canvas's reading look follows `profile`. `flavor` is a deprecated override kept for one release.
- A host adds its own items to the element menu with `elementMenuActions`, and its own panels with `panels`; it never
  forks the editor.
