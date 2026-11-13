/**
 * The implementation table for the PSL standard library, keyed module -> function, plus `buildStdlib`
 * which turns the manifest + impls into PSL namespace values.
 *
 * Every impl MUST have a matching manifest declaration and vice versa - the parity test enforces it,
 * so a new library function is added in exactly two places (here + the manifest) and pinned by a
 * conformance fixture. Impls are TOTAL: a wrong-typed argument yields a sensible default (usually
 * `null`) rather than throwing (the evaluator also converts any throw into a soft fail, but an impl
 * should not lean on that backstop).
 */
import {
  Decimal,
  NativeFunction,
  equals,
  truthy,
  valueToString,
  type NativeContext,
  type PslMap,
  type Value,
} from '../values';
import { STDLIB_MANIFEST } from './manifest';

type Impl = (args: Value[], ctx: NativeContext) => Value;

const ONE_DEC = Decimal.fromString('1');

/** A total ordering for `list.sort`: numbers numerically, strings lexically, anything else equal. */
function naturalCompare(x: Value, y: Value): number {
  if (x instanceof Decimal && y instanceof Decimal) {
    return x.compare(y);
  }
  if (typeof x === 'string' && typeof y === 'string') {
    return x < y ? -1 : x > y ? 1 : 0;
  }

  return 0;
}

/** Fixed-decimal string with exactly `places` fractional digits (half-up), for money-style display. */
function fixedFormat(n: Decimal, places: number): string {
  const p = Math.max(0, Math.trunc(places));
  const rounded = n.div(ONE_DEC, p) ?? n; // dividing by 1 never returns null
  const s = rounded.toString();
  if (p === 0) {
    return s.split('.')[0];
  }
  const [intPart, frac = ''] = s.split('.');

  return `${intPart}.${(frac + '0'.repeat(p)).slice(0, p)}`;
}

/** Smallest (dir -1) or largest (dir +1) numeric element of a list; null if none/empty/not a list. */
function pick(list: Value, dir: number): Value {
  if (!Array.isArray(list)) {
    return null;
  }
  let best: Decimal | null = null;
  for (const v of list) {
    if (v instanceof Decimal && (best === null || Math.sign(v.compare(best)) === Math.sign(dir))) {
      best = v;
    }
  }

  return best;
}

const DAY_MS = 86_400_000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parse a strict `YYYY-MM-DD` real calendar date into its parts, or null. Total, no throw. */
function parseISO(v: Value): { y: number; m: number; d: number } | null {
  if (typeof v !== 'string') {
    return null;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) {
    return null;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  // Round-trip through the UTC calendar to reject an impossible date (e.g. 2026-02-30).
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }

  return { y, m: mo, d };
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function epochOf(p: { y: number; m: number; d: number }): number {
  return Date.UTC(p.y, p.m - 1, p.d);
}

/** Whole years from `birth` to `asOf` (both YYYY-MM-DD), or null. Shared by date.age and imm.age. */
function ageYears(birth: Value, asOf: Value): Decimal | null {
  const b = parseISO(birth);
  const on = parseISO(asOf);
  if (!b || !on) {
    return null;
  }
  let years = on.y - b.y;
  if (on.m < b.m || (on.m === b.m && on.d < b.d)) {
    years -= 1;
  }

  return new Decimal(BigInt(years), 0);
}

const IMPLS: Record<string, Record<string, Impl>> = {
  string: {
    upper: (a) => (typeof a[0] === 'string' ? a[0].toUpperCase() : null),
    lower: (a) => (typeof a[0] === 'string' ? a[0].toLowerCase() : null),
    trim: (a) => (typeof a[0] === 'string' ? a[0].trim() : null),
    length: (a) => (typeof a[0] === 'string' ? new Decimal(BigInt(a[0].length), 0) : null),
    contains: (a) => (typeof a[0] === 'string' && typeof a[1] === 'string' ? a[0].includes(a[1]) : false),
    replace: (a) =>
      typeof a[0] === 'string' && typeof a[1] === 'string' && typeof a[2] === 'string'
        ? a[0].split(a[1]).join(a[2])
        : null,
    split: (a) => (typeof a[0] === 'string' && typeof a[1] === 'string' ? a[0].split(a[1]) : []),
    join: (a) => (Array.isArray(a[0]) && typeof a[1] === 'string' ? a[0].map(valueToString).join(a[1]) : ''),
  },
  number: {
    round: (a) =>
      a[0] instanceof Decimal
        ? a[0].div(ONE_DEC, Math.max(0, Math.trunc(a[1] instanceof Decimal ? a[1].toNumber() : 0))) ?? null
        : null,
    floor: (a) => (a[0] instanceof Decimal ? a[0].floor() : null),
    ceil: (a) => (a[0] instanceof Decimal ? a[0].ceil() : null),
    abs: (a) => (a[0] instanceof Decimal ? a[0].abs() : null),
    min: (a) => pick(a[0], -1),
    max: (a) => pick(a[0], 1),
    format: (a) => (a[0] instanceof Decimal ? fixedFormat(a[0], a[1] instanceof Decimal ? a[1].toNumber() : 0) : null),
  },
  list: {
    length: (a) => (Array.isArray(a[0]) ? new Decimal(BigInt(a[0].length), 0) : null),
    // push/concat/slice/reverse/sort return a NEW list - values are shared by reference in PSL, so a
    // predictable copy beats a surprising in-place mutation.
    push: (a) => (Array.isArray(a[0]) ? [...a[0], a[1]] : null),
    concat: (a) => (Array.isArray(a[0]) && Array.isArray(a[1]) ? [...a[0], ...a[1]] : null),
    contains: (a) => (Array.isArray(a[0]) ? a[0].some((x) => equals(x, a[1])) : false),
    indexOf: (a) => (Array.isArray(a[0]) ? new Decimal(BigInt(a[0].findIndex((x) => equals(x, a[1]))), 0) : null),
    slice: (a) => {
      if (!Array.isArray(a[0])) {
        return null;
      }
      const start = a[1] instanceof Decimal ? a[1].toNumber() : 0;
      const end = a[2] instanceof Decimal ? a[2].toNumber() : a[0].length;

      return a[0].slice(start, end);
    },
    reverse: (a) => (Array.isArray(a[0]) ? [...a[0]].reverse() : null),
    sort: (a) => (Array.isArray(a[0]) ? [...a[0]].sort(naturalCompare) : null),
    map: (a, ctx) => (Array.isArray(a[0]) ? a[0].map((x) => ctx.call(a[1], [x])) : null),
    filter: (a, ctx) => (Array.isArray(a[0]) ? a[0].filter((x) => truthy(ctx.call(a[1], [x]))) : null),
    find: (a, ctx) => (Array.isArray(a[0]) ? a[0].find((x) => truthy(ctx.call(a[1], [x]))) ?? null : null),
    reduce: (a, ctx) => (Array.isArray(a[0]) ? a[0].reduce((acc, x) => ctx.call(a[1], [acc, x]), a[2]) : null),
    sum: (a) =>
      Array.isArray(a[0])
        ? a[0].reduce((acc: Decimal, v) => (v instanceof Decimal ? acc.add(v) : acc), Decimal.fromString('0'))
        : null,
  },
  map: {
    keys: (a) => (a[0] instanceof Map ? [...a[0].keys()] : null),
    values: (a) => (a[0] instanceof Map ? [...a[0].values()] : null),
    entries: (a) => (a[0] instanceof Map ? [...a[0].entries()].map(([k, v]) => [k, v] as Value[]) : null),
    has: (a) => (a[0] instanceof Map && typeof a[1] === 'string' ? a[0].has(a[1]) : false),
    get: (a) => (a[0] instanceof Map && typeof a[1] === 'string' ? a[0].get(a[1]) ?? null : null),
    set: (a) => {
      if (!(a[0] instanceof Map) || typeof a[1] !== 'string') {
        return null;
      }
      const copy: PslMap = new Map(a[0]);
      copy.set(a[1], a[2]);

      return copy;
    },
    merge: (a) => (a[0] instanceof Map && a[1] instanceof Map ? new Map([...a[0], ...a[1]]) : null),
    size: (a) => (a[0] instanceof Map ? new Decimal(BigInt(a[0].size), 0) : null),
  },
  date: {
    // "Today" is whatever the page injected (a YYYY-MM-DD string), never a wall clock - so a live page
    // and any test agree and there is no hydration mismatch. Null when the page supplied no `now`.
    today: (args, ctx) => ctx.now,
    parse: (a) => {
      const p = parseISO(a[0]);

      return p ? toISO(p.y, p.m, p.d) : null;
    },
    format: (a) => {
      const p = parseISO(a[0]);
      if (!p || typeof a[1] !== 'string') {
        return null;
      }

      return a[1].split('YYYY').join(String(p.y)).split('MM').join(pad2(p.m)).split('DD').join(pad2(p.d));
    },
    addDays: (a) => {
      const p = parseISO(a[0]);
      if (!p || !(a[1] instanceof Decimal)) {
        return null;
      }
      const n = a[1].toNumber();
      if (!Number.isInteger(n)) {
        return null;
      }
      const dt = new Date(epochOf(p) + n * DAY_MS);

      return toISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    },
    diffDays: (a) => {
      const from = parseISO(a[0]);
      const to = parseISO(a[1]);
      if (!from || !to) {
        return null;
      }

      return new Decimal(BigInt(Math.round((epochOf(to) - epochOf(from)) / DAY_MS)), 0);
    },
    age: (a) => ageYears(a[0], a[1]),
  },
  // Immigration convenience helpers. By deliberate design these carry NO authoritative government
  // constants (fee amounts, CRS point tables): those change and Portify maintains them elsewhere, so
  // baking a second copy here would quote stale numbers on a live site. Each helper does ARITHMETIC
  // over figures the page supplies - the consultant/Porter owns the numbers, PSL just totals them.
  imm: {
    age: (a) => ageYears(a[0], a[1]),
    // feeTotal(counts, rates): sum of counts[k] * rates[k] over the applicant types both maps share,
    // e.g. imm.feeTotal({adult: 2, child: 1}, {adult: 1590, child: 270}).
    feeTotal: (a) => {
      if (!(a[0] instanceof Map) || !(a[1] instanceof Map)) {
        return null;
      }
      let total = Decimal.fromString('0');
      for (const [type, count] of a[0]) {
        const rate = a[1].get(type);
        if (count instanceof Decimal && rate instanceof Decimal) {
          total = total.add(count.mul(rate));
        }
      }

      return total;
    },
    // pointsTotal(blocks, cap): sum a list of point subtotals, clamped to a supplied maximum - the
    // shape of a CRS-style capped sum without asserting any point table, e.g.
    // imm.pointsTotal([core, spouse, transferability, additional], 1200).
    pointsTotal: (a) => {
      if (!Array.isArray(a[0])) {
        return null;
      }
      let sum = Decimal.fromString('0');
      for (const v of a[0]) {
        if (v instanceof Decimal) {
          sum = sum.add(v);
        }
      }

      return a[1] instanceof Decimal && sum.compare(a[1]) > 0 ? a[1] : sum;
    },
  },
};

export { IMPLS };

/**
 * Build the standard-library namespaces as PSL values: one global per module, each a map of native
 * functions keyed by function name. `runPsl` injects these under the caller's context, so a page can
 * shadow a name if it truly must. A native's `name` is `module.fn` for clear diagnostics.
 */
export function buildStdlib(): Record<string, PslMap> {
  const namespaces: Record<string, PslMap> = {};

  for (const [moduleName, fns] of Object.entries(STDLIB_MANIFEST.modules)) {
    const ns: PslMap = new Map();
    for (const [fnName, decl] of Object.entries(fns)) {
      const impl = IMPLS[moduleName]?.[fnName];
      if (!impl) {
        continue; // the parity test guarantees this never happens; skip defensively
      }
      ns.set(fnName, new NativeFunction(`${moduleName}.${fnName}`, decl.arity, impl));
    }
    namespaces[moduleName] = ns;
  }

  return namespaces;
}
