import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { CommentCard, type CommentActions } from '../../../src/builder/editor/CommentCard';
import { BuilderHostProvider } from '../../../src/builder/editor/host';
import type { StudioComment } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const comment = { path: [0, 1], target: [0, 1], text: 'Shorter headline?', note: { author: 'Ada', color: 'yellow', at: new Date().toISOString() } } as unknown as StudioComment;

function actions(): CommentActions {
  return { onSave: vi.fn(), onResolve: vi.fn(), onDelete: vi.fn(), onAddress: vi.fn(), onRepin: vi.fn() };
}

async function openMenu() {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Actions for this comment' }), { key: 'Enter' });
  await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
}

/** One studio comment in the package (shared program E4a4c): one kebab, Delete last and confirmed, the host's words. */
describe('CommentCard', () => {
  it('puts every action in one kebab, names the host assistant, and keeps Delete last in red', async () => {
    render(
      <BuilderHostProvider assistantName="Porter">
        <CommentCard comment={comment} editing={false} onEdit={vi.fn()} onClose={vi.fn()} actions={actions()} />
      </BuilderHostProvider>,
    );
    await openMenu();

    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent?.trim())).toEqual(['Edit', 'Resolve', 'Ask Porter to address', 'Move to another element', 'Copy', 'Delete']);
    expect(items[items.length - 1].className).toContain('text-[var(--pb-danger)]');
  });

  it('asks before deleting, and only the confirm deletes', async () => {
    const a = actions();
    const onClose = vi.fn();
    render(<CommentCard comment={comment} editing={false} onEdit={vi.fn()} onClose={onClose} actions={a} />);
    await openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await waitFor(() => expect(screen.getByRole('alertdialog', { name: 'Delete this comment?' })).toBeTruthy());
    expect(a.onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(a.onDelete).toHaveBeenCalledWith(comment);
    expect(onClose).toHaveBeenCalled();
  });

  it('copies through the host, and names no assistant when the host has none', async () => {
    const onSuccess = vi.fn();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(
      <BuilderHostProvider onSuccess={onSuccess}>
        <CommentCard comment={comment} editing={false} onEdit={vi.fn()} onClose={vi.fn()} actions={actions()} />
      </BuilderHostProvider>,
    );
    await openMenu();

    expect(screen.getByRole('menuitem', { name: 'Ask the assistant to address' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('Comment copied'));
  });

  it('saves an edit with its colour and pin, and an emptied comment is deleted', () => {
    const a = actions();
    const { rerender } = render(<CommentCard comment={comment} editing onEdit={vi.fn()} onClose={vi.fn()} actions={a} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Comment' }), { target: { value: 'A shorter headline, please' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(a.onSave).toHaveBeenCalledWith(comment, 'A shorter headline, please', { color: 'yellow', placement: 'top-right' });

    rerender(<CommentCard key="again" comment={comment} editing onEdit={vi.fn()} onClose={vi.fn()} actions={a} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Comment' }), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(a.onDelete).toHaveBeenCalledWith(comment);
  });
});
