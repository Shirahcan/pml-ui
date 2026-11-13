/**
 * P3c - the imperative element handle. The store records mutations, the pure helpers build + apply
 * them, and the security surface holds: a disallowed attribute name is refused, a javascript: URL is
 * neutralized, create only yields a known primitive, and nothing ever produces a real DOM node (a
 * handle is a plain map of natives).
 */

import type { PmlNode } from '../../src/pml/primitives';
import { buildDomNamespace } from '../../src/psl/dom/elementNamespace';
import { applyMutation, createVirtualNode, ElementStore } from '../../src/psl/dom/elementStore';
import { NativeFunction, type NativeContext, type PslMap, type Value } from '../../src/psl/values';

const ctx: NativeContext = { call: () => null, now: null };
const callNative = (fn: Value | undefined, args: Value[]): Value => (fn as NativeFunction).impl(args, ctx);
const mapOf = (obj: Record<string, Value>): PslMap => new Map(Object.entries(obj));

describe('ElementStore', () => {
  it('records setText, coercing to a string', () => {
    const store = new ElementStore();
    store.setText('out', 'hello');

    expect(store.record('out')?.text).toBe('hello');
  });

  it('records an allowed attribute and notifies subscribers, bumping the version', () => {
    const store = new ElementStore();
    let hits = 0;
    const unsubscribe = store.subscribe(() => {
      hits += 1;
    });

    store.setAttr('row', 'value', 'x');

    expect(store.record('row')?.attrs.value).toBe('x');
    expect(hits).toBe(1);
    expect(store.version()).toBe(1);
    unsubscribe();
  });

  it('forces a URL attribute through the safe-URL sink', () => {
    const store = new ElementStore();
    store.setAttr('cta', 'href', 'javascript:alert(1)');
    store.setAttr('img', 'src', 'https://example.com/p.png');

    expect(store.record('cta')?.attrs.href).toBe('#');
    expect(store.record('img')?.attrs.src).toBe('https://example.com/p.png');
  });

  it('refuses a disallowed attribute name (soft, with a warning)', () => {
    const store = new ElementStore();
    store.setAttr('x', 'onclick', 'steal()');
    store.setAttr('x', 'style', 'position:fixed');

    expect(store.record('x')?.attrs.onclick).toBeUndefined();
    expect(store.record('x')?.attrs.style).toBeUndefined();
    expect(store.warnings.length).toBe(2);
  });

  it('records append of a created node, and warns on a non-created child', () => {
    const store = new ElementStore();
    store.append('list', createVirtualNode('text', mapOf({ value: 'a new row' })));
    store.append('list', null);

    expect(store.record('list')?.appended).toHaveLength(1);
    expect(store.warnings).toHaveLength(1);
  });

  it('records remove', () => {
    const store = new ElementStore();
    store.remove('gone');

    expect(store.record('gone')?.removed).toBe(true);
  });

  it('records an allowed event handler and refuses an unsupported one', () => {
    const store = new ElementStore();
    const fn = new NativeFunction('h', 0, () => null);
    store.on('btn', 'click', fn);
    store.on('btn', 'scroll', fn);

    expect(store.record('btn')?.handlers.click).toBe(fn);
    expect(store.warnings).toHaveLength(1);
  });

  it('never touched a key reads as null', () => {
    expect(new ElementStore().record('nope')).toBeNull();
  });
});

describe('createVirtualNode', () => {
  it('builds a known primitive with filtered, sanitized props', () => {
    const node = createVirtualNode('button', mapOf({ href: 'javascript:x', onclick: 'y', label: 'Go' }));

    expect(node).toEqual({ primitive: 'button', props: { href: '#', label: 'Go' } });
  });

  it('returns null for an unknown primitive (never raw HTML)', () => {
    expect(createVirtualNode('blink', mapOf({ value: 'x' }))).toBeNull();
    expect(createVirtualNode('script', mapOf({}))).not.toBeNull(); // script IS a known primitive
  });

  it('tolerates non-map props', () => {
    expect(createVirtualNode('text', null)).toEqual({ primitive: 'text' });
  });
});

describe('applyMutation', () => {
  const base: PmlNode = { primitive: 'heading', props: { text: 'Old', level: 2 } };

  it('returns the node unchanged for a null record', () => {
    expect(applyMutation(base, null)).toBe(base);
  });

  it('removes the node', () => {
    const store = new ElementStore();
    store.remove('h');

    expect(applyMutation(base, store.record('h'))).toBeNull();
  });

  it('writes setText to the primitive-appropriate text slot', () => {
    const store = new ElementStore();
    store.setText('h', 'New heading');
    expect(applyMutation({ primitive: 'heading' }, store.record('h'))?.props?.text).toBe('New heading');

    store.setText('t', 'body');
    expect(applyMutation({ primitive: 'text' }, store.record('t'))?.props?.value).toBe('body');

    store.setText('b', 'Click');
    expect(applyMutation({ primitive: 'button' }, store.record('b'))?.props?.label).toBe('Click');
  });

  it('merges attribute overrides and appends created children', () => {
    const store = new ElementStore();
    store.setAttr('box', 'title', 'Hi');
    store.append('box', createVirtualNode('text', mapOf({ value: 'appended' })));

    const out = applyMutation({ primitive: 'box', children: [{ primitive: 'text', props: { value: 'first' } }] }, store.record('box'));

    expect(out?.props?.title).toBe('Hi');
    expect(out?.children).toHaveLength(2);
    expect(out?.children?.[1]).toEqual({ primitive: 'text', props: { value: 'appended' } });
  });
});

describe('buildDomNamespace', () => {
  it('dom.el(key) returns a handle whose methods mutate the store', () => {
    const store = new ElementStore();
    const dom = buildDomNamespace(store);

    const handle = callNative(dom.get('el'), ['out']) as PslMap;
    callNative(handle.get('setText'), ['hi there']);
    callNative(handle.get('setAttr'), ['href', 'javascript:x']);
    callNative(handle.get('remove'), []);

    expect(store.record('out')?.text).toBe('hi there');
    expect(store.record('out')?.attrs.href).toBe('#');
    expect(store.record('out')?.removed).toBe(true);
  });

  it('dom.create builds a known-primitive node value, null for unknown', () => {
    const store = new ElementStore();
    const dom = buildDomNamespace(store);

    const created = callNative(dom.get('create'), ['text', mapOf({ value: 'x' })]) as PslMap;
    expect(created.get('primitive')).toBe('text');

    expect(callNative(dom.get('create'), ['blink', mapOf({})])).toBeNull();
  });

  it('handle.append accepts a dom.create result and validates it', () => {
    const store = new ElementStore();
    const dom = buildDomNamespace(store);

    const created = callNative(dom.get('create'), ['text', mapOf({ value: 'row' })]);
    const handle = callNative(dom.get('el'), ['list']) as PslMap;
    callNative(handle.get('append'), [created]);

    expect(store.record('list')?.appended).toEqual([{ primitive: 'text', props: { value: 'row' } }]);
  });
});
