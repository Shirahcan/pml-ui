import type { Program } from '../../src/psl/ast';
import { Evaluator } from '../../src/psl/evaluator';
import { Decimal, NativeFunction, equals, truthy, typeName, valueToString, type Value } from '../../src/psl/values';

/**
 * Native (host) functions are the foundation of the standard library: a JS-backed callable that PSL
 * invokes with the exact same syntax as a user function. They are SEEDED via the run context, so we
 * author the tiny `return callee(args...)` program directly here rather than through the PHP-only
 * parser.
 */
function callProgram(callee: string, args: number[]): Program {
  return {
    type: 'Program',
    line: 1,
    col: 1,
    body: [
      {
        type: 'Return',
        line: 1,
        col: 1,
        value: {
          type: 'Call',
          line: 1,
          col: 8,
          callee: { type: 'Identifier', name: callee, line: 1, col: 8 },
          args: args.map((n) => ({ type: 'NumberLit' as const, value: String(n), line: 1, col: 14 })),
        },
      },
    ],
  };
}

const twice = new NativeFunction('twice', 1, (a: Value[]) => (a[0] as Decimal).mul(Decimal.fromString('2')));

describe('PSL NativeFunction', () => {
  it('is callable from PSL with ordinary call syntax', () => {
    const result = new Evaluator().run(callProgram('twice', [21]), { twice });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(valueToString(result.value)).toBe('42');
  });

  it('soft-fails on wrong arity instead of throwing out of the engine', () => {
    const result = new Evaluator().run(callProgram('twice', []), { twice });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('wrong-arity');
  });

  it('accepts any argument count when arity is null (variadic)', () => {
    const sum = new NativeFunction('sum', null, (a: Value[]) =>
      a.reduce((acc, v) => (acc as Decimal).add(v as Decimal), Decimal.fromString('0')),
    );
    const result = new Evaluator().run(callProgram('sum', [1, 2, 3, 4]), { sum });

    expect(result.ok).toBe(true);
    expect(valueToString(result.value)).toBe('10');
  });

  it('converts an impl that throws into a soft fail, never an engine crash', () => {
    const boom = new NativeFunction('boom', 0, () => {
      throw new Error('kaboom');
    });
    const result = new Evaluator().run(callProgram('boom', []), { boom });

    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((d) => d.code)).toContain('native-error');
  });

  it('is typed as a function, is truthy, and compares by identity', () => {
    expect(typeName(twice)).toBe('function');
    expect(truthy(twice)).toBe(true);
    expect(valueToString(twice)).toBe('function');
    expect(equals(twice, twice)).toBe(true);
    expect(equals(twice, new NativeFunction('twice', 1, twice.impl))).toBe(false);
  });
});
