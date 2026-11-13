import React from 'react';
import { render, fireEvent } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlExpr } from '../../src/pml/expressions';
import type { PmlNode } from '../../src/pml/primitives';
import type { Node, Program } from '../../src/psl';

/**
 * PML v3 L3 through the real renderer: a `{...}` value is a PSL expression read against the natives
 * (owner / site / page) and `state`; `if` / `else` chains and `each` decide what draws; an `on-click`
 * handler changes state on an interactive page and the page redraws. In the builder (scripts off)
 * expressions still read the natives, and nothing reacts.
 */
const site = { theme: {} } as unknown as PublicSite;
const at = { line: 1, col: 1 };

const id = (name: string): Node => ({ ...at, type: 'Identifier', name }) as Node;
const member = (object: Node, name: string): Node => ({ ...at, type: 'Member', object, name }) as Node;
const path = (dotted: string): Node => dotted.split('.').slice(1).reduce((obj, name) => member(obj, name), id(dotted.split('.')[0]));
const expr = (source: string, ast: Node): PmlExpr => ({ $expr: source, ast });
const read = (dotted: string): PmlExpr => expr(dotted, path(dotted));
const assign = (dotted: string, value: Node): PmlExpr =>
  expr(`${dotted} = ...`, { ...at, type: 'Assign', op: '=', target: path(dotted), value } as Node);
const bool = (value: boolean): Node => ({ ...at, type: 'BoolLit', value }) as Node;

const natives = {
  owner: { kind: 'consultant', name: 'Jane Doe', registered_name: 'Jane Doe', packages: [{ name: 'Study permit' }, { name: 'Work permit' }] },
  site: { username: 'jane-doe', pages: [] },
  page: { title: 'Home', path: '/jane-doe' },
};

const heading = (text: unknown, extra: Partial<PmlNode> = {}): PmlNode => ({ primitive: 'heading', props: { text, level: 2 }, ...extra });
const texts = (c: HTMLElement): string[] => Array.from(c.querySelectorAll('h2')).map((h) => h.textContent ?? '');

describe('PmlRenderer expressions over PSL natives', () => {
  it('draws a native in the builder and on the live page alike', () => {
    const node = heading(read('owner.registered_name'));

    expect(texts(render(<PmlRenderer nodes={[node]} site={site} natives={natives} />).container)).toEqual(['Jane Doe']);
    expect(texts(render(<PmlRenderer nodes={[node]} site={site} natives={natives} enableScripts />).container)).toEqual(['Jane Doe']);
  });

  it('repeats an element once per item with each={item in list}', () => {
    const node = heading(read('package.name'), { each: { item: 'package', ...read('owner.packages') } });

    const { container } = render(<PmlRenderer nodes={[node]} site={site} natives={natives} />);

    expect(texts(container)).toEqual(['Study permit', 'Work permit']);
  });

  it('shows the first true branch of an if / else chain', () => {
    const nodes: PmlNode[] = [
      heading('Has packages', { if: read('owner.packages') }),
      heading('No packages yet', { else: true }),
      heading('Always'),
    ];

    expect(texts(render(<PmlRenderer nodes={nodes} site={site} natives={natives} />).container)).toEqual(['Has packages', 'Always']);
    expect(texts(render(<PmlRenderer nodes={nodes} site={site} natives={{ ...natives, owner: { packages: [] } }} />).container)).toEqual([
      'No packages yet',
      'Always',
    ]);
  });

  it('runs an on-click that writes state and redraws what reads it (interactive page)', () => {
    const nodes: PmlNode[] = [
      { primitive: 'button', props: { label: 'Open' }, on: { click: assign('state.open', bool(true)) } },
      heading('Now shown', { if: read('state.open') }),
    ];

    const { container } = render(<PmlRenderer nodes={nodes} site={site} natives={natives} enableScripts />);

    expect(container.querySelector('h2')).toBeNull();
    fireEvent.click(container.querySelector('button')!);
    expect(texts(container)).toEqual(['Now shown']);
  });

  it('calls a function a script defined when the handler names it', () => {
    const script: PmlNode = {
      primitive: 'script',
      props: {
        program: {
          ...at,
          type: 'Program',
          body: [{ ...at, type: 'FuncDecl', name: 'openIt', params: [], returnType: null, body: { ...at, type: 'Block', body: [assign('state.open', bool(true)).ast] } }],
        } as unknown as Program,
      },
    };
    const nodes: PmlNode[] = [
      script,
      { primitive: 'button', props: { label: 'Open' }, on: { click: read('openIt') } },
      heading('Opened', { if: read('state.open') }),
    ];

    const { container } = render(<PmlRenderer nodes={nodes} site={site} natives={natives} enableScripts />);
    fireEvent.click(container.querySelector('button')!);

    expect(texts(container)).toEqual(['Opened']);
  });

  it('is inert in the builder: a click changes nothing when scripts are off', () => {
    const nodes: PmlNode[] = [
      { primitive: 'button', props: { label: 'Open' }, on: { click: assign('state.open', bool(true)) } },
      heading('Now shown', { if: read('state.open') }),
    ];

    const { container } = render(<PmlRenderer nodes={nodes} site={site} natives={natives} />);
    fireEvent.click(container.querySelector('button')!);

    expect(container.querySelector('h2')).toBeNull();
  });

  it('reads a name no page has as nothing, never a crash', () => {
    const { container } = render(<PmlRenderer nodes={[heading(read('ownr.name')), heading('Still here')]} site={site} natives={natives} />);

    // A heading with no words is not drawn; the rest of the page is.
    expect(texts(container)).toEqual(['Still here']);
  });
});
