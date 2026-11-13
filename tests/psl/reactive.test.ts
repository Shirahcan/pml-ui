import { PageRuntime } from '../../src/psl/runtime';
import { valueToString } from '../../src/psl/values';
import type { Program } from '../../src/psl/ast';

/**
 * The reactive layer: scripts and event handlers share ONE page store through the `state` value, and a
 * write notifies subscribers (which re-renders the bound nodes). `state` is OBJECT NOTATION only:
 * `state.count` (read), `state.count = v` (write), `state.count += 1` / `state.count++` (increment); the
 * get/set/has methods were removed. ASTs are hand-built (the parser is PHP-only).
 */
const at = { line: 1, col: 1 };

const ident = (name: string): Program['body'][number] => ({ ...at, type: 'Identifier', name });
const num = (value: string): Program['body'][number] => ({ ...at, type: 'NumberLit', value });
const nullLit = (): Program['body'][number] => ({ ...at, type: 'NullLit' });
const program = (...body: Program['body']): Program => ({ ...at, type: 'Program', body });

const memberOf = (object: string, name: string): Program['body'][number] => ({
  ...at,
  type: 'Member',
  object: ident(object),
  name,
});

const assignMember = (
  op: '=' | '+=',
  name: string,
  value: Program['body'][number],
): Program['body'][number] => ({ ...at, type: 'Assign', op, target: memberOf('state', name), value });

/** `state.count = 5` */
const SET_MEMBER_5 = program(assignMember('=', 'count', num('5')));
/** `return state.count` */
const READ_MEMBER = program({ ...at, type: 'Return', value: memberOf('state', 'count') });
/** `return state.count != null` (existence, now that there is no state.has) */
const HAS_MEMBER = program({
  ...at,
  type: 'Return',
  value: { ...at, type: 'Binary', op: '!=', left: memberOf('state', 'count'), right: nullLit() },
});
/** `state.count += 1` */
const INC_MEMBER = program(assignMember('+=', 'count', num('1')));
/** `state.count++` */
const INC_MEMBER_PP = program({
  ...at,
  type: 'Update',
  op: '++',
  prefix: false,
  operand: memberOf('state', 'count'),
});
/** `function bump() { state.count = 10 }` */
const DEFINE_BUMP = program({
  ...at,
  type: 'FuncDecl',
  name: 'bump',
  params: [],
  returnType: null,
  body: { ...at, type: 'Block', body: [assignMember('=', 'count', num('10'))] },
});

describe('PageRuntime reactive state (object notation)', () => {
  it('writes and reads a state member, shared across scripts', () => {
    const runtime = new PageRuntime();
    runtime.run(SET_MEMBER_5); // state.count = 5
    expect(valueToString(runtime.run(READ_MEMBER).value)).toBe('5'); // state.count
    expect(runtime.run(HAS_MEMBER).value).toBe(true); // state.count != null
  });

  it('reads an unset state member as null', () => {
    expect(new PageRuntime().run(READ_MEMBER).value).toBeNull();
  });

  it('notifies subscribers on a write (the re-render trigger)', () => {
    const runtime = new PageRuntime();
    let notifications = 0;
    runtime.store.subscribe(() => {
      notifications += 1;
    });

    runtime.run(SET_MEMBER_5);
    expect(notifications).toBeGreaterThan(0);
  });

  it('runs a script-defined handler via callGlobal, mutating state and notifying subscribers', () => {
    const runtime = new PageRuntime();
    let notifications = 0;
    runtime.store.subscribe(() => {
      notifications += 1;
    });

    runtime.run(DEFINE_BUMP); // function bump() { state.count = 10 }
    expect(runtime.run(READ_MEMBER).value).toBeNull(); // not set yet

    const call = runtime.callGlobal('bump');
    expect(call.ok).toBe(true);
    expect(notifications).toBeGreaterThan(0);
    expect(valueToString(runtime.run(READ_MEMBER).value)).toBe('10');
  });

  it('soft-fails when calling a name that is not a function', () => {
    const runtime = new PageRuntime();

    const result = runtime.callGlobal('doesNotExist');

    expect(result.ok).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it('state.count += 1 starts from 0 when unset, then accumulates', () => {
    const runtime = new PageRuntime();
    runtime.run(INC_MEMBER);
    expect(valueToString(runtime.run(READ_MEMBER).value)).toBe('1');
    runtime.run(INC_MEMBER);
    expect(valueToString(runtime.run(READ_MEMBER).value)).toBe('2');
  });

  it('state.count++ increments the store (from 0 when unset)', () => {
    const runtime = new PageRuntime();
    runtime.run(INC_MEMBER_PP); // 0 -> 1
    expect(valueToString(runtime.run(READ_MEMBER).value)).toBe('1');
    runtime.run(INC_MEMBER_PP); // 1 -> 2
    expect(valueToString(runtime.run(READ_MEMBER).value)).toBe('2');
  });
});
