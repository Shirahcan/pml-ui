/**
 * The PSL evaluator: a tree-walking interpreter over the AST-JSON the PHP side produced. This is the
 * browser's execution engine - a purpose-built VM, NOT `eval`, so PSL can only do what these methods
 * expose (no host, network, or filesystem access exists to reach).
 *
 * Two failure channels, deliberately different:
 *  - `break` / `continue` / `return` are internal SIGNALS returned up the statement executor - never
 *    thrown - so the engine stays host-neutral and the step budget stays exact.
 *  - A runtime fault (divide by zero, undefined variable, const reassignment, out-of-range index,
 *    exceeding the step budget) is a SOFT FAIL: thrown internally and caught at the top boundary,
 *    yielding `{ ok: false, diagnostics }` instead of blanking the page. A half-working calculator
 *    beats a blank one for a visitor.
 */

import type {
  Assign,
  Binary,
  Block,
  Call,
  For,
  If,
  Index,
  Member,
  Node,
  Pos,
  Program,
  Ternary,
  Unary,
  Update,
  VarDecl,
  While,
} from './ast';
import { Environment } from './environment';
import {
  Decimal,
  NativeFunction,
  PslFunction,
  ReactiveState,
  equals,
  truthy,
  typeName,
  type NativeContext,
  type PslMap,
  type Value,
} from './values';

const DECIMAL_ZERO = new Decimal(BigInt(0), 0);
const DECIMAL_ONE = new Decimal(BigInt(1), 0);

export interface RuntimeDiagnostic {
  code: string;
  message: string;
  line?: number;
  col?: number;
}

export interface Result {
  value: Value | null;
  ok: boolean;
  diagnostics: RuntimeDiagnostic[];
}

type Signal =
  | { kind: 'normal' }
  | { kind: 'return'; value: Value }
  | { kind: 'break' }
  | { kind: 'continue' };

const NORMAL: Signal = { kind: 'normal' };

class PslSoftFail extends Error {
  constructor(readonly diag: RuntimeDiagnostic) {
    super(diag.message);
  }
}

export interface EvaluatorOptions {
  /** Hard cap on nodes visited, so a runaway loop stops the visitor's tab (bystander safety). */
  maxSteps?: number;
  /** "Today" as YYYY-MM-DD, injected by the page (never a wall clock), exposed to date natives. */
  now?: string;
}

export class Evaluator {
  private steps = 0;

  private readonly maxSteps: number;

  /** The budget for the CURRENT run/call; a per-call value so an event handler can be bounded tighter
   *  than a page-load script. Reset at the start of every run/runInto/callValue. */
  private budget: number;

  private readonly now: string | null;

  constructor(opts: EvaluatorOptions = {}) {
    this.maxSteps = opts.maxSteps ?? 1_000_000;
    this.budget = this.maxSteps;
    this.now = opts.now ?? null;
  }

  run(program: Program, context: Record<string, Value> = {}): Result {
    const global = new Environment(null);
    for (const [name, value] of Object.entries(context)) {
      global.define(name, value, false);
    }

    return this.runInto(program, global);
  }

  /**
   * Execute a program's statements INTO an existing environment, so its top-level declarations persist
   * there. This is what lets several `<script>`s on one page share a global scope: a function one
   * script defines is a binding in the shared env the next script also runs in, so a later `<script>`
   * (or, later, an event handler) can call it. Cross-script calls work for free because a PslFunction
   * closes over the env it was defined in, and here that is the shared global.
   *
   * The step budget is per call - each `<script>` executes once on mount - and the host-neutral
   * soft-fail semantics are unchanged: a fault yields `{ ok: false, diagnostics }`, never a throw at
   * the page.
   */
  runInto(program: Program, env: Environment): Result {
    this.steps = 0;
    this.budget = this.maxSteps;

    try {
      const signal = this.execBody(program.body, env);
      const value = signal.kind === 'return' ? signal.value : null;

      return { value, ok: true, diagnostics: [] };
    } catch (e) {
      if (e instanceof PslSoftFail) {
        return { value: null, ok: false, diagnostics: [e.diag] };
      }

      throw e; // a genuine engine bug, not a PSL fault - surface it
    }
  }

  /**
   * Call a function VALUE from outside a program run - an event handler invoking a script-defined
   * function by name. Resets the step counter and applies `maxSteps` as THIS call's budget, so each
   * handler run is bounded on its own (the per-handler gas the interactivity design calls for) and a
   * tighter event budget can be passed than a page-load script gets. Soft-fails like everything else:
   * a fault (including exceeding the budget) yields `{ ok: false }`, never a throw at the page.
   */
  callValue(callee: Value, args: Value[] = [], maxSteps: number = this.maxSteps): Result {
    this.steps = 0;
    this.budget = maxSteps;

    try {
      const value = this.callFunction(callee, args, { line: 0, col: 0 });

      return { value, ok: true, diagnostics: [] };
    } catch (e) {
      if (e instanceof PslSoftFail) {
        return { value: null, ok: false, diagnostics: [e.diag] };
      }

      throw e;
    }
  }

  /**
   * Evaluate ONE expression in an environment (PML v3 L3: a `{...}` value on an element, or an
   * `on-click={...}` handler). Its own step budget, like an event handler; soft-fails to
   * `{ ok: false }`, never a throw at the page. An assignment writes where it points (`state.open =
   * true`), which is how a handler changes the page.
   */
  evaluate(expr: Node, env: Environment, maxSteps: number = this.maxSteps): Result {
    this.steps = 0;
    this.budget = maxSteps;

    try {
      return { value: this.evalExpr(expr, env), ok: true, diagnostics: [] };
    } catch (e) {
      if (e instanceof PslSoftFail) {
        return { value: null, ok: false, diagnostics: [e.diag] };
      }

      throw e;
    }
  }

  // --- Statements ---

  private execBody(body: Node[], env: Environment): Signal {
    for (const stmt of body) {
      const signal = this.execStatement(stmt, env);
      if (signal.kind !== 'normal') {
        return signal;
      }
    }

    return NORMAL;
  }

  private execBlock(block: Block, parent: Environment): Signal {
    return this.execBody(block.body, new Environment(parent));
  }

  private execStatement(node: Node, env: Environment): Signal {
    this.tick(node);

    switch (node.type) {
      case 'VarDecl':
        return this.execVarDecl(node, env);
      case 'Block':
        return this.execBlock(node, env);
      case 'If':
        return this.execIf(node, env);
      case 'While':
        return this.execWhile(node, env);
      case 'For':
        return this.execFor(node, env);
      case 'Return':
        return { kind: 'return', value: node.value ? this.evalExpr(node.value, env) : null };
      case 'Break':
        return { kind: 'break' };
      case 'Continue':
        return { kind: 'continue' };
      case 'FuncDecl':
        env.define(node.name, new PslFunction(node.params, node.body, env), false);

        return NORMAL;
      default:
        // an expression statement: evaluate for its effect (e.g. an assignment or call), discard
        this.evalExpr(node, env);

        return NORMAL;
    }
  }

  private execVarDecl(node: VarDecl, env: Environment): Signal {
    const value = node.init ? this.evalExpr(node.init, env) : null;
    if (env.hasLocal(node.name)) {
      throw this.fail('duplicate-declaration', `"${node.name}" is already declared in this scope.`, node);
    }
    env.define(node.name, value, node.kind === 'const');

    return NORMAL;
  }

  private execIf(node: If, env: Environment): Signal {
    for (const branch of node.branches) {
      if (branch.cond === null || truthy(this.evalExpr(branch.cond, env))) {
        return this.execBlock(branch.body, env);
      }
    }

    return NORMAL;
  }

  private execWhile(node: While, env: Environment): Signal {
    while (truthy(this.evalExpr(node.cond, env))) {
      this.tick(node);
      const signal = this.execBlock(node.body, env);
      if (signal.kind === 'break') {
        break;
      }
      if (signal.kind === 'return') {
        return signal;
      }
    }

    return NORMAL;
  }

  private execFor(node: For, env: Environment): Signal {
    const iterable = this.evalExpr(node.iterable, env);

    if (Array.isArray(iterable)) {
      for (let i = 0; i < iterable.length; i += 1) {
        this.tick(node);
        const loopEnv = new Environment(env);
        loopEnv.define(node.itemVar, iterable[i], false);
        if (node.keyVar) {
          loopEnv.define(node.keyVar, new Decimal(BigInt(i), 0), false);
        }
        const signal = this.execBlock(node.body, loopEnv);
        if (signal.kind === 'break') {
          break;
        }
        if (signal.kind === 'return') {
          return signal;
        }
      }

      return NORMAL;
    }

    if (iterable instanceof Map) {
      for (const [key, val] of iterable) {
        this.tick(node);
        const loopEnv = new Environment(env);
        loopEnv.define(node.itemVar, val, false);
        if (node.keyVar) {
          loopEnv.define(node.keyVar, key, false);
        }
        const signal = this.execBlock(node.body, loopEnv);
        if (signal.kind === 'break') {
          break;
        }
        if (signal.kind === 'return') {
          return signal;
        }
      }

      return NORMAL;
    }

    throw this.fail('not-iterable', `Cannot loop over a ${typeName(iterable)}.`, node);
  }

  // --- Expressions ---

  private evalExpr(node: Node, env: Environment): Value {
    this.tick(node);

    switch (node.type) {
      case 'NumberLit':
        return Decimal.fromString(node.value);
      case 'StringLit':
        return node.value;
      case 'BoolLit':
        return node.value;
      case 'NullLit':
        return null;
      case 'Identifier':
        if (!env.has(node.name)) {
          throw this.fail('undefined-variable', `"${node.name}" is not defined.`, node);
        }

        return env.get(node.name) as Value;
      case 'ListLit':
        return node.elements.map((e) => this.evalExpr(e, env));
      case 'MapLit': {
        const map: PslMap = new Map();
        for (const entry of node.entries) {
          map.set(entry.key, this.evalExpr(entry.value, env));
        }

        return map;
      }
      case 'Unary':
        return this.evalUnary(node, env);
      case 'Binary':
        return this.evalBinary(node, env);
      case 'Ternary':
        return this.evalTernary(node, env);
      case 'Assign':
        return this.evalAssign(node, env);
      case 'Update':
        return this.evalUpdate(node, env);
      case 'Member':
        return this.evalMember(node, env);
      case 'Index':
        return this.evalIndex(node, env);
      case 'FuncExpr':
        return new PslFunction(node.params, node.body, env);
      case 'Call':
        return this.evalCall(node, env);
      default:
        throw this.fail('internal', `Cannot evaluate a ${(node as Node).type}.`, node);
    }
  }

  private evalUnary(node: Unary, env: Environment): Value {
    const v = this.evalExpr(node.operand, env);
    if (node.op === '!') {
      return !truthy(v);
    }
    if (v instanceof Decimal) {
      return v.neg();
    }

    throw this.fail('type-mismatch', `Cannot negate a ${typeName(v)}.`, node);
  }

  private evalTernary(node: Ternary, env: Environment): Value {
    return truthy(this.evalExpr(node.cond, env))
      ? this.evalExpr(node.then, env)
      : this.evalExpr(node.else, env);
  }

  private evalBinary(node: Binary, env: Environment): Value {
    // Logical operators short-circuit and yield the deciding operand (JS-like).
    if (node.op === '&&') {
      const left = this.evalExpr(node.left, env);

      return truthy(left) ? this.evalExpr(node.right, env) : left;
    }
    if (node.op === '||') {
      const left = this.evalExpr(node.left, env);

      return truthy(left) ? left : this.evalExpr(node.right, env);
    }

    const l = this.evalExpr(node.left, env);
    const r = this.evalExpr(node.right, env);

    switch (node.op) {
      case '+':
        return this.plus(l, r, node);
      case '-':
        return this.numeric(l, r, node, (a, b) => a.sub(b));
      case '*':
        return this.numeric(l, r, node, (a, b) => a.mul(b));
      case '/':
        return this.divide(l, r, node, (a, b) => a.div(b), 'division-by-zero');
      case '%':
        return this.divide(l, r, node, (a, b) => a.mod(b), 'modulo-by-zero');
      case '==':
        return equals(l, r);
      case '!=':
        return !equals(l, r);
      case '<':
        return this.compare(l, r, node) < 0;
      case '<=':
        return this.compare(l, r, node) <= 0;
      case '>':
        return this.compare(l, r, node) > 0;
      case '>=':
        return this.compare(l, r, node) >= 0;
      default:
        throw this.fail('internal', `Unknown operator "${node.op}".`, node);
    }
  }

  private plus(l: Value, r: Value, node: Pos): Value {
    if (l instanceof Decimal && r instanceof Decimal) {
      return l.add(r);
    }
    if (typeof l === 'string' && typeof r === 'string') {
      return l + r;
    }

    throw this.fail('type-mismatch', `Cannot add a ${typeName(l)} and a ${typeName(r)}.`, node);
  }

  private numeric(l: Value, r: Value, node: Pos, fn: (a: Decimal, b: Decimal) => Decimal): Value {
    if (l instanceof Decimal && r instanceof Decimal) {
      return fn(l, r);
    }

    throw this.fail('type-mismatch', `Cannot do arithmetic on a ${typeName(l)} and a ${typeName(r)}.`, node);
  }

  private divide(
    l: Value,
    r: Value,
    node: Pos,
    fn: (a: Decimal, b: Decimal) => Decimal | null,
    zeroCode: string,
  ): Value {
    if (!(l instanceof Decimal) || !(r instanceof Decimal)) {
      throw this.fail('type-mismatch', `Cannot do arithmetic on a ${typeName(l)} and a ${typeName(r)}.`, node);
    }
    const result = fn(l, r);
    if (result === null) {
      throw this.fail(zeroCode, 'Cannot divide by zero.', node);
    }

    return result;
  }

  private compare(l: Value, r: Value, node: Pos): number {
    if (l instanceof Decimal && r instanceof Decimal) {
      return l.compare(r);
    }
    if (typeof l === 'string' && typeof r === 'string') {
      return l < r ? -1 : l > r ? 1 : 0;
    }

    throw this.fail('type-mismatch', `Cannot compare a ${typeName(l)} and a ${typeName(r)}.`, node);
  }

  private evalAssign(node: Assign, env: Environment): Value {
    const rhs = this.evalExpr(node.value, env);
    const target = node.target;

    if (target.type === 'Identifier') {
      const current = node.op === '=' ? null : this.readIdentifier(target.name, env, node);
      const value = node.op === '=' ? rhs : this.compound(node.op, current, rhs, node);
      const outcome = env.assign(target.name, value);
      if (outcome === 'not-found') {
        throw this.fail('undefined-variable', `"${target.name}" is not defined.`, node);
      }
      if (outcome === 'const') {
        throw this.fail('const-reassignment', `"${target.name}" is a const and cannot be reassigned.`, node);
      }

      return value;
    }

    if (target.type === 'Member') {
      const obj = this.evalExpr(target.object, env);
      if (obj instanceof ReactiveState) {
        // `state.count = v` / `state.count += 1`: write through to the reactive store (re-renders).
        const value = node.op === '=' ? rhs : this.compound(node.op, obj.store.get(target.name), rhs, node);
        obj.store.set(target.name, value);

        return value;
      }
      if (!(obj instanceof Map)) {
        throw this.fail('type-mismatch', `Cannot set a property on a ${typeName(obj)}.`, node);
      }
      const value = node.op === '=' ? rhs : this.compound(node.op, obj.get(target.name) ?? null, rhs, node);
      obj.set(target.name, value);

      return value;
    }

    // Index target
    const indexTarget = target as Index;
    const container = this.evalExpr(indexTarget.object, env);
    const key = this.evalExpr(indexTarget.index, env);

    if (container instanceof ReactiveState) {
      // `state["count"] = v`: index access on state is always store data.
      const k = this.mapKey(key, node);
      const value = node.op === '=' ? rhs : this.compound(node.op, container.store.get(k), rhs, node);
      container.store.set(k, value);

      return value;
    }
    if (Array.isArray(container)) {
      const i = this.listIndex(key, container, node);
      const value = node.op === '=' ? rhs : this.compound(node.op, container[i], rhs, node);
      container[i] = value;

      return value;
    }
    if (container instanceof Map) {
      const k = this.mapKey(key, node);
      const value = node.op === '=' ? rhs : this.compound(node.op, container.get(k) ?? null, rhs, node);
      container.set(k, value);

      return value;
    }

    throw this.fail('type-mismatch', `Cannot index into a ${typeName(container)}.`, node);
  }

  /**
   * `++x` / `x--`: read the l-value, add or subtract one, write it back. A null l-value coalesces to 0
   * (so `state.count++` from unset starts at 0). Returns the NEW value for a prefix op, the OLD for a
   * postfix. The l-value is an Identifier, a Member, or an Index; state members route to the store.
   */
  private evalUpdate(node: Update, env: Environment): Value {
    const target = node.operand;
    const current = this.readLvalue(target, env, node);
    const base = current === null ? DECIMAL_ZERO : current;
    if (!(base instanceof Decimal)) {
      throw this.fail('type-mismatch', `Cannot ${node.op === '++' ? 'increment' : 'decrement'} a ${typeName(base)}.`, node);
    }

    const next = node.op === '++' ? base.add(DECIMAL_ONE) : base.sub(DECIMAL_ONE);
    this.writeLvalue(target, next, env, node);

    return node.prefix ? next : base;
  }

  /** Read an l-value (Identifier | Member | Index); state members/indices route to the store. */
  private readLvalue(target: Node, env: Environment, node: Pos): Value {
    if (target.type === 'Identifier') {
      return this.readIdentifier(target.name, env, node);
    }
    if (target.type === 'Member') {
      return this.evalMember(target, env);
    }

    return this.evalIndex(target as Index, env);
  }

  /** Write an l-value (Identifier | Member | Index); state members/indices route to the store. */
  private writeLvalue(target: Node, value: Value, env: Environment, node: Pos): void {
    if (target.type === 'Identifier') {
      const outcome = env.assign(target.name, value);
      if (outcome === 'not-found') {
        throw this.fail('undefined-variable', `"${target.name}" is not defined.`, node);
      }
      if (outcome === 'const') {
        throw this.fail('const-reassignment', `"${target.name}" is a const and cannot be reassigned.`, node);
      }

      return;
    }

    if (target.type === 'Member') {
      const obj = this.evalExpr(target.object, env);
      if (obj instanceof ReactiveState) {
        obj.store.set(target.name, value);

        return;
      }
      if (obj instanceof Map) {
        obj.set(target.name, value);

        return;
      }

      throw this.fail('type-mismatch', `Cannot set a property on a ${typeName(obj)}.`, node);
    }

    const idx = target as Index;
    const container = this.evalExpr(idx.object, env);
    const key = this.evalExpr(idx.index, env);
    if (container instanceof ReactiveState) {
      container.store.set(this.mapKey(key, node), value);

      return;
    }
    if (Array.isArray(container)) {
      container[this.listIndex(key, container, node)] = value;

      return;
    }
    if (container instanceof Map) {
      container.set(this.mapKey(key, node), value);

      return;
    }

    throw this.fail('type-mismatch', `Cannot index into a ${typeName(container)}.`, node);
  }

  private readIdentifier(name: string, env: Environment, node: Pos): Value {
    if (!env.has(name)) {
      throw this.fail('undefined-variable', `"${name}" is not defined.`, node);
    }

    return env.get(name) as Value;
  }

  private compound(op: '=' | '+=' | '-=' | '*=' | '/=', current: Value, rhs: Value, node: Pos): Value {
    // A null lvalue coalesces to the numeric/string identity, so `x += 1` on an unset value (a state
    // counter never set) starts from 0, and `s += "!"` from "" - JS-like, so `state.count += 1` and
    // `state.count++` just work on a fresh counter.
    if (current === null) {
      if (rhs instanceof Decimal) {
        current = DECIMAL_ZERO;
      } else if (typeof rhs === 'string') {
        current = '';
      }
    }

    switch (op) {
      case '+=':
        return this.plus(current, rhs, node);
      case '-=':
        return this.numeric(current, rhs, node, (a, b) => a.sub(b));
      case '*=':
        return this.numeric(current, rhs, node, (a, b) => a.mul(b));
      case '/=':
        return this.divide(current, rhs, node, (a, b) => a.div(b), 'division-by-zero');
      default:
        throw this.fail('internal', `Unknown assignment "${op}".`, node);
    }
  }

  private evalMember(node: Member, env: Environment): Value {
    const obj = this.evalExpr(node.object, env);
    if (obj instanceof ReactiveState) {
      return obj.store.get(node.name);
    }
    if (obj instanceof Map) {
      return obj.has(node.name) ? (obj.get(node.name) as Value) : null;
    }

    throw this.fail('type-mismatch', `Cannot read property "${node.name}" of a ${typeName(obj)}.`, node);
  }

  private evalIndex(node: Index, env: Environment): Value {
    const obj = this.evalExpr(node.object, env);
    const key = this.evalExpr(node.index, env);

    if (obj instanceof ReactiveState) {
      return obj.store.get(this.mapKey(key, node));
    }
    if (Array.isArray(obj)) {
      return obj[this.listIndex(key, obj, node)];
    }
    if (obj instanceof Map) {
      const k = this.mapKey(key, node);

      return obj.has(k) ? (obj.get(k) as Value) : null;
    }

    throw this.fail('type-mismatch', `Cannot index into a ${typeName(obj)}.`, node);
  }

  private listIndex(key: Value, list: Value[], node: Pos): number {
    if (!(key instanceof Decimal)) {
      throw this.fail('type-mismatch', 'A list index must be a number.', node);
    }
    const i = key.toNumber();
    if (!Number.isInteger(i) || i < 0 || i >= list.length) {
      throw this.fail('index-out-of-range', `Index ${key.toString()} is out of range.`, node);
    }

    return i;
  }

  private mapKey(key: Value, node: Pos): string {
    if (typeof key === 'string') {
      return key;
    }

    throw this.fail('type-mismatch', 'A map key must be a string.', node);
  }

  private evalCall(node: Call, env: Environment): Value {
    const callee = this.evalExpr(node.callee, env);
    const args = node.args.map((a) => this.evalExpr(a, env));

    return this.callFunction(callee, args, node);
  }

  /**
   * Call a function VALUE with already-evaluated arguments. Shared by `evalCall` and by higher-order
   * natives (`list.map` etc.) through the `NativeContext`, so a callback runs under the SAME step
   * budget as the surrounding program (its ticks accrue to `this.steps`).
   *
   * A native's impl may throw (a bad input, an edge it did not guard); that becomes a `native-error`
   * soft fail rather than an engine crash - EXCEPT a PslSoftFail bubbling up from a nested evaluation
   * (a callback exceeding the budget, dividing by zero, ...), which keeps its real code.
   */
  private callFunction(callee: Value, args: Value[], node: Pos): Value {
    if (callee instanceof NativeFunction) {
      if (callee.arity !== null && args.length !== callee.arity) {
        throw this.fail(
          'wrong-arity',
          `${callee.name}() expects ${callee.arity} argument(s), got ${args.length}.`,
          node,
        );
      }
      this.tick(node);
      const ctx: NativeContext = { call: (fn, fnArgs) => this.callFunction(fn, fnArgs, node), now: this.now };
      try {
        return callee.impl(args, ctx);
      } catch (e) {
        if (e instanceof PslSoftFail) {
          throw e;
        }

        throw this.fail('native-error', `${callee.name}() could not complete.`, node);
      }
    }

    if (!(callee instanceof PslFunction)) {
      throw this.fail('not-callable', `You can only call a function; this is a ${typeName(callee)}.`, node);
    }

    this.tick(node);
    const local = new Environment(callee.closure);
    callee.params.forEach((p, i) => {
      local.define(p.name, i < args.length ? args[i] : null, false);
    });

    const signal = this.execBody(callee.body.body, local);

    return signal.kind === 'return' ? signal.value : null;
  }

  // --- Machinery ---

  private tick(node: Pos): void {
    this.steps += 1;
    if (this.steps > this.budget) {
      throw new PslSoftFail({
        code: 'budget-exceeded',
        message: 'The script did too much work and was stopped.',
        line: node.line,
        col: node.col,
      });
    }
  }

  private fail(code: string, message: string, node: Pos): PslSoftFail {
    return new PslSoftFail({ code, message, line: node.line, col: node.col });
  }
}
