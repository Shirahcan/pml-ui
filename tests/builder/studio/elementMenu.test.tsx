import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { BuilderHostProvider } from '../../../src/builder/editor/host';
import { ElementMenu } from '../../../src/builder/studio/ElementMenu';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;
Element.prototype.hasPointerCapture ??= () => false;

const p = (uid: string, value: string) => ({ primitive: 'p', uid, children: [{ primitive: 'text', props: { value } }] }) as unknown as PmlNode;
const nodes = [p('abc111', 'One'), { primitive: 'box', uid: 'bbb222', children: [p('kid111', 'Inner')] }, p('abc333', 'Three')] as unknown as PmlNode[];

function open(props: Partial<React.ComponentProps<typeof ElementMenu>> = {}) {
  const change = vi.fn();
  const select = vi.fn();
  const onSuccess = vi.fn();
  render(
    <BuilderHostProvider onSuccess={onSuccess}>
      <ElementMenu nodes={nodes} path={[1]} label="Box" change={change} select={select} {...props} />
    </BuilderHostProvider>,
  );
  const trigger = screen.getByRole('button', { name: 'Actions for this box' });
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
  fireEvent.keyDown(trigger, { key: 'Enter' });

  return { change, select, onSuccess, menu: () => screen.getByRole('menu') };
}

/** The Studio's element menu (shared PML Studio P3a; the kebab rule). */
describe('ElementMenu', () => {
  beforeEach(() => sessionStorage.clear());

  it('lists the actions in order, the host items before Comment, and Remove last after a separator', async () => {
    const onAddToPorter = vi.fn();
    const { menu } = open({ onComment: () => undefined, extraActions: [{ key: 'porter', label: 'Add to Porter', onSelect: onAddToPorter }] });

    const items = within(await waitFor(menu)).getAllByRole('menuitem').map((item) => item.textContent);
    expect(items).toEqual(['Move up', 'Move down', 'Duplicate', 'Copy', 'Wrap in a box', 'Unwrap', 'Add to Porter', 'Comment', 'Remove box']);
    expect(within(menu()).getByRole('separator')).toBeTruthy();

    fireEvent.click(within(menu()).getByRole('menuitem', { name: 'Add to Porter' }));
    expect(onAddToPorter).toHaveBeenCalledWith([1], nodes[1]);
  });

  it('Copy holds the element and says so; Paste after this then appears on any element', async () => {
    const { menu, onSuccess } = open();

    fireEvent.click(within(await waitFor(menu)).getByRole('menuitem', { name: 'Copy' }));
    expect(onSuccess).toHaveBeenCalledWith(expect.stringContaining('Copied.'));
    expect(JSON.parse(sessionStorage.getItem('pml-clipboard')!).uid).toBe('bbb222');
  });

  it('Duplicate changes the tree once and selects the copy', async () => {
    const { menu, change, select } = open();

    fireEvent.click(within(await waitFor(menu)).getByRole('menuitem', { name: 'Duplicate' }));
    expect((change.mock.calls[0][0] as PmlNode[]).length).toBe(4);
    expect(select).toHaveBeenCalledWith([2]);
  });

  it('Remove asks first, and only "Remove" in the dialog removes', async () => {
    const { menu, change } = open();

    fireEvent.click(within(await waitFor(menu)).getByRole('menuitem', { name: 'Remove box' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText('Remove this box?')).toBeTruthy();
    expect(change).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect((change.mock.calls[0][0] as PmlNode[]).map((n) => n.uid)).toEqual(['abc111', 'abc333']);
  });
});
