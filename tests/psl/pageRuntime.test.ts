import { PageRuntime } from '../../src/psl/runtime';
import { valueToString } from '../../src/psl/values';
import type { Program } from '../../src/psl/ast';

/**
 * The page runtime is what makes PSL script-like: several `<script>`s on one page share ONE global
 * scope, so a function the first defines is callable by the next (like two `<script>` tags sharing
 * `window`, but a safe subset). These pin that shared-scope behaviour and the const hardening that
 * stops one script repointing the std-lib for another. ASTs are hand-built (the parser is PHP-only).
 */
const at = { line: 1, col: 1 };

/** `function greet(name) { return string.upper(name) }` */
const DEFINE_GREET: Program = {
  ...at,
  type: 'Program',
  body: [
    {
      ...at,
      type: 'FuncDecl',
      name: 'greet',
      params: [{ name: 'name', paramType: null }],
      returnType: null,
      body: {
        ...at,
        type: 'Block',
        body: [
          {
            ...at,
            type: 'Return',
            value: {
              ...at,
              type: 'Call',
              callee: { ...at, type: 'Member', object: { ...at, type: 'Identifier', name: 'string' }, name: 'upper' },
              args: [{ ...at, type: 'Identifier', name: 'name' }],
            },
          },
        ],
      },
    },
  ],
};

/** `return greet("ada")` */
const CALL_GREET: Program = {
  ...at,
  type: 'Program',
  body: [
    {
      ...at,
      type: 'Return',
      value: {
        ...at,
        type: 'Call',
        callee: { ...at, type: 'Identifier', name: 'greet' },
        args: [{ ...at, type: 'StringLit', value: 'ada' }],
      },
    },
  ],
};

describe('PageRuntime shared page-global scope', () => {
  it('lets a later script call a function an earlier script defined', () => {
    const runtime = new PageRuntime();

    const first = runtime.run(DEFINE_GREET);
    expect(first.ok).toBe(true);
    expect(first.value).toBeNull(); // a library script defines and returns nothing

    const second = runtime.run(CALL_GREET);
    expect(second.ok).toBe(true);
    expect(second.value).toBe('ADA'); // greet + the std-lib both resolve through the shared scope
  });

  it('sees a const one script declares in the next script', () => {
    const runtime = new PageRuntime();

    const declare: Program = {
      ...at,
      type: 'Program',
      body: [{ ...at, type: 'VarDecl', kind: 'const', name: 'RATE', varType: null, init: { ...at, type: 'NumberLit', value: '1590' } }],
    };
    const read: Program = {
      ...at,
      type: 'Program',
      body: [{ ...at, type: 'Return', value: { ...at, type: 'Identifier', name: 'RATE' } }],
    };

    runtime.run(declare);
    const result = runtime.run(read);

    expect(result.ok).toBe(true);
    expect(valueToString(result.value)).toBe('1590');
  });

  it('refuses to let a script repoint a std-lib namespace (const hardening) and records the fault', () => {
    const runtime = new PageRuntime();

    const clobber: Program = {
      ...at,
      type: 'Program',
      body: [
        {
          ...at,
          type: 'Assign',
          op: '=',
          target: { ...at, type: 'Identifier', name: 'string' },
          value: { ...at, type: 'NumberLit', value: '5' },
        },
      ],
    };

    const result = runtime.run(clobber);

    expect(result.ok).toBe(false);
    expect(runtime.diagnostics.length).toBeGreaterThan(0);
  });

  it('exposes page context to scripts', () => {
    const runtime = new PageRuntime({ context: { siteName: 'Maple Immigration' } });

    const readContext: Program = {
      ...at,
      type: 'Program',
      body: [{ ...at, type: 'Return', value: { ...at, type: 'Identifier', name: 'siteName' } }],
    };

    expect(runtime.run(readContext).value).toBe('Maple Immigration');
  });
});
