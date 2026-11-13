# @shirahcan/pml

The page language every product shares:
- **PML**, the markup;
- **PSL**, the scripts;
- the style system;
- the React renderer.

It was moved out of Portify unchanged in phase E1 of the shared console and Growth program. Portify's plan folder `docs/plans/shared-console-and-growth-2026-11-12` has the details.

```ts
import { PmlRenderer, type PmlHost } from '@shirahcan/pml';   // renderer, hooks, rich text
import { PRIMITIVES, STYLE_TOKENS } from '@shirahcan/pml/language'; // the language only, no React
```

## A product supplies only what is its own: the host

The renderer never draws a product's own things. A product passes a `host`:

```tsx
const host: PmlHost = {
  elements: {
    contact_form: ({ props }) => <MyLeadForm props={props} />,      // its lead form
    porter_intake: ({ props, site }) => <MyAssistant site={site} />, // its assistant widget
    credentials: ({ props, className }) => <MyBadge props={props} />, // its regulator's badge
  },
  onError: (error) => report(error),                                // where errors the page cannot show go
};

<PmlRenderer nodes={nodes} site={site} host={host} />
```

- **An element with no host entry draws nothing.** No product's words live in this package.
- **A nested renderer keeps its parent's host.**
- **The editor hooks** (`usePmlCompletion`, `usePmlDiagnostics`) take the host's API as their first argument; the package never calls a product's API itself.

## The builder's parts: `@shirahcan/pml/builder`

The shared builder's parts, written against the E0 `DocumentAdapter` ports, so every product's builder gets the same screens.

- **`SharingPanel`** (E4b): the social card a link unfurls into, its status (ready, waiting, or not drawn with the reason), its alt text, and the choice between the automatic card, the person's own picture (cropped to 1.91:1 around the point they drag, re-encoded under the product's byte budget) and their design (`onDesign`, E4c). Takes the adapter's `card` and `media` ports, the published `CardRef`, the live draft's words, and `onError` (Portify: `reportErrorToPorter`).
- **`UnfurlPreviews`**: the full view behind "See how it looks when shared": LinkedIn, WhatsApp, X, Facebook, Slack and iMessage. How each one cuts the words and prints the domain lives in ONE table, `UNFURL_NETWORKS`.

Every word is a prop (`labels`, `previewLabels`) with plain defaults, and the accent is the `--pml-builder-accent` CSS variable. The root and `./builder` share one renderer module (one set of React contexts).

## Tailwind

The renderer draws with Tailwind classes. Add the built bundle to the product's Tailwind `content`:

```ts
'./node_modules/@shirahcan/pml/dist/**/*.{js,cjs,mjs}'
```

## Develop

```bash
npm install     # builds dist via prepare
npm test        # vitest
npm run typecheck
```

Tests that compare the language with Portify's backend (`elements.json`, the PSL conformance corpus, the stdlib manifest, the PHP style schema) stay in Portify: they test the two sides against each other.
