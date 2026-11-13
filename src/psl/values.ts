/**
 * PSL's runtime value model, executed in the browser.
 *
 * The number type is a self-contained, dependency-free decimal (a BigInt mantissa + a scale), NOT a
 * float - so `0.1 + 0.2` is exactly `0.3` and money/points math a consultant quotes on their site is
 * correct. There is deliberately no external decimal library (offline-safe, tiny).
 */

import type { Block, Param } from './ast';
import type { Environment } from './environment';

// BigInt literal syntax (`0n`) needs an ES2020 target; the app targets lower, so build the constants
// via BigInt() instead. Same values, no `Nn` literals.
const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const TEN = BigInt(10);

/** An arbitrary-precision decimal: value = int * 10^-scale. Immutable and total (no throws). */
export class Decimal {
  constructor(
    readonly int: bigint,
    readonly scale: number,
  ) {}

  static fromString(s: string): Decimal {
    const neg = s.startsWith('-');
    const body = neg ? s.slice(1) : s;
    const dot = body.indexOf('.');

    let digits: string;
    let scale: number;
    if (dot === -1) {
      digits = body;
      scale = 0;
    } else {
      digits = body.slice(0, dot) + body.slice(dot + 1);
      scale = body.length - dot - 1;
    }

    let int = BigInt(digits === '' ? '0' : digits);
    if (neg) {
      int = -int;
    }

    return new Decimal(int, scale).normalize();
  }

  isZero(): boolean {
    return this.int === ZERO;
  }

  add(o: Decimal): Decimal {
    const [a, b, s] = Decimal.align(this, o);

    return new Decimal(a + b, s).normalize();
  }

  sub(o: Decimal): Decimal {
    const [a, b, s] = Decimal.align(this, o);

    return new Decimal(a - b, s).normalize();
  }

  mul(o: Decimal): Decimal {
    return new Decimal(this.int * o.int, this.scale + o.scale).normalize();
  }

  /** Division to a bounded scale with half-up rounding. Returns null on a zero divisor (soft-fail). */
  div(o: Decimal, maxScale = 20): Decimal | null {
    if (o.int === ZERO) {
      return null;
    }

    const shift = maxScale + o.scale - this.scale;
    let num = this.int;
    let den = o.int;
    if (shift >= 0) {
      num *= TEN ** BigInt(shift);
    } else {
      den *= TEN ** BigInt(-shift);
    }

    return new Decimal(Decimal.divRoundHalfUp(num, den), maxScale).normalize();
  }

  /** Remainder. Returns null on a zero divisor (soft-fail). */
  mod(o: Decimal): Decimal | null {
    if (o.int === ZERO) {
      return null;
    }

    const [a, b, s] = Decimal.align(this, o);

    return new Decimal(a % b, s).normalize();
  }

  neg(): Decimal {
    return new Decimal(-this.int, this.scale);
  }

  /** Absolute value. */
  abs(): Decimal {
    return this.int < ZERO ? new Decimal(-this.int, this.scale) : this;
  }

  /** Largest integer <= this (toward negative infinity), so floor(-2.1) is -3. */
  floor(): Decimal {
    if (this.scale === 0) {
      return this;
    }
    const f = TEN ** BigInt(this.scale);
    let q = this.int / f;
    if (this.int % f !== ZERO && this.int < ZERO) {
      q -= ONE;
    }

    return new Decimal(q, 0);
  }

  /** Smallest integer >= this (toward positive infinity), so ceil(2.1) is 3. */
  ceil(): Decimal {
    if (this.scale === 0) {
      return this;
    }
    const f = TEN ** BigInt(this.scale);
    let q = this.int / f;
    if (this.int % f !== ZERO && this.int > ZERO) {
      q += ONE;
    }

    return new Decimal(q, 0);
  }

  compare(o: Decimal): number {
    const [a, b] = Decimal.align(this, o);

    return a < b ? -1 : a > b ? 1 : 0;
  }

  eq(o: Decimal): boolean {
    return this.compare(o) === 0;
  }

  toNumber(): number {
    return Number(this.toString());
  }

  /** Canonical decimal string: no trailing fractional zeros, no negative zero. */
  toString(): string {
    const n = this.normalize();
    if (n.scale === 0) {
      return n.int.toString();
    }

    const neg = n.int < ZERO;
    let digits = (neg ? -n.int : n.int).toString();
    while (digits.length <= n.scale) {
      digits = `0${digits}`;
    }
    const cut = digits.length - n.scale;

    return `${neg ? '-' : ''}${digits.slice(0, cut)}.${digits.slice(cut)}`;
  }

  private normalize(): Decimal {
    let int = this.int;
    let scale = this.scale;
    while (scale > 0 && int % TEN === ZERO) {
      int /= TEN;
      scale -= 1;
    }
    if (int === ZERO) {
      scale = 0;
    }

    return new Decimal(int, scale);
  }

  /** @return [aInt, bInt, sharedScale] with both mantissas raised to the larger scale. */
  private static align(a: Decimal, b: Decimal): [bigint, bigint, number] {
    const scale = Math.max(a.scale, b.scale);

    return [
      a.int * TEN ** BigInt(scale - a.scale),
      b.int * TEN ** BigInt(scale - b.scale),
      scale,
    ];
  }

  private static divRoundHalfUp(num: bigint, den: bigint): bigint {
    const negative = num < ZERO !== den < ZERO;
    const a = num < ZERO ? -num : num;
    const b = den < ZERO ? -den : den;
    const q = a / b;
    const r = a % b;
    const rounded = TWO * r >= b ? q + ONE : q;

    return negative ? -rounded : rounded;
  }
}

/** A user-defined PSL function value: its parameters, its body, and the scope it closed over. */
export class PslFunction {
  constructor(
    readonly params: Param[],
    readonly body: Block,
    readonly closure: Environment,
  ) {}
}

/**
 * The capabilities the evaluator hands a native when it runs. Today just `call`, so a higher-order
 * library function (`list.map`, `list.reduce`, ...) can invoke a PSL function argument under the SAME
 * step budget as the surrounding program. Deliberately tiny - a native can compute and call, nothing
 * else (no host, no I/O).
 */
export interface NativeContext {
  call(fn: Value, args: Value[]): Value;
  /**
   * "Today" as a `YYYY-MM-DD` string, injected by the page (never a wall clock), or null when the
   * page did not supply one. Keeps date helpers deterministic and SSR-safe - the same reason the
   * workflow engine bans `Date.now()`.
   */
  now: string | null;
}

/**
 * A host-backed callable: the foundation of the standard library. `impl` receives the already-evaluated
 * argument values (and a `NativeContext` for calling back into PSL) and returns a value; `arity` is the
 * exact expected argument count, or `null` for a variadic. The evaluator enforces arity and turns any
 * throw from `impl` into a soft fail, so a library function can never crash the engine out of the page.
 * Impls are expected to be TOTAL (validate their inputs and return a sensible default rather than
 * throwing), matching PSL's soft-fail model - the throw-to-soft-fail conversion is a backstop, not the
 * happy path.
 */
export class NativeFunction {
  constructor(
    readonly name: string,
    readonly arity: number | null,
    readonly impl: (args: Value[], ctx: NativeContext) => Value,
  ) {}
}

/** PSL maps are string-keyed and preserve insertion order (a JS Map). */
export type PslMap = Map<string, Value>;

/**
 * The minimal reactive-store surface a {@link ReactiveState} routes to. Declared HERE (not imported
 * from reactive.ts) so values.ts stays dependency-free and there is no import cycle; reactive.ts's
 * ReactiveStore satisfies it.
 */
export interface ReactiveStateStore {
  get(key: string): Value;
  set(key: string, value: Value): void;
  has(key: string): boolean;
}

/**
 * The `state` value: a reactive object whose member / index access and assignment route to the page's
 * reactive store, so a script reads `state.count` and writes `state.count = 5` / `state.count += 1`
 * (or `state.count++`) and the bound nodes re-render. Object notation is the ONLY surface - the old
 * get/set/has methods were removed - and `state["x"]` reads the same store data. It is the only mutable
 * shared surface PSL has and holds plain PSL values; no host/DOM/node is reachable through it.
 */
export class ReactiveState {
  constructor(readonly store: ReactiveStateStore) {}
}

export type Value =
  | Decimal
  | string
  | boolean
  | null
  | Value[]
  | PslMap
  | PslFunction
  | NativeFunction
  | ReactiveState;

/** Falsy: null, false, "", 0, [], {}. Mirrors PML's `present` rules. */
export function truthy(v: Value): boolean {
  if (v === null) {
    return false;
  }
  if (typeof v === 'boolean') {
    return v;
  }
  if (typeof v === 'string') {
    return v.trim() !== '';
  }
  if (v instanceof Decimal) {
    return !v.isZero();
  }
  if (Array.isArray(v)) {
    return v.length > 0;
  }
  if (v instanceof Map) {
    return v.size > 0;
  }

  return true; // a function is truthy
}

/** Structural equality with NO cross-type coercion; never throws. */
export function equals(a: Value, b: Value): boolean {
  if (a instanceof Decimal && b instanceof Decimal) {
    return a.eq(b);
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return a === b;
  }
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return a === b;
  }
  if (a === null || b === null) {
    return a === b;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => equals(x, b[i]));
  }
  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) {
      return false;
    }
    for (const [k, v] of a) {
      if (!b.has(k) || !equals(v, b.get(k) as Value)) {
        return false;
      }
    }

    return true;
  }

  // different types, or two functions -> reference/identity (never throws)
  return a === b;
}

export function typeName(v: Value): string {
  if (v === null) {
    return 'null';
  }
  if (typeof v === 'boolean') {
    return 'boolean';
  }
  if (typeof v === 'string') {
    return 'string';
  }
  if (v instanceof Decimal) {
    return 'number';
  }
  if (Array.isArray(v)) {
    return 'list';
  }
  if (v instanceof Map) {
    return 'map';
  }
  if (v instanceof ReactiveState) {
    return 'map';
  }

  return 'function';
}

/** Render a value the way the conformance corpus expects (scalars exact; collections readable). */
export function valueToString(v: Value): string {
  if (v === null) {
    return 'null';
  }
  if (typeof v === 'boolean') {
    return v ? 'true' : 'false';
  }
  if (typeof v === 'string') {
    return v;
  }
  if (v instanceof Decimal) {
    return v.toString();
  }
  if (Array.isArray(v)) {
    return `[${v.map(valueToString).join(', ')}]`;
  }
  if (v instanceof Map) {
    return `{${[...v.entries()].map(([k, val]) => `${k}: ${valueToString(val)}`).join(', ')}}`;
  }
  if (v instanceof ReactiveState) {
    return 'state';
  }

  return 'function';
}
