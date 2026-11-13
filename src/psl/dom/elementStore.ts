/**
 * The imperative escape hatch for PSL interactivity: an opaque `element` handle backed by a mutation
 * store, for the rare cases the declarative layer (if / each / {...} values / on-*) cannot express, e.g. a script
 * that appends rows in a loop, removes a node, or sets a computed href from inside a handler.
 *
 * PSL still NEVER touches a real DOM node. A handle method records a MUTATION against this store (keyed
 * by a node's `key`); a node carrying that key subscribes to the store and re-renders with the mutation
 * applied, exactly like the reactive `state` store but for structural edits. The security guarantee is
 * unchanged and, if anything, stronger: the settable surface is a CLOSED attribute allowlist (so
 * `onclick` / `style` / `srcdoc` / arbitrary names are simply not writable), every URL-typed value is
 * forced through {@link assertSafeUrl}, and `create()` only ever yields a KNOWN primitive - never raw
 * HTML. A rejected write is a soft no-op recorded on {@link warnings}, never a throw at the page.
 *
 * This store deals only in plain JS values + {@link PmlNode}s; the PSL<->render coercion (a PSL `Value`
 * to a string / a known-primitive node) happens at this boundary, so `applyMutation` stays pure and the
 * renderer never sees a `Decimal` or a `PslMap`.
 */

import { PRIMITIVES, type PmlNode, type ReactiveEvent } from '../../pml/primitives';
import { assertSafeUrl } from '../../security/assertSafeUrl';
import { valueToString, type Value } from '../values';

const KNOWN_PRIMITIVES: ReadonlySet<string> = new Set(PRIMITIVES);

/** The events an imperative `on(event, fn)` may bind. Same closed set as the declarative `reactive.on`. */
const SETTABLE_EVENTS: readonly string[] = ['click', 'change', 'submit', 'input'];

/**
 * The CLOSED set of scalar attributes `el(...).setAttr(name, value)` (and `create(primitive, props)`)
 * may write. A name outside this set (`onclick`, `style`, `srcdoc`, `class`, `id`, `data-*`, ...) is
 * refused, so the imperative API can never widen the closed PML vocabulary - the same guarantee the
 * server's per-primitive prop allowlist gives authored markup. These are all existing scalar content /
 * URL props; none of them execute.
 */
export const SETTABLE_ATTRS: ReadonlySet<string> = new Set([
  'href', 'src', 'value', 'text', 'label', 'alt', 'caption', 'title', 'intro', 'heading', 'placeholder', 'variant',
]);

/** The URL-typed subset of {@link SETTABLE_ATTRS}: every value written here passes through assertSafeUrl. */
export const URL_ATTRS: ReadonlySet<string> = new Set(['href', 'src']);

/** Which prop `setText()` writes, per primitive (its visible-text slot). Defaults to `value`. */
const TEXT_PROP: Record<string, string> = { heading: 'text', button: 'label', list_item: 'text', text: 'value' };

/** The recorded edits for one keyed node. Values are already coerced to render-safe primitives. */
export interface MutationRecord {
  /** The node's visible-text override (setText), already a string. */
  text?: string;
  /** Attribute overrides (setAttr), name -> sanitized string value. */
  attrs: Record<string, string>;
  /** Children appended after the node's own (append), already known-primitive PmlNodes. */
  appended: PmlNode[];
  /** Whether the node was removed (remove) - it renders as nothing. */
  removed: boolean;
  /** Imperative event handlers (on) - the PSL fn value the renderer invokes via the runtime. */
  handlers: Partial<Record<ReactiveEvent, Value>>;
}

function emptyRecord(): MutationRecord {
  return { attrs: {}, appended: [], removed: false, handlers: {} };
}

/**
 * Build a KNOWN-primitive virtual node from `create(primitive, props)`. Returns null (a soft fail the
 * caller reports) for an unknown primitive, so no path can yield raw HTML or an unknown tag. Props are
 * filtered to the SAME closed settable allowlist as setAttr, with URL props sanitized.
 */
export function createVirtualNode(primitive: Value, props: Value): PmlNode | null {
  if (typeof primitive !== 'string' || !KNOWN_PRIMITIVES.has(primitive)) {
    return null;
  }

  const out: PmlNode = { primitive: primitive as PmlNode['primitive'] };
  const kept: Record<string, string> = {};

  if (props instanceof Map) {
    for (const [name, value] of props) {
      if (!SETTABLE_ATTRS.has(name)) {
        continue;
      }
      const str = valueToString(value ?? null);
      kept[name] = URL_ATTRS.has(name) ? assertSafeUrl(str) : str;
    }
  }

  if (Object.keys(kept).length > 0) {
    out.props = kept;
  }

  return out;
}

/**
 * Apply a keyed node's recorded mutations, returning the mutated node (or null when removed). Pure and
 * total: it clones, sets the text slot, merges the sanitized attrs, and appends the created children;
 * event handlers are NOT applied here (the renderer attaches them, since only it can call the runtime).
 */
export function applyMutation(node: PmlNode, record: MutationRecord | null): PmlNode | null {
  if (record === null) {
    return node;
  }
  if (record.removed) {
    return null;
  }

  const primitive = node.primitive ?? '';
  const props: Record<string, unknown> = { ...(node.props ?? {}) };

  if (record.text !== undefined) {
    props[TEXT_PROP[primitive] ?? 'value'] = record.text;
  }
  for (const [name, value] of Object.entries(record.attrs)) {
    props[name] = value;
  }

  const next: PmlNode = { ...node, props };
  if (record.appended.length > 0) {
    next.children = [...(node.children ?? []), ...record.appended];
  }

  return next;
}

/**
 * The page's ONE element-mutation store, held by the PageRuntime beside the reactive `state` store. A
 * handle method mutates it; a keyed node subscribes to it. Mirrors ReactiveStore (version + listeners)
 * so the renderer can drive it with the same `useSyncExternalStore` seam.
 */
export class ElementStore {
  private readonly records = new Map<string, MutationRecord>();

  private readonly listeners = new Set<() => void>();

  /** Soft-refused writes (a disallowed attr / event / a non-created append), for the dev console / Porter. */
  readonly warnings: string[] = [];

  private ver = 0;

  /** The recorded mutations for a key, or null if the key has never been touched. */
  record(key: string): MutationRecord | null {
    return this.records.get(key) ?? null;
  }

  version(): number {
    return this.ver;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  setText(key: string, value: Value): void {
    this.recordFor(key).text = valueToString(value ?? null);
    this.bump();
  }

  setAttr(key: string, name: Value, value: Value): void {
    const attr = typeof name === 'string' ? name : valueToString(name ?? null);
    if (!SETTABLE_ATTRS.has(attr)) {
      this.warnings.push(`setAttr("${attr}") was ignored: "${attr}" is not a settable attribute.`);

      return;
    }
    const str = valueToString(value ?? null);
    this.recordFor(key).attrs[attr] = URL_ATTRS.has(attr) ? assertSafeUrl(str) : str;
    this.bump();
  }

  append(key: string, child: PmlNode | null): void {
    if (child === null) {
      this.warnings.push('append was ignored: the child is not a created element (use create(...)).');

      return;
    }
    this.recordFor(key).appended.push(child);
    this.bump();
  }

  remove(key: string): void {
    this.recordFor(key).removed = true;
    this.bump();
  }

  on(key: string, event: Value, fn: Value): void {
    const name = typeof event === 'string' ? event : valueToString(event ?? null);
    if (!SETTABLE_EVENTS.includes(name)) {
      this.warnings.push(`on("${name}") was ignored: "${name}" is not a supported event.`);

      return;
    }
    this.recordFor(key).handlers[name as ReactiveEvent] = fn;
    this.bump();
  }

  private recordFor(key: string): MutationRecord {
    let record = this.records.get(key);
    if (record === undefined) {
      record = emptyRecord();
      this.records.set(key, record);
    }

    return record;
  }

  private bump(): void {
    this.ver += 1;
    for (const listener of [...this.listeners]) {
      listener();
    }
  }
}
