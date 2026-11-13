import { defineConfig } from 'tsup';

/*
 * TWO builds, on purpose. The React root is client components and hooks, so it is marked 'use client' for the
 * Next.js app router. The language (./language) is pure functions and constants that a product's SERVER code
 * reads too (metadata, route handlers): a 'use client' module hands a server component client references, not
 * values, so the language must not carry the mark. The language holds no mutable module state (only read-only
 * constants), so its copy inside the root bundle is harmless.
 */
const shared = {
  // CJS too, so a product's jest (CommonJS, node_modules untransformed) can require it.
  format: ['esm', 'cjs'] as ('esm' | 'cjs')[],
  dts: true,
  clean: false,
  sourcemap: true,
  external: ['react', 'react-dom', 'lucide-react'],
};

export default defineConfig([
  // The root and the builder (./builder, E4b onward) are client components, built TOGETHER with splitting so the
  // renderer they share is ONE module: two copies would mean two of every React context (the site interaction and
  // force-mobile contexts), and a provider from one would never reach the other. tsup's CJS splitting drops the
  // banner from the .cjs files; that is harmless because CJS is only for a product's jest (Next reads the ESM).
  {
    ...shared,
    entry: { index: 'src/index.ts', 'builder/index': 'src/builder.ts' },
    splitting: true,
    banner: { js: "'use client';" },
  },
  { ...shared, entry: { 'language/index': 'src/language.ts' } },
]);
