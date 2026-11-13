import { Decimal, NativeFunction, type Node, type Value } from '../psl';

/**
 * PML v3 L3 (owner 2026-11-10): a `{...}` value on an element is a PSL expression, and PML keeps no
 * placeholders of its own. The server compiles each expression once (PSL's own parser) and stores
 * `{ $expr, ast }`; the ONE evaluator, in the browser and the server render of the same component,
 * reads it against the PSL natives built here. The server never evaluates PSL.
 */
export interface PmlExpr {
  /** The PSL source, as the author wrote it between the braces. */
  $expr: string;
  /** The compiled AST the evaluator walks. */
  ast: Node;
}

/** `each={item in list}`: the item's name plus the list expression. */
export interface PmlEach extends PmlExpr {
  item: string;
}

/**
 * A dotted read (`props.title`, `owner.name`) as the expression the server's PSL parser would produce
 * for it: the same AST shape, so a value the builder writes and one parsed from the Code view are equal.
 */
export function pathExpr(path: string): PmlExpr {
  const [first, ...rest] = path.split('.');
  const at = { line: 1, col: 1 };
  const ast = rest.reduce<Node>((object, name) => ({ type: 'Member', object, name, ...at }) as Node, { type: 'Identifier', name: first, ...at } as Node);

  return { $expr: path, ast };
}

/** The setting a component prop shows (`{props.title}` -> "title"), or null. */
export function settingName(value: unknown): string | null {
  if (!isExpr(value)) return null;

  const match = /^props\.([A-Za-z_][A-Za-z0-9_]*)$/.exec(value.$expr.trim());

  return match ? match[1] : null;
}

/** The data the server sends with every render: who owns the site, the site, the page. */
export interface PmlNativesPayload {
  owner?: Record<string, unknown> | null;
  site?: Record<string, unknown> | null;
  page?: Record<string, unknown> | null;
}

export function isExpr(value: unknown): value is PmlExpr {
  return typeof value === 'object' && value !== null && typeof (value as PmlExpr).$expr === 'string' && typeof (value as PmlExpr).ast === 'object';
}

/**
 * A number's digits written out. `String()` gives a very large or very small number in exponent form
 * ("1e+21", "1e-7"), which the decimal reader cannot read, so it would throw mid-render.
 */
function plainDigits(n: number): string {
  const written = String(n);

  return /e/i.test(written) ? n.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 }) : written;
}

/** Plain JSON (the server's natives) as PSL values: numbers become exact decimals, objects maps. */
export function toPslValue(value: unknown): Value {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? Decimal.fromString(plainDigits(value)) : null;
  if (Array.isArray(value)) return value.map(toPslValue);
  if (typeof value === 'object') {
    return new Map(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toPslValue(v)]));
  }

  return null;
}

/**
 * A PSL value as what an element draws: a string, number or boolean for a prop, an array or object for
 * a list or a record. A function (or the `state` object itself) is not something a page shows: null.
 */
export function fromPslValue(value: Value): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (value instanceof Decimal) return Number(value.toString());
  if (Array.isArray(value)) return value.map(fromPslValue);
  if (value instanceof Map) return Object.fromEntries([...value.entries()].map(([k, v]) => [k, fromPslValue(v)]));

  return null;
}

/**
 * What a PSL value reads as in a page's words, the ONE rule (owner 2026-11-11: "applicable types,
 * especially native types, should be properly converted to strings"). Text as it is; a number in full
 * (0, 12, 4.5, 1990, never dropped); true or false; a list as its items' words joined with ", ". A
 * date is already text (YYYY-MM-DD). Nothing for null, a record, a function or the `state` object:
 * those are not words. A counter's `{self.count || 0}` drew nothing at all before this, at any count,
 * because only strings were read.
 */
export function valueText(value: Value): string {
  if (value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Decimal) return value.toString();
  if (Array.isArray(value)) return value.map(valueText).filter((words) => words !== '').join(', ');

  return '';
}

/** What a plain value (a stored prop, the server's data) reads as on the page: the same rule, {@link valueText}. */
export function toText(value: unknown): string {
  return valueText(toPslValue(value));
}

/** Where the visitor is, for `location` (the visitor's own address bar, never sent anywhere). */
export interface PmlLocationInput {
  path: string;
  search: string;
  hash: string;
}

/**
 * `location`: yes/no checks only (PML v3 L3). A link's words never become a value a page can draw, so a
 * crafted link cannot put "approval guaranteed" on a consultant's page.
 */
export function buildLocation(input: PmlLocationInput): Value {
  const params = new URLSearchParams(input.search);
  const hash = input.hash.replace(/^#/, '');
  const str = (v: Value): string => (typeof v === 'string' ? v : '');

  return new Map<string, Value>([
    ['path', input.path],
    ['hash_is', new NativeFunction('location.hash_is', 1, ([name]) => hash === str(name))],
    ['query_is', new NativeFunction('location.query_is', 2, ([name, value]) => params.get(str(name)) === str(value))],
    ['has_query', new NativeFunction('location.has_query', 1, ([name]) => params.has(str(name)))],
  ]);
}

/** The visitor's screen, by the same widths the page's own layout switches at (md 768px, lg 1024px). */
export function deviceFor(width: number): 'phone' | 'tablet' | 'desktop' {
  if (width < 768) return 'phone';
  if (width < 1024) return 'tablet';

  return 'desktop';
}

/**
 * The natives a page's expressions read: `owner`, `site`, `page` from the server, `location` and
 * `device` from the browser (both absent in the server render and the first paint, so the two agree).
 */
export function buildNatives(
  payload: PmlNativesPayload | null | undefined,
  browser?: { location?: PmlLocationInput | null; device?: string | null },
): Record<string, Value> {
  return {
    owner: toPslValue(payload?.owner ?? null),
    site: toPslValue(payload?.site ?? null),
    page: toPslValue(payload?.page ?? null),
    location: browser?.location ? buildLocation(browser.location) : null,
    device: browser?.device ?? null,
  };
}
