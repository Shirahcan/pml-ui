import React from 'react';
import { fireEvent, render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import { PreviewInteractionsProvider } from '../../src/renderer/SiteInteractionContext';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlExpr } from '../../src/pml/expressions';
import type { PmlNode } from '../../src/pml/primitives';
import type { Node } from '../../src/psl';

/**
 * Found on the test box 2026-11-11 with a counter component (owner: "Applicable types (especially native
 * types) should be properly converted to strings"; "even empty elements should be visible"; "previews
 * shouldn't disable any element ... only form submissions should be disabled/suppressed"):
 * - a value shown as words was read only when it was text, so `{self.count || 0}` drew nothing at any count;
 * - an element with nothing to show was invisible in the builder, so it could not be selected;
 * - a preview could not be used: its forms were disabled.
 */
const site = { theme: {} } as unknown as PublicSite;
const at = { line: 1, col: 1 };

const id = (name: string): Node => ({ ...at, type: 'Identifier', name }) as Node;
const member = (object: Node, name: string): Node => ({ ...at, type: 'Member', object, name }) as Node;
const path = (dotted: string): Node => dotted.split('.').slice(1).reduce((obj, name) => member(obj, name), id(dotted.split('.')[0]));
const num = (value: string): Node => ({ ...at, type: 'NumberLit', value }) as Node;
const or = (left: Node, right: Node): Node => ({ ...at, type: 'Binary', op: '||', left, right }) as Node;
const plus = (left: Node, right: Node): Node => ({ ...at, type: 'Binary', op: '+', left, right }) as Node;
const expr = (source: string, ast: Node): PmlExpr => ({ $expr: source, ast });

const natives = {
  owner: { name: 'Jane Doe', years: 12, verified: true, languages: ['English', 'French'], office: { city: 'Toronto' } },
  site: {},
  page: {},
};

const text = (value: PmlExpr): PmlNode => ({ primitive: 'text', props: { value } });
const words = (c: HTMLElement): string[] => Array.from(c.querySelectorAll('p')).map((p) => p.textContent ?? '');

describe('a value shown as words', () => {
  it('reads a number, a yes/no and a list as words, and a record as nothing', () => {
    const nodes = ['owner.years', 'owner.verified', 'owner.languages', 'owner.office'].map((dotted) => text(expr(dotted, path(dotted))));

    const { container } = render(<PmlRenderer nodes={nodes} site={site} natives={natives} />);

    expect(words(container)).toEqual(['12', 'true', 'English, French']);
  });

  it('shows a count of 0, and the count after each click (the counter)', () => {
    const count = or(path('state.count'), num('0'));
    const nodes: PmlNode[] = [
      text(expr('state.count || 0', count)),
      {
        primitive: 'button',
        props: { label: 'Add one' },
        on: { click: expr('state.count = (state.count || 0) + 1', { ...at, type: 'Assign', op: '=', target: path('state.count'), value: plus(count, num('1')) } as Node) },
      },
    ];

    const { container } = render(<PmlRenderer nodes={nodes} site={site} natives={natives} enableScripts />);

    expect(words(container)).toEqual(['0']);
    fireEvent.click(container.querySelector('button')!);
    fireEvent.click(container.querySelector('button')!);
    expect(words(container)).toEqual(['2']);
  });

  it('shows a number in a heading and a button label too', () => {
    const nodes: PmlNode[] = [
      { primitive: 'heading', props: { text: expr('owner.years', path('owner.years')), level: 2 } },
      { primitive: 'button', props: { label: expr('owner.years', path('owner.years')) } },
    ];

    const { container } = render(<PmlRenderer nodes={nodes} site={site} natives={natives} />);

    expect(container.querySelector('h2')?.textContent).toBe('12');
    expect(container.querySelector('button')?.textContent).toBe('12');
  });
});

describe('a rich-text value, by its declared kind', () => {
  // Component props p10 (owner, 2026-11-11: "pull context from the containing element on what types/kinds of
  // data to look for"). The server tags a read of a rich-text setting or field; the page formats it anywhere.
  const faq = { ...natives, owner: { ...natives.owner, faq: [{ answer: 'Pick **one** plan. See [fees](/fees).' }, { answer: 'Answer {owner.name} stays words.' }] } };
  const repeat = (children: PmlNode[]): PmlNode => ({ primitive: 'box', each: { item: 'item', ...expr('owner.faq', path('owner.faq')) }, children }) as PmlNode;
  const answerAtom = (kind?: string) => ({ type: 'expr', attrs: { expr: 'item.answer', ast: path('item.answer'), ...(kind ? { kind } : {}) } });
  const richText = (...content: object[]): PmlNode => ({ primitive: 'rich_text', props: { markdown: '', doc: { type: 'doc', content: [{ type: 'paragraph', content }] } } });

  it('formats a tagged value alone and inside a sentence, never showing its asterisks', () => {
    const node = repeat([richText(answerAtom('rich_text')), richText({ type: 'text', text: 'Answer: ' }, answerAtom('rich_text'))]);

    const { container } = render(<PmlRenderer nodes={[node]} site={site} natives={faq} />);

    expect(Array.from(container.querySelectorAll('strong')).map((b) => b.textContent)).toEqual(['one', 'one']);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/fees');
    expect(container.textContent).not.toContain('**');
    expect(container.textContent).toContain('Answer: Pick one plan.');
    // A value is only ever Markdown: a {...} inside it is never read as an expression.
    expect(container.textContent).toContain('Answer {owner.name} stays words.');
  });

  it('shows a tagged value in a heading as its words', () => {
    const node = repeat([{ primitive: 'heading', props: { text: { ...expr('item.answer', path('item.answer')), kind: 'rich_text' }, level: 3 } } as PmlNode]);

    const { container } = render(<PmlRenderer nodes={[node]} site={site} natives={faq} />);

    expect(container.querySelector('h3')?.textContent).toBe('Pick one plan. See fees.');
  });

  it('leaves an untagged value as words, asterisks and all', () => {
    const node = repeat([richText(answerAtom())]);

    const { container } = render(<PmlRenderer nodes={[node]} site={site} natives={faq} />);

    expect(container.querySelector('strong')).toBeNull();
    expect(container.textContent).toContain('Pick **one** plan.');
  });
});

describe('an element with nothing to show', () => {
  const empty: PmlNode[] = [
    { primitive: 'heading', props: { text: expr('title', id('title')), level: 2 } },
    { primitive: 'text', props: { value: '' } },
  ];

  it('is a placeholder in the builder, so it can be selected and filled in', () => {
    const { container } = render(<PmlRenderer nodes={empty} site={site} natives={natives} builderHints />);
    const hints = Array.from(container.querySelectorAll('[data-pml-empty]')).map((el) => el.textContent);

    expect(hints).toEqual(['Empty text: select it to fill it in']);
  });

  it('shows what it reads, never "empty", when its words are bound to page data with no value here', () => {
    const { container } = render(<PmlRenderer nodes={empty} site={site} natives={natives} builderHints />);
    const bound = Array.from(container.querySelectorAll('[data-pml-bound]'));

    expect(bound.map((el) => el.textContent)).toEqual(['{title}']);
    expect(container.textContent).not.toContain('Empty heading');
  });

  it('draws nothing on a live page', () => {
    const { container } = render(<PmlRenderer nodes={empty} site={site} natives={natives} enableScripts />);

    expect(container.querySelector('[data-pml-empty], [data-pml-bound]')).toBeNull();
    expect(container.querySelector('h2, p')).toBeNull();
  });
});

describe('a form in a preview', () => {
  // Jest's global FormData is Node's (undici), which cannot read a jsdom form: read the fields directly.
  const realFormData = global.FormData;
  beforeAll(() => {
    global.FormData = class {
      constructor(private readonly form: HTMLFormElement) {}
      forEach(each: (value: string, key: string) => void): void {
        Array.from(this.form.elements).forEach((el) => {
          const field = el as HTMLInputElement;
          if (field.name) each(field.value, field.name);
        });
      }
    } as unknown as typeof FormData;
  });
  afterAll(() => {
    global.FormData = realFormData;
  });

  const form: PmlNode = {
    primitive: 'form',
    props: { key: 'contact', submit_label: 'Send' },
    children: [{ primitive: 'field', props: { kind: 'text', label: 'Your name', name: 'name' } }],
  };

  it('can be filled in and sent, and says nothing was sent', async () => {
    const { container, findByRole } = render(
      <PreviewInteractionsProvider>
        <PmlRenderer nodes={[form]} site={site} natives={natives} enableScripts />
      </PreviewInteractionsProvider>,
    );
    const input = container.querySelector('input[name="name"]') as HTMLInputElement;
    const send = container.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(input.disabled).toBe(false);
    expect(send.disabled).toBe(false);

    fireEvent.change(input, { target: { value: 'Ada' } });
    fireEvent.submit(container.querySelector('form')!);

    expect((await findByRole('status')).textContent).toBe('This is a preview, so nothing was sent.');
    // The form stays as filled in: no thank-you replaces it.
    expect((container.querySelector('input[name="name"]') as HTMLInputElement).value).toBe('Ada');
  });

  it('stays disabled on the builder canvas, where nothing is provided', () => {
    const { container } = render(<PmlRenderer nodes={[form]} site={site} natives={natives} builderHints />);

    expect((container.querySelector('input[name="name"]') as HTMLInputElement).disabled).toBe(true);
  });
});
