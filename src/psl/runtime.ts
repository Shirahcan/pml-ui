/**
 * The per-page PSL runtime: ONE shared global scope that every `<script>` on the page executes into,
 * in document order. This is what makes PSL script-like rather than one-shot - a function a `<script>`
 * defines lives in this shared scope, so a later `<script>` (and, in a later phase, an event handler)
 * can call it, exactly as two `<script>` tags share `window` in a browser but as a safe subset.
 *
 * It is framework-agnostic (pure TS); a React provider holds one instance per rendered page and each
 * `PslScript` component runs its program through it. The security properties are unchanged from the
 * one-shot evaluator: the shared scope holds only PSL values (no host, DOM, or network is reachable),
 * every run is bounded by the step budget, and a fault soft-fails to a diagnostic instead of throwing
 * at the page.
 */

import { buildDomNamespace } from './dom/elementNamespace';
import { ElementStore } from './dom/elementStore';
import { Environment } from './environment';
import { Evaluator, type Result, type RuntimeDiagnostic } from './evaluator';
import { ReactiveStore, buildStateNamespace } from './reactive';
import { buildStdlib } from './stdlib';
import type { Node, Program } from './ast';
import { NativeFunction, PslFunction, type Value } from './values';

export interface PageRuntimeOptions {
  /** "Today" as YYYY-MM-DD, injected by the page (never a wall clock), so date helpers stay deterministic. */
  now?: string;
  /** Page-supplied globals (the consultant's real data), defined in the shared scope for scripts to read. */
  context?: Record<string, Value>;
  /** Per-script step budget - a runaway script stops the visitor's own tab (bystander safety). */
  maxSteps?: number;
  /**
   * Per-EVENT-HANDLER step budget, applied afresh to each `callGlobal`. Tighter than the page-load
   * script budget because a handler runs on every interaction, so it must stay snappy; a runaway
   * handler soft-fails at this bound instead of janking the tab. Defaults to 50k steps.
   */
  eventBudget?: number;
}

/** Default per-handler gas: generous for real toggle/filter/compute logic, tight enough to stay snappy. */
const DEFAULT_EVENT_BUDGET = 50_000;

export class PageRuntime {
  private readonly global: Environment;

  private readonly evaluator: Evaluator;

  /** The page's ONE reactive state store; the renderer's reactive bindings subscribe to it. */
  readonly store: ReactiveStore;

  /** The page's ONE element-mutation store; a keyed node subscribes to it for imperative edits (P3c). */
  readonly elements: ElementStore;

  /** Per-handler step budget, applied afresh to each callGlobal (event gas). */
  private readonly eventBudget: number;

  /** Every diagnostic from every `<script>` run so far, in run order (for the dev console / Porter). */
  readonly diagnostics: RuntimeDiagnostic[] = [];

  constructor(opts: PageRuntimeOptions = {}) {
    this.evaluator = new Evaluator({ now: opts.now, maxSteps: opts.maxSteps });
    this.global = new Environment(null);
    this.store = new ReactiveStore();
    this.elements = new ElementStore();
    this.eventBudget = opts.eventBudget ?? DEFAULT_EVENT_BUDGET;

    // The std-lib namespaces, the reactive `state` namespace, and the page's own data are seeded CONST,
    // so one <script> cannot repoint `string`/`state` (or a page value) for another. A script still
    // shadows any name freely in its own block or function scope; only reassigning the shared global is
    // refused. (The one-shot `runPsl` seeds these non-const; the shared runtime hardens them because
    // several scripts now share the scope.)
    for (const [name, value] of Object.entries(buildStdlib())) {
      this.global.define(name, value, true);
    }
    this.global.define('state', buildStateNamespace(this.store), true);
    this.global.define('dom', buildDomNamespace(this.elements), true);
    for (const [name, value] of Object.entries(opts.context ?? {})) {
      this.global.define(name, value, true);
    }
  }

  /**
   * Call a global function BY NAME - an event handler invoking a function a `<script>` defined in the
   * shared scope (e.g. a button's on-click naming `increment`). Resets the step budget per call. A
   * missing name or a non-function soft-fails to a diagnostic; it never throws at the page.
   */
  callGlobal(name: string, args: Value[] = []): Result {
    return this.callFn(this.global.get(name) ?? null, args, `"${name}" is not a function on this page.`);
  }

  /**
   * Call an arbitrary function VALUE at the per-handler event budget - the path for an imperative
   * `dom.el(...).on(event, fn)` handler, which the renderer holds as a value rather than a global name.
   * A non-function soft-fails to a diagnostic; it never throws at the page.
   */
  callFn(fn: Value, args: Value[] = [], notCallableMessage = 'That element handler is not a function.'): Result {
    if (!(fn instanceof PslFunction) && !(fn instanceof NativeFunction)) {
      const diag = { code: 'not-a-function', message: notCallableMessage };
      this.diagnostics.push(diag);

      return { value: null, ok: false, diagnostics: [diag] };
    }

    const result = this.evaluator.callValue(fn, args, this.eventBudget);
    if (result.diagnostics.length > 0) {
      this.diagnostics.push(...result.diagnostics);
    }

    return result;
  }

  /**
   * The value of ONE expression on an element (PML v3 L3: `text={owner.name}`, `if={state.open}`),
   * read in the page's shared scope plus `locals` (the `each` items around the element). Never throws:
   * a fault reads as null (the element shows nothing for it) and is kept in {@link diagnostics}.
   */
  evaluate(expr: Node, locals: Record<string, Value> = {}): Value {
    const result = this.evaluator.evaluate(expr, this.scope(locals), this.eventBudget);

    if (result.diagnostics.length > 0) {
      this.diagnostics.push(...result.diagnostics);
    }

    return result.ok ? result.value : null;
  }

  /**
   * Run an event handler (`on-click={...}`): the expression is evaluated (so `state.open = true` writes
   * the store), and if it names a function (`on-click={togglePanel}`) that function is called. At the
   * per-handler budget; never throws.
   */
  handle(expr: Node, locals: Record<string, Value> = {}): void {
    const value = this.evaluate(expr, locals);

    if (value instanceof PslFunction || value instanceof NativeFunction) {
      this.callFn(value);
    }
  }

  /** The shared page scope, with an element's `each` items layered on top (never written back). */
  private scope(locals: Record<string, Value>): Environment {
    const names = Object.keys(locals);

    if (names.length === 0) {
      return this.global;
    }

    const env = new Environment(this.global);

    for (const name of names) {
      env.define(name, locals[name], true);
    }

    return env;
  }

  /**
   * Execute one `<script>`'s compiled program into the shared page scope. Its top-level declarations
   * (functions, consts) persist for later scripts. Returns the run result (its optional top-level
   * return value + any diagnostics); diagnostics are also accumulated on {@link diagnostics}.
   */
  run(program: Program): Result {
    const result = this.evaluator.runInto(program, this.global);
    if (result.diagnostics.length > 0) {
      this.diagnostics.push(...result.diagnostics);
    }

    return result;
  }
}
