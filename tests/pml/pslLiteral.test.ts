import { literalExpr, literalText, literalValue } from '../../src/pml/pslLiteral';
import type { Node } from '../../src/psl';

/**
 * Component props p07b (2026-11-11): a list or map setting is written JS-like for the server to read with PSL's
 * own parser, and read back from the tree the server stored.
 */
describe('pslLiteral', () => {
  it('writes values as PSL literal text', () => {
    expect(literalText([{ name: 'Starter', price: 49, featured: true }, { name: 'Firm "Pro"', price: 1e21, featured: false }])).toBe(
      '[{name: "Starter", price: 49, featured: true}, {name: "Firm \\"Pro\\"", price: 1000000000000000000000, featured: false}]',
    );
    expect(literalText({ email: 'a@b.c', hours: ['9-5', 'Sat'] })).toBe('{email: "a@b.c", hours: ["9-5", "Sat"]}');
    expect(literalText('line one\nline two')).toBe('"line one\\nline two"');
  });

  it('remembers what it just wrote until the server tree arrives', () => {
    const value = [{ name: 'Starter', price: 49 }];
    const expr = literalExpr(value);

    expect(expr.$expr).toBe('[{name: "Starter", price: 49}]');
    expect(literalValue(expr)).toBe(value);
  });

  it('reads a stored literal tree back, and page data as not a literal', () => {
    const at = { line: 1, col: 1 };
    const ast = {
      ...at,
      type: 'ListLit',
      elements: [{ ...at, type: 'MapLit', entries: [{ key: 'name', value: { ...at, type: 'StringLit', value: 'Starter' } }, { key: 'price', value: { ...at, type: 'NumberLit', value: '49' } }] }],
    } as unknown as Node;

    expect(literalValue({ $expr: '[...]', ast })).toEqual([{ name: 'Starter', price: 49 }]);
    expect(literalValue({ $expr: 'owner.packages', ast: { ...at, type: 'Identifier', name: 'owner' } as unknown as Node })).toBeUndefined();
    expect(literalValue('plain words')).toBeUndefined();
  });
});
