import React from 'react';
import { fireEvent, render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';
import type { Program } from '../../src/psl';

/**
 * The imperative element handle end to end through the real renderer: a keyed node subscribes to the
 * element store, and a `<script>` that calls dom.el(key).setText / setAttr / append / remove / on
 * mutates exactly that node. The security surface holds (a javascript: href is neutralized), and with
 * scripts off (the builder) a keyed node renders inert. ASTs are hand-built (the parser is PHP-only).
 */
const site = { theme: {} } as unknown as PublicSite;
const at = { line: 1, col: 1 };

type Body = Program['body'][number];
const ident = (name: string): Body => ({ ...at, type: 'Identifier', name });
const sstr = (value: string): Body => ({ ...at, type: 'StringLit', value });
const member = (object: Body, name: string): Body => ({ ...at, type: 'Member', object, name });
const call = (callee: Body, args: Body[]): Body => ({ ...at, type: 'Call', callee, args });
const maplit = (entries: Record<string, Body>): Body => ({
  ...at,
  type: 'MapLit',
  entries: Object.entries(entries).map(([key, value]) => ({ key, value })),
});
const prog = (...body: Body[]): Program => ({ ...at, type: 'Program', body });

const domEl = (key: string): Body => call(member(ident('dom'), 'el'), [sstr(key)]);
const handle = (key: string, method: string, args: Body[]): Body => call(member(domEl(key), method), args);
const domCreate = (primitive: string, props: Record<string, Body>): Body =>
  call(member(ident('dom'), 'create'), [sstr(primitive), maplit(props)]);

const scriptNode = (program: Program): PmlNode => ({ primitive: 'script', props: { program } });

describe('PmlRenderer imperative element handle', () => {
  it('applies setText and setAttr to a keyed node', () => {
    const script = scriptNode(prog(
      handle('out', 'setText', [sstr('Set by script')]),
      handle('cta', 'setAttr', [sstr('href'), sstr('/contact')]),
    ));
    const out: PmlNode = { primitive: 'heading', props: { text: 'placeholder', level: 2 }, key: 'out' };
    const cta: PmlNode = { primitive: 'button', props: { label: 'Go', href: '#' }, key: 'cta' };

    const { container } = render(<PmlRenderer nodes={[script, out, cta]} site={site} enableScripts />);

    expect(container.querySelector('h2')?.textContent).toBe('Set by script');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/contact');
  });

  it('neutralizes a javascript: url set via setAttr', () => {
    const script = scriptNode(prog(handle('cta', 'setAttr', [sstr('href'), sstr('javascript:alert(1)')])));
    const cta: PmlNode = { primitive: 'button', props: { label: 'Go', href: '#' }, key: 'cta' };

    const { container } = render(<PmlRenderer nodes={[script, cta]} site={site} enableScripts />);

    expect(container.querySelector('a')?.getAttribute('href')).toBe('#');
  });

  it('appends a created child to a keyed container', () => {
    const script = scriptNode(prog(handle('box', 'append', [domCreate('heading', { text: sstr('Appended') })])));
    const box: PmlNode = {
      primitive: 'box',
      key: 'box',
      children: [{ primitive: 'heading', props: { text: 'Original', level: 2 } }],
    };

    const { container } = render(<PmlRenderer nodes={[script, box]} site={site} enableScripts />);

    const texts = Array.from(container.querySelectorAll('h2')).map((h) => h.textContent);
    expect(texts).toContain('Original');
    expect(texts).toContain('Appended');
  });

  it('removes a keyed node', () => {
    const script = scriptNode(prog(handle('gone', 'remove', [])));
    const gone: PmlNode = { primitive: 'heading', props: { text: 'Removable', level: 2 }, key: 'gone' };

    const { container } = render(<PmlRenderer nodes={[script, gone]} site={site} enableScripts />);

    expect(container.querySelector('h2')).toBeNull();
  });

  it('runs an imperative on(click) handler that mutates another node', () => {
    const script = scriptNode(prog(
      {
        ...at,
        type: 'FuncDecl',
        name: 'reveal',
        params: [],
        returnType: null,
        body: { ...at, type: 'Block', body: [handle('msg', 'setText', [sstr('Revealed')])] },
      },
      handle('btn', 'on', [sstr('click'), ident('reveal')]),
    ));
    const btn: PmlNode = { primitive: 'button', props: { label: 'Show', href: '#' }, key: 'btn' };
    const msg: PmlNode = { primitive: 'text', props: { value: 'hidden' }, key: 'msg' };

    const { container } = render(<PmlRenderer nodes={[script, btn, msg]} site={site} enableScripts />);

    expect(container.querySelector('p')?.textContent).toBe('hidden');

    fireEvent.click(container.querySelector('a')!);

    expect(container.querySelector('p')?.textContent).toBe('Revealed');
  });

  it('is inert in the builder: a keyed node renders statically when scripts are off', () => {
    const out: PmlNode = { primitive: 'heading', props: { text: 'static', level: 2 }, key: 'out' };

    const { container } = render(<PmlRenderer nodes={[out]} site={site} />);

    expect(container.querySelector('h2')?.textContent).toBe('static');
  });
});
