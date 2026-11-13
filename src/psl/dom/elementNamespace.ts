/**
 * The `dom` namespace injected into the shared PSL scope, beside `state`. It is the imperative escape
 * hatch, kept under one reserved root (not two bare globals) so the analyzer only has to know one name:
 *
 *   dom.el(key)                 -> an opaque element HANDLE (a map of methods) bound to a keyed node
 *   dom.create(primitive, props) -> a KNOWN-primitive virtual node, for handle.append(...)
 *
 * A handle is just a PSL map of `NativeFunction`s closed over (key, store); there is no field, method,
 * or path on it that yields a real DOM `Node`, so the "PSL cannot touch the page" guarantee holds by
 * construction. Every method records a mutation on the {@link ElementStore}; the renderer applies it.
 */

import { PRIMITIVES } from '../../pml/primitives';
import { NativeFunction, valueToString, type PslMap, type Value } from '../values';
import { createVirtualNode, ElementStore } from './elementStore';

const KNOWN_PRIMITIVES: ReadonlySet<string> = new Set(PRIMITIVES);

export function buildDomNamespace(store: ElementStore): PslMap {
  const ns: PslMap = new Map();

  ns.set('el', new NativeFunction('dom.el', 1, (args) => handle(store, keyOf(args[0]))));

  ns.set(
    'create',
    new NativeFunction('dom.create', 2, (args) => {
      const primitive = args[0];
      // A known primitive only; anything else soft-fails to null, so create can never yield raw HTML.
      if (typeof primitive !== 'string' || !KNOWN_PRIMITIVES.has(primitive)) {
        return null;
      }
      const node: PslMap = new Map();
      node.set('primitive', primitive);
      node.set('props', args[1] instanceof Map ? args[1] : new Map());

      return node;
    }),
  );

  return ns;
}

function keyOf(value: Value | undefined): string {
  return typeof value === 'string' ? value : valueToString(value ?? null);
}

/** The opaque element handle: a map of method natives bound to (key, store). No real node is reachable. */
function handle(store: ElementStore, key: string): PslMap {
  const methods: PslMap = new Map();

  methods.set('setText', new NativeFunction('el.setText', 1, (args) => {
    store.setText(key, args[0] ?? null);

    return null;
  }));
  methods.set('setAttr', new NativeFunction('el.setAttr', 2, (args) => {
    store.setAttr(key, args[0] ?? null, args[1] ?? null);

    return null;
  }));
  methods.set('append', new NativeFunction('el.append', 1, (args) => {
    store.append(key, nodeFrom(args[0]));

    return null;
  }));
  methods.set('remove', new NativeFunction('el.remove', 0, () => {
    store.remove(key);

    return null;
  }));
  methods.set('on', new NativeFunction('el.on', 2, (args) => {
    store.on(key, args[0] ?? null, args[1] ?? null);

    return null;
  }));

  return methods;
}

/** Convert a `dom.create(...)` result (a {primitive, props} map) into a validated PmlNode, or null. */
function nodeFrom(value: Value | undefined) {
  if (!(value instanceof Map)) {
    return null;
  }

  return createVirtualNode(value.get('primitive') ?? null, value.get('props') ?? null);
}
