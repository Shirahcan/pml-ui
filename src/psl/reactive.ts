/**
 * The reactive state layer for PSL interactivity. A page has ONE ReactiveStore, held by its
 * PageRuntime; scripts and event handlers read and write it through the `state` namespace, and the
 * renderer's reactive bindings subscribe to it so a state change re-renders exactly the nodes that
 * depend on it. This is the smallest real interactivity (toggle, filter, computed total) with no
 * imperative DOM surface: PSL only mutates values, React re-renders from them.
 */

import { ReactiveState, type Value } from './values';

export class ReactiveStore {
  private readonly values = new Map<string, Value>();

  private readonly listeners = new Set<() => void>();

  /** Bumped on every write, so a subscriber can cheaply tell "did anything change since I last read". */
  private ver = 0;

  get(key: string): Value {
    const value = this.values.get(key);

    return value === undefined ? null : value;
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  set(key: string, value: Value): void {
    this.values.set(key, value);
    this.ver += 1;
    // Copy before iterating: a listener may (un)subscribe as it runs.
    for (const listener of [...this.listeners]) {
      listener();
    }
  }

  /** A monotonically increasing version, for `useSyncExternalStore`'s snapshot. */
  version(): number {
    return this.ver;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }
}

/**
 * The `state` value, bound to ONE page's store. PageRuntime injects it into the shared scope alongside
 * the std-lib, so every script and event handler reads and writes the same reactive state through
 * OBJECT NOTATION only (`state.count`, `state.count = 5`, `state.count += 1`, `state.count++`); the old
 * get/set/has methods were removed. It is the ONLY mutable shared surface PSL has, and holds plain PSL
 * values - no host, DOM, or node is reachable through it.
 */
export function buildStateNamespace(store: ReactiveStore): ReactiveState {
  return new ReactiveState(store);
}
