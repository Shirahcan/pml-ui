/**
 * Public surface of the PSL browser runtime. The later PML-binding plan imports from here; nothing
 * outside this folder should reach into the individual modules.
 */

import { Evaluator, type EvaluatorOptions, type Result } from './evaluator';
import { buildStdlib } from './stdlib';
import type { Program } from './ast';
import type { Value } from './values';

export { Evaluator } from './evaluator';
export type { Result, RuntimeDiagnostic, EvaluatorOptions } from './evaluator';
export { Environment } from './environment';
export { Decimal, NativeFunction, PslFunction, truthy, equals, typeName, valueToString } from './values';
export type { Value, PslMap } from './values';
export type { Node, Program } from './ast';
export { buildStdlib, STDLIB_MANIFEST } from './stdlib';
export { PageRuntime } from './runtime';
export type { PageRuntimeOptions } from './runtime';
export { ReactiveStore, buildStateNamespace } from './reactive';
export { ElementStore, applyMutation, createVirtualNode, SETTABLE_ATTRS, URL_ATTRS } from './dom/elementStore';
export type { MutationRecord } from './dom/elementStore';
export { buildDomNamespace } from './dom/elementNamespace';

/**
 * Evaluate a compiled PSL program (the AST-JSON the server produced) against a value context. Never
 * throws for a PSL fault - a runtime problem comes back as `{ ok: false, diagnostics }`.
 *
 * The standard-library namespaces are injected UNDER the caller's context, so a page (or a test) can
 * shadow any name by supplying its own. Pass `{ ...opts, stdlib: false }`-style overrides is not
 * needed today; if a caller ever wants the bare language, it can call `new Evaluator().run(...)`.
 */
export function runPsl(program: Program, context: Record<string, Value> = {}, opts?: EvaluatorOptions): Result {
  // "Today" for date helpers comes from an explicit option or a `now` string in the context (never a
  // wall clock), so results are deterministic and SSR-safe.
  const now = opts?.now ?? (typeof context.now === 'string' ? context.now : undefined);
  const withStdlib: Record<string, Value> = { ...buildStdlib(), ...context };

  return new Evaluator({ ...opts, now }).run(program, withStdlib);
}
