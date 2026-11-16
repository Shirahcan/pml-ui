import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Button } from '../../src/builder/ui/controls';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle,
  Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../src/builder/ui/overlays';
import { BuilderThemeProvider } from '../../src/builder/ui/theme';

// Radix's popper measures the trigger; jsdom has no ResizeObserver.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

/** The builder's dialogs and menu (shared program E4a3b): the modal rule, focus and keys, the theme in a portal. */
describe('builder overlays', () => {
  it('a dialog keeps its footer reachable: bounded height, only the body scrolls', () => {
    render(
      <BuilderThemeProvider theme={{ accent: '#123456' }}>
        <Dialog open>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader><DialogTitle>Page settings</DialogTitle></DialogHeader>
            <DialogBody data-testid="body">Long content</DialogBody>
            <DialogFooter><Button>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </BuilderThemeProvider>,
    );

    const panel = screen.getByRole('dialog', { name: 'Page settings' });
    expect(panel.className).toContain('max-h-[90vh]');
    expect(panel.className).toContain('overflow-hidden');
    expect(screen.getByTestId('body').className).toContain('min-h-0 flex-1 overflow-y-auto');
    expect(panel.getAttribute('style')).toContain('--pb-accent: #123456');
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('an alert dialog asks, and only its action carries out the act', () => {
    const remove = vi.fn();
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Delete this page?</AlertDialogTitle>
          <AlertDialogDescription>It cannot be undone.</AlertDialogDescription>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(screen.getByRole('alertdialog', { name: 'Delete this page?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('a menu opens from the keyboard and a destructive item comes last, in the danger colour', async () => {
    const copy = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button aria-label="Actions">⋮</Button></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={copy}>Copy</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Actions' }), { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());

    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Copy', 'Delete']);
    expect(items[1].className).toContain('text-[var(--pb-danger)]');
    fireEvent.click(items[0]);
    expect(copy).toHaveBeenCalledTimes(1);
  });
});
