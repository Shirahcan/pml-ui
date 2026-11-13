/**
 * Public surface of the PSL standard library. `runPsl` imports `buildStdlib` from here; the manifest
 * and impl table are exported for the parity test.
 */
export { buildStdlib, IMPLS } from './registry';
export { STDLIB_MANIFEST } from './manifest';
export type { StdlibManifest, StdlibFn, StdlibType } from './manifest';
