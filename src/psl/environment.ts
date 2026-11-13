/**
 * A lexical scope: a set of bindings plus a link to the enclosing scope. Blocks, loop iterations,
 * and function calls each create a child scope, so shadowing and closures behave correctly. A child
 * can read and (for a `let`) reassign an enclosing binding, but never mutate its parent's map shape.
 */

import type { Value } from './values';

interface Binding {
  value: Value;
  readonly isConst: boolean;
}

export type AssignOutcome = 'ok' | 'not-found' | 'const';

export class Environment {
  private readonly vars = new Map<string, Binding>();

  constructor(private readonly parent: Environment | null = null) {}

  /** Declare a binding in THIS scope. */
  define(name: string, value: Value, isConst: boolean): void {
    this.vars.set(name, { value, isConst });
  }

  /** Is this name declared in THIS scope only (used to reject a duplicate declaration)? */
  hasLocal(name: string): boolean {
    return this.vars.has(name);
  }

  /** Is this name in scope anywhere up the chain? */
  has(name: string): boolean {
    return this.vars.has(name) || (this.parent?.has(name) ?? false);
  }

  get(name: string): Value | undefined {
    const binding = this.vars.get(name);
    if (binding) {
      return binding.value;
    }

    return this.parent?.get(name);
  }

  /**
   * Reassign an existing binding, walking up the chain. Returns why it could not, so the caller can
   * raise a precise soft-fail (undefined vs const) rather than silently succeeding.
   */
  assign(name: string, value: Value): AssignOutcome {
    const binding = this.vars.get(name);
    if (binding) {
      if (binding.isConst) {
        return 'const';
      }
      binding.value = value;

      return 'ok';
    }

    return this.parent?.assign(name, value) ?? 'not-found';
  }
}
