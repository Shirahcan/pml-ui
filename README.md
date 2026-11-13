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
