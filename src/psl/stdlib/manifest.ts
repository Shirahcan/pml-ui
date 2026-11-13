/**
 * Typed mirror of `backend/resources/psl/stdlib/manifest.json` - the single source of truth for the
 * standard-library surface, read by BOTH the PHP analyzer (member + arity checks) and this TS
 * evaluator (native registration). A parity test asserts this mirror equals the JSON, exactly like
 * `PrimitiveSchema.php` <-> `primitives.ts`. Do NOT edit one without the other; the test fails on drift.
 *
 * The browser reads this TS copy (no runtime fetch of the JSON); the JSON stays the canonical form the
 * PHP side consumes.
 */
export type StdlibType = 'number' | 'string' | 'boolean' | 'list' | 'map' | 'any';

export interface StdlibFn {
  /** Exact expected argument count, or null for a variadic. */
  arity: number | null;
  args: StdlibType[];
  returns: StdlibType;
}

export interface StdlibManifest {
  version: number;
  modules: Record<string, Record<string, StdlibFn>>;
}

export const STDLIB_MANIFEST: StdlibManifest = {
  version: 1,
  modules: {
    string: {
      upper: { arity: 1, args: ['string'], returns: 'string' },
      lower: { arity: 1, args: ['string'], returns: 'string' },
      trim: { arity: 1, args: ['string'], returns: 'string' },
      length: { arity: 1, args: ['string'], returns: 'number' },
      contains: { arity: 2, args: ['string', 'string'], returns: 'boolean' },
      replace: { arity: 3, args: ['string', 'string', 'string'], returns: 'string' },
      split: { arity: 2, args: ['string', 'string'], returns: 'list' },
      join: { arity: 2, args: ['list', 'string'], returns: 'string' },
    },
    number: {
      round: { arity: 2, args: ['number', 'number'], returns: 'number' },
      floor: { arity: 1, args: ['number'], returns: 'number' },
      ceil: { arity: 1, args: ['number'], returns: 'number' },
      abs: { arity: 1, args: ['number'], returns: 'number' },
      min: { arity: 1, args: ['list'], returns: 'number' },
      max: { arity: 1, args: ['list'], returns: 'number' },
      format: { arity: 2, args: ['number', 'number'], returns: 'string' },
    },
    list: {
      length: { arity: 1, args: ['list'], returns: 'number' },
      push: { arity: 2, args: ['list', 'any'], returns: 'list' },
      concat: { arity: 2, args: ['list', 'list'], returns: 'list' },
      contains: { arity: 2, args: ['list', 'any'], returns: 'boolean' },
      indexOf: { arity: 2, args: ['list', 'any'], returns: 'number' },
      slice: { arity: 3, args: ['list', 'number', 'number'], returns: 'list' },
      reverse: { arity: 1, args: ['list'], returns: 'list' },
      sort: { arity: 1, args: ['list'], returns: 'list' },
      map: { arity: 2, args: ['list', 'any'], returns: 'list' },
      filter: { arity: 2, args: ['list', 'any'], returns: 'list' },
      find: { arity: 2, args: ['list', 'any'], returns: 'any' },
      reduce: { arity: 3, args: ['list', 'any', 'any'], returns: 'any' },
      sum: { arity: 1, args: ['list'], returns: 'number' },
    },
    map: {
      keys: { arity: 1, args: ['map'], returns: 'list' },
      values: { arity: 1, args: ['map'], returns: 'list' },
      entries: { arity: 1, args: ['map'], returns: 'list' },
      has: { arity: 2, args: ['map', 'string'], returns: 'boolean' },
      get: { arity: 2, args: ['map', 'string'], returns: 'any' },
      set: { arity: 3, args: ['map', 'string', 'any'], returns: 'map' },
      merge: { arity: 2, args: ['map', 'map'], returns: 'map' },
      size: { arity: 1, args: ['map'], returns: 'number' },
    },
    date: {
      today: { arity: 0, args: [], returns: 'string' },
      parse: { arity: 1, args: ['string'], returns: 'string' },
      format: { arity: 2, args: ['string', 'string'], returns: 'string' },
      addDays: { arity: 2, args: ['string', 'number'], returns: 'string' },
      diffDays: { arity: 2, args: ['string', 'string'], returns: 'number' },
      age: { arity: 2, args: ['string', 'string'], returns: 'number' },
    },
    imm: {
      age: { arity: 2, args: ['string', 'string'], returns: 'number' },
      feeTotal: { arity: 2, args: ['map', 'map'], returns: 'number' },
      pointsTotal: { arity: 2, args: ['list', 'number'], returns: 'number' },
    },
  },
};
