import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', 'language/index': 'src/language.ts' },
  // CJS too, so a product's jest (CommonJS, node_modules untransformed) can require it.
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['react', 'react-dom', 'lucide-react'],
  // The renderer is client components and hooks: mark the bundle for the Next.js app router, or a product
  // importing it from a server component gets a build error that names this package, not its own file.
  banner: { js: "'use client';" },
});
