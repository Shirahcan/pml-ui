import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { componentTextField } from '../../../src/builder/editor/InlineTextOverlay';
import { PmlCanvas } from '../../../src/builder/editor/PmlCanvas';
import type { PmlNode } from '../../../src/language';

/** A component instance whose answer the reader sees as a paragraph inside it. */
const source = [{ component: 'answer_box', props: { label: 'Short answer', answer: 'You need one year of skilled work.' } }] as unknown as PmlNode[];
const compiled = [
  {
    primitive: 'box',
    props: {},
    children: [
      { primitive: 'text', props: { value: 'Short answer' } },
      { primitive: 'text', props: { value: 'You need one year of skilled work.' } },
    ],
  },
] as unknown as PmlNode[];

const base = { site: {}, selectedIndex: null, viewport: 'desktop' as const, onMove: vi.fn(), onDelete: vi.fn(), onSelect: vi.fn() };

/** Post layouts E1 (owner 2026-11-16): double-click any text to edit it in place, the host's panel kept shut. */
describe('quick edits', () => {
  it('maps words back to exactly one of a component prop, never a guess', () => {
    const node = { component: 'card', props: { title: 'Fees  and\n funds', note: 'Same', other: 'Same', count: 3 } } as unknown as PmlNode;

    expect(componentTextField(node, ' Fees and funds ')).toBe('title');
    expect(componentTextField(node, 'Same')).toBeNull();
    expect(componentTextField(node, 'Words fixed in the design')).toBeNull();
    expect(componentTextField(node, '')).toBeNull();
    expect(componentTextField({ primitive: 'text', props: { value: 'x' } } as unknown as PmlNode, 'x')).toBeNull();
  });

  it('edits a component prop in place and tells the host when it starts and ends', () => {
    const onEditText = vi.fn();
    const onQuickEdit = vi.fn();
    render(<PmlCanvas {...base} nodes={source} compiled={compiled} onSelectPath={vi.fn()} onEditText={onEditText} quickEditAll onQuickEdit={onQuickEdit} />);

    fireEvent.doubleClick(screen.getByText('You need one year of skilled work.'));

    const box = screen.getByRole('textbox', { name: 'Edit this text' }) as HTMLTextAreaElement;
    expect(box.value).toBe('You need one year of skilled work.');
    expect(onQuickEdit).toHaveBeenLastCalledWith(true);
    // The box is see-through over the hidden words, so the section's own colour shows behind it.
    expect(box.style.background).toBe('transparent');
    expect(screen.getByText('You need one year of skilled work.', { selector: 'p' }).style.visibility).toBe('hidden');

    fireEvent.change(box, { target: { value: 'One year of skilled work, in the last ten years.' } });
    fireEvent.keyDown(box, { key: 'Enter' });

    expect(onEditText).toHaveBeenCalledWith([0], 'answer', 'One year of skilled work, in the last ten years.');
    expect(onQuickEdit).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('textbox', { name: 'Edit this text' })).toBeNull();
    expect(screen.getByText('You need one year of skilled work.', { selector: 'p' }).style.visibility).toBe('');
  });

  it('leaves component text to the panel while the host has not turned quick edits on', () => {
    const onQuickEdit = vi.fn();
    render(<PmlCanvas {...base} nodes={source} compiled={compiled} onSelectPath={vi.fn()} onEditText={vi.fn()} onQuickEdit={onQuickEdit} />);

    fireEvent.doubleClick(screen.getByText('You need one year of skilled work.'));

    expect(screen.queryByRole('textbox', { name: 'Edit this text' })).toBeNull();
    expect(onQuickEdit).not.toHaveBeenCalled();
  });

  it('Escape restores the words and still tells the host the edit ended', () => {
    const onEditText = vi.fn();
    const onQuickEdit = vi.fn();
    render(<PmlCanvas {...base} nodes={source} compiled={compiled} onSelectPath={vi.fn()} onEditText={onEditText} quickEditAll onQuickEdit={onQuickEdit} />);

    fireEvent.doubleClick(screen.getByText('Short answer'));
    const box = screen.getByRole('textbox', { name: 'Edit this text' });
    fireEvent.change(box, { target: { value: 'Changed my mind' } });
    fireEvent.keyDown(box, { key: 'Escape' });

    expect(onEditText).not.toHaveBeenCalled();
    expect(onQuickEdit).toHaveBeenLastCalledWith(false);
  });
});
