import type { Node } from '../psl';

/**
 * A component setting's list or map value, written JS-like (component props p07b, 2026-11-11; owner: "properly
 * support specifying lists/arrays and maps (key-value pairs, JS-like)"): `[{name: "Starter", price: 49}]`.
 *
 * The builder only WRITES the text. The server reads every `{...}` from its text with PSL's own parser and stores
 * that tree (p01), so there is no second parser here: a value is read back from the tree the server stored,
 * and a value this editor has just written is remembered until the server's copy arrives.
 */

export type LiteralValue = string | number | boolean | null | LiteralValue[] | { [key: string]: LiteralValue };

/** A `{...}` value as the builder writes it: the text, the server adds the tree. */
export interface LiteralExpr {
  $expr: string;
  ast?: Node;
}

const written = new WeakMap<object, LiteralValue>();

/** A number's digits written out (never "1e+21", which PSL cannot read). */
function digits(n: number): string {
  const text = String(n);

  return /e/i.test(text) ? n.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 }) : text;
}

/** A value as PSL literal text. */
export function literalText(value: LiteralValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
  if (typeof value === 'number') return Number.isFinite(value) ? digits(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(literalText).join(', ')}]`;

  return `{${Object.entries(value)
    .map(([key, item]) => `${key}: ${literalText(item)}`)
    .join(', ')}}`;
}

/** A value as the expression a setting stores (the server builds its tree on save). */
export function literalExpr(value: LiteralValue): LiteralExpr {
  const expr: LiteralExpr = { $expr: literalText(value) };

  written.set(expr, value);

  return expr;
}

/** A stored setting value back as rows to edit; undefined when it is page data (`owner.packages`), not a literal. */
export function literalValue(value: unknown): LiteralValue | undefined {
  if (value === null || typeof value !== 'object') return undefined;

  const remembered = written.get(value);
  if (remembered !== undefined) return remembered;

  const ast = (value as LiteralExpr).ast;

  return ast ? fromAst(ast) : undefined;
}

function fromAst(ast: Node): LiteralValue | undefined {
  const node = ast as unknown as Record<string, unknown>;

  switch (node.type) {
    case 'StringLit':
      return String(node.value ?? '');
    case 'NumberLit':
      return Number(node.value);
    case 'BoolLit':
      return node.value === true;
    case 'NullLit':
      return null;
    case 'ListLit': {
      const items = ((node.elements as Node[] | undefined) ?? []).map(fromAst);

      return items.some((item) => item === undefined) ? undefined : (items as LiteralValue[]);
    }
    case 'MapLit': {
      const out: Record<string, LiteralValue> = {};

      for (const entry of (node.entries as Array<{ key: string; value: Node }> | undefined) ?? []) {
        const item = fromAst(entry.value);
        if (item === undefined) return undefined;
        out[entry.key] = item;
      }

      return out;
    }
    default:
      return undefined;
  }
}
