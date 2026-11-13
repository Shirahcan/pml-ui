import { Decimal } from '../../src/psl/values';

describe('Decimal', () => {
  it('adds without float drift', () => {
    expect(Decimal.fromString('0.1').add(Decimal.fromString('0.2')).toString()).toBe('0.3');
    expect(Decimal.fromString('1365').add(Decimal.fromString('520')).toString()).toBe('1885');
  });

  it('multiplies keeping exact scale', () => {
    expect(Decimal.fromString('2.5').mul(Decimal.fromString('4')).toString()).toBe('10');
    expect(Decimal.fromString('0.1').mul(Decimal.fromString('0.1')).toString()).toBe('0.01');
  });

  it('divides with half-up rounding to a bounded scale', () => {
    expect(Decimal.fromString('10').div(Decimal.fromString('4'))?.toString()).toBe('2.5');
    expect(Decimal.fromString('1').div(Decimal.fromString('3'))?.toString().startsWith('0.3333')).toBe(true);
  });

  it('returns null when dividing by zero', () => {
    expect(Decimal.fromString('1').div(Decimal.fromString('0'))).toBeNull();
    expect(Decimal.fromString('5').mod(Decimal.fromString('0'))).toBeNull();
  });

  it('compares regardless of trailing zeros', () => {
    expect(Decimal.fromString('2.5').compare(Decimal.fromString('2.50'))).toBe(0);
    expect(Decimal.fromString('1').compare(Decimal.fromString('2'))).toBe(-1);
    expect(Decimal.fromString('3').compare(Decimal.fromString('2.9'))).toBe(1);
  });

  it('renders a canonical string (no trailing zeros, no negative zero)', () => {
    expect(Decimal.fromString('2.50').toString()).toBe('2.5');
    expect(Decimal.fromString('-0.0').toString()).toBe('0');
    expect(Decimal.fromString('100').toString()).toBe('100');
    expect(Decimal.fromString('5').neg().toString()).toBe('-5');
  });
});
