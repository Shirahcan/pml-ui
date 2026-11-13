/**
 * P3c-ii - the `dom` namespace is reachable from a running script through the PageRuntime, and an
 * imperative handler invoked via callGlobal / callFn records its mutations on the runtime's element
 * store. The security surface (URL sink) still holds when driven end to end through the runtime.
 * ASTs are hand-built (the parser is PHP-only), mirroring pageRuntime.test.ts.
 */

import { PageRuntime } from '../../src/psl/runtime';
import type { Node, Program } from '../../src/psl/ast';

const at = { line: 1, col: 1 };

const str = (value: string): Node => ({ ...at, type: 'StringLit', value });
const ident = (name: string): Node => ({ ...at, type: 'Identifier', name });
const member = (object: Node, name: string): Node => ({ ...at, type: 'Member', object, name });
const call = (callee: Node, args: Node[]): Node => ({ ...at, type: 'Call', callee, args });

/** `dom.el(key)` */
const domEl = (key: string): Node => call(member(ident('dom'), 'el'), [str(key)]);
/** `dom.el(key).<method>(...args)` as an expression statement */
const handleCall = (key: string, method: string, args: Node[]): Node => call(member(domEl(key), method), args);

const program = (body: Node[]): Program => ({ ...at, type: 'Program', body });

describe('PageRuntime dom namespace (P3c)', () => {
  it('lets a running script mutate the element store through dom.el(...)', () => {
    const runtime = new PageRuntime();

    const result = runtime.run(program([
      handleCall('out', 'setText', [str('done')]),
      handleCall('cta', 'setAttr', [str('href'), str('javascript:alert(1)')]),
    ]));

    expect(result.ok).toBe(true);
    expect(runtime.elements.record('out')?.text).toBe('done');
    // The URL sink holds when driven end to end through the runtime.
    expect(runtime.elements.record('cta')?.attrs.href).toBe('#');
  });

  it('invokes an imperative handler via callGlobal, recording its mutations', () => {
    const runtime = new PageRuntime();

    // function mutate() { dom.el("panel").remove() }
    runtime.run(program([
      {
        ...at,
        type: 'FuncDecl',
        name: 'mutate',
        params: [],
        returnType: null,
        body: { ...at, type: 'Block', body: [handleCall('panel', 'remove', [])] },
      },
    ]));

    const result = runtime.callGlobal('mutate');

    expect(result.ok).toBe(true);
    expect(runtime.elements.record('panel')?.removed).toBe(true);
  });

  it('callFn soft-fails on a non-function instead of throwing', () => {
    const runtime = new PageRuntime();

    const result = runtime.callFn(null);

    expect(result.ok).toBe(false);
    expect(runtime.diagnostics.length).toBeGreaterThan(0);
  });

  it('refuses a disallowed attribute name (soft) and records a warning', () => {
    const runtime = new PageRuntime();

    runtime.run(program([handleCall('x', 'setAttr', [str('onclick'), str('steal()')])]));

    expect(runtime.elements.record('x')?.attrs.onclick).toBeUndefined();
    expect(runtime.elements.warnings.length).toBeGreaterThan(0);
  });
});
