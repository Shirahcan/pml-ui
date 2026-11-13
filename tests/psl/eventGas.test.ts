import { PageRuntime } from '../../src/psl/runtime';
import type { Program } from '../../src/psl/ast';

/**
 * Event gas: a handler runs on every interaction, so each callGlobal gets its OWN fresh, tighter step
 * budget. A runaway handler soft-fails at that bound (the visitor's tab stays responsive) instead of
 * hanging, and because the budget resets per call, a thousand clicks never exhaust it. PSL has no timer
 * or interval native, so a handler cannot schedule itself either - the blast radius is one call, bounded.
 */
const at = { line: 1, col: 1 };
type Body = Program['body'][number];

const prog = (...body: Body[]): Program => ({ ...at, type: 'Program', body });
const ident = (name: string): Body => ({ ...at, type: 'Identifier', name });
const call = (callee: Body, args: Body[] = []): Body => ({ ...at, type: 'Call', callee, args });
const funcDecl = (name: string, body: Body[]): Body => ({
  ...at,
  type: 'FuncDecl',
  name,
  params: [],
  returnType: null,
  body: { ...at, type: 'Block', body },
});

/** `function boom() { boom() }` - unbounded self-recursion. */
const DEFINE_BOOM = prog(funcDecl('boom', [call(ident('boom'))]));
/** `function noop() { return 1 }` - trivial, well under any budget. */
const DEFINE_NOOP = prog(funcDecl('noop', [{ ...at, type: 'Return', value: { ...at, type: 'NumberLit', value: '1' } }]));

describe('PSL event gas', () => {
  it('bounds a runaway handler at the event budget instead of hanging', () => {
    const runtime = new PageRuntime({ eventBudget: 500 });
    runtime.run(DEFINE_BOOM);

    const result = runtime.callGlobal('boom');

    expect(result.ok).toBe(false);
    expect(result.diagnostics.some((d) => d.code === 'budget-exceeded')).toBe(true);
  });

  it('gives each handler call a fresh budget, so many interactions never exhaust it', () => {
    const runtime = new PageRuntime({ eventBudget: 1000 });
    runtime.run(DEFINE_NOOP);

    for (let i = 0; i < 100; i += 1) {
      expect(runtime.callGlobal('noop').ok).toBe(true);
    }
  });
});
