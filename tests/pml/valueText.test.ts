import { toPslValue, toText, valueText } from '../../src/pml/expressions';
import { Decimal, NativeFunction } from '../../src/psl';

/**
 * The ONE rule for what a value reads as in a page's words (owner 2026-11-11: "Applicable types
 * (especially native types) should be properly converted to strings").
 */
describe('valueText', () => {
  it('reads text, numbers and yes/no as words', () => {
    expect(valueText('Study permit')).toBe('Study permit');
    expect(valueText(Decimal.fromString('0'))).toBe('0');
    expect(valueText(Decimal.fromString('1990'))).toBe('1990');
    expect(valueText(Decimal.fromString('4.5'))).toBe('4.5');
    expect(valueText(Decimal.fromString('-3'))).toBe('-3');
    expect(valueText(true)).toBe('true');
    expect(valueText(false)).toBe('false');
  });

  it('reads a list as its items joined, leaving out the empty ones', () => {
    expect(valueText(['English', 'French'])).toBe('English, French');
    expect(valueText([Decimal.fromString('1'), null, 'two'])).toBe('1, two');
    expect(valueText([])).toBe('');
  });

  it('reads nothing for null, a record or a function: those are not words', () => {
    expect(valueText(null)).toBe('');
    expect(valueText(new Map([['city', 'Toronto']]))).toBe('');
    expect(valueText(new NativeFunction('x', 0, () => null))).toBe('');
  });
});

describe('toText (a plain value, by the same rule)', () => {
  it('reads plain numbers, yes/no and lists', () => {
    expect(toText(0)).toBe('0');
    expect(toText(12)).toBe('12');
    expect(toText(true)).toBe('true');
    expect(toText(['a', 'b'])).toBe('a, b');
    expect(toText(undefined)).toBe('');
    expect(toText({ a: 1 })).toBe('');
  });

  it('reads a very large or very small number in full instead of throwing', () => {
    // String(1e21) is "1e+21", which the decimal reader cannot read: it threw mid-render.
    expect(toText(1e21)).toBe('1000000000000000000000');
    expect(toText(1e-7)).toBe('0.0000001');
    expect(toPslValue(Number.NaN)).toBeNull();
  });
});
