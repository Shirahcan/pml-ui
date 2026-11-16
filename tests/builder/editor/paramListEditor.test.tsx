import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

import { ParamListEditor } from '../../../src/builder/editor/ParamListEditor';
import { bindingFree } from '../../../src/builder/editor/studioTree';
import { pathExpr } from '../../../src/language';
import type { PmlNode } from '../../../src/language';

/**
 * Component props p07b / p06a (2026-11-11): a list of plans edited on a page, and a setting taken back into the
 * design with its own type.
 */
const PLANS = {
  kind: 'list' as const,
  label: 'Plan',
  fields: [
    { name: 'name', kind: 'text' as const, label: 'Name' },
    { name: 'price', kind: 'number' as const, label: 'Price' },
    { name: 'featured', kind: 'yes_no' as const, label: 'Featured' },
  ],
};

describe('ParamListEditor', () => {
  it('adds an item with blank fields and edits one field, keeping the rest', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ParamListEditor spec={PLANS} value={[{ name: 'Starter', price: 49, featured: false }]} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add an item' }));
    expect(onChange).toHaveBeenLastCalledWith([
      { name: 'Starter', price: 49, featured: false },
      { name: '', price: 0, featured: false },
    ]);

    rerender(<ParamListEditor spec={PLANS} value={[{ name: 'Starter', price: 49, featured: false }]} onChange={onChange} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '59' } });
    expect(onChange).toHaveBeenLastCalledWith([{ name: 'Starter', price: 59, featured: false }]);
  });

  it('edits a list of plain values and a map', () => {
    const onChange = vi.fn();
    render(<ParamListEditor spec={{ kind: 'map', label: 'Contact', fields: [{ name: 'email', kind: 'text', label: 'Email' }] }} value={{ email: '' }} onChange={onChange} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a@b.c' } });
    expect(onChange).toHaveBeenLastCalledWith({ email: 'a@b.c' });
  });
});

describe('bindingFree (taking a setting back into the design)', () => {
  it('writes the value back with its type, frees styles, and drops a show-or-hide condition', () => {
    const design: PmlNode = {
      primitive: 'box',
      style: { background: pathExpr('props.tone') },
      children: [
        { primitive: 'heading', props: { text: 'Hi', level: 2 }, if: pathExpr('props.show_heading') },
        { primitive: 'rich_text', props: { markdown: '{props.intro}' } },
      ],
    } as PmlNode;

    expect(bindingFree(design, 'tone', 'surface', 'style').style).toEqual({ background: 'surface' });
    expect(bindingFree(design, 'show_heading', 'true', 'yes_no').children?.[0].if).toBeUndefined();
    expect(bindingFree(design, 'intro', 'Pick a **plan**.', 'rich_text').children?.[1].props).toEqual({ markdown: 'Pick a **plan**.' });

    const toggle = { primitive: 'button', props: { label: 'Go', disabled: pathExpr('props.off') } } as unknown as PmlNode;
    expect((bindingFree(toggle, 'off', 'true', 'yes_no').props as Record<string, unknown>).disabled).toBe(true);
  });
});
