'use client';

import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as MenuPrimitive from '@radix-ui/react-dropdown-menu';
import React, { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from 'react';

import { cx, useThemeVars } from './theme';

/**
 * The builder's dialogs and menu (shared program E4a3b), on Radix (focus trap, Escape, keyboard navigation), themed
 * through the theme's variables. They render in a portal, so each reads the variables from context and sets them on
 * itself.
 *
 * ⚠ THE MODAL RULE: a dialog is bounded by the viewport (90vh), its header and footer stay put, and only its BODY
 * scrolls (`flex-1 min-h-0 overflow-y-auto`), so the footer's buttons are reachable on a 600px screen. Put long
 * content in DialogBody, never straight into DialogContent.
 */

const OVERLAY = 'fixed inset-0 z-50 bg-black/40';
const PANEL = cx(
  'fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden',
  'rounded-[var(--pb-radius)] border border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-text)] shadow-xl outline-none',
);

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/** How wide a dialog may grow (a class join cannot override one width with another, so the width is a prop). */
const DIALOG_WIDTH = { md: 'max-w-lg', lg: 'max-w-xl', xl: 'max-w-2xl', '2xl': 'max-w-3xl' } as const;

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { size?: keyof typeof DIALOG_WIDTH }
>(
  function DialogContent({ className, style, children, size = 'md', ...props }, ref) {
    const vars = useThemeVars();

    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={OVERLAY} style={vars} />
        <DialogPrimitive.Content ref={ref} className={cx(PANEL, DIALOG_WIDTH[size], className)} style={{ ...vars, ...style }} {...props}>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  },
);

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('shrink-0 space-y-1 px-5 pb-3 pt-5', className)} {...props} />;
}

/** The part of a dialog that scrolls. */
export function DialogBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('min-h-0 flex-1 overflow-y-auto px-5 py-2', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('flex shrink-0 flex-wrap justify-end gap-2 border-t border-[var(--pb-border)] px-5 py-4', className)} {...props} />;
}

export const DialogTitle = forwardRef<ElementRef<typeof DialogPrimitive.Title>, ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(function DialogTitle({ className, ...props }, ref) {
  return <DialogPrimitive.Title ref={ref} className={cx('text-base font-semibold', className)} {...props} />;
});

export const DialogDescription = forwardRef<ElementRef<typeof DialogPrimitive.Description>, ComponentPropsWithoutRef<typeof DialogPrimitive.Description>>(
  function DialogDescription({ className, ...props }, ref) {
    return <DialogPrimitive.Description ref={ref} className={cx('text-sm text-[var(--pb-muted)]', className)} {...props} />;
  },
);

/** A question before something that cannot be undone (a delete): it never closes on an outside click. */
export const AlertDialog = AlertDialogPrimitive.Root;
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

export const AlertDialogContent = forwardRef<ElementRef<typeof AlertDialogPrimitive.Content>, ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>>(
  function AlertDialogContent({ className, style, children, ...props }, ref) {
    const vars = useThemeVars();

    return (
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className={OVERLAY} style={vars} />
        <AlertDialogPrimitive.Content ref={ref} className={cx(PANEL, 'max-w-lg', className)} style={{ ...vars, ...style }} {...props}>
          {children}
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    );
  },
);

export const AlertDialogTitle = forwardRef<ElementRef<typeof AlertDialogPrimitive.Title>, ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>>(
  function AlertDialogTitle({ className, ...props }, ref) {
    return <AlertDialogPrimitive.Title ref={ref} className={cx('text-base font-semibold', className)} {...props} />;
  },
);

export const AlertDialogDescription = forwardRef<ElementRef<typeof AlertDialogPrimitive.Description>, ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>>(
  function AlertDialogDescription({ className, ...props }, ref) {
    return <AlertDialogPrimitive.Description ref={ref} className={cx('text-sm text-[var(--pb-muted)]', className)} {...props} />;
  },
);

/** The dialog's header and footer, named as an alert dialog's for code moved from shadcn (E4a4g). */
export const AlertDialogHeader = DialogHeader;
export const AlertDialogFooter = DialogFooter;

// A pill like the package Button. Used only WITHOUT asChild: with asChild the child (a Button) styles itself, and
// these classes would be merged onto it by Radix's Slot.
const ALERT_BUTTON =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--pb-accent)] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50';

export const AlertDialogCancel = forwardRef<ElementRef<typeof AlertDialogPrimitive.Cancel>, ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>>(
  function AlertDialogCancel({ className, asChild, ...props }, ref) {
    return (
      <AlertDialogPrimitive.Cancel
        ref={ref}
        asChild={asChild}
        className={asChild ? className : cx(ALERT_BUTTON, 'border border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-text)] hover:bg-[var(--pb-subtle)]', className)}
        {...props}
      />
    );
  },
);

export const AlertDialogAction = forwardRef<ElementRef<typeof AlertDialogPrimitive.Action>, ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>>(
  function AlertDialogAction({ className, asChild, ...props }, ref) {
    return (
      <AlertDialogPrimitive.Action
        ref={ref}
        asChild={asChild}
        className={asChild ? className : cx(ALERT_BUTTON, 'bg-[var(--pb-accent)] text-[var(--pb-accent-text)] hover:opacity-90', className)}
        {...props}
      />
    );
  },
);

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;

export const DropdownMenuContent = forwardRef<ElementRef<typeof MenuPrimitive.Content>, ComponentPropsWithoutRef<typeof MenuPrimitive.Content>>(
  function DropdownMenuContent({ className, style, sideOffset = 6, align = 'end', ...props }, ref) {
    const vars = useThemeVars();

    return (
      <MenuPrimitive.Portal>
        <MenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          align={align}
          className={cx('z-50 min-w-44 overflow-hidden rounded-[var(--pb-radius)] border border-[var(--pb-border)] bg-[var(--pb-surface)] p-1 shadow-lg', className)}
          style={{ ...vars, ...style }}
          {...props}
        />
      </MenuPrimitive.Portal>
    );
  },
);

export const DropdownMenuItem = forwardRef<ElementRef<typeof MenuPrimitive.Item>, ComponentPropsWithoutRef<typeof MenuPrimitive.Item> & { destructive?: boolean }>(
  function DropdownMenuItem({ className, destructive = false, ...props }, ref) {
    return (
      <MenuPrimitive.Item
        ref={ref}
        className={cx(
          'flex cursor-default select-none items-center gap-2 rounded-[calc(var(--pb-radius)/2)] px-3 py-2 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--pb-subtle)] [&_svg]:size-4',
          destructive ? 'text-[var(--pb-danger)]' : 'text-[var(--pb-text)]',
          className,
        )}
        {...props}
      />
    );
  },
);

export const DropdownMenuSeparator = forwardRef<ElementRef<typeof MenuPrimitive.Separator>, ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>>(
  function DropdownMenuSeparator({ className, ...props }, ref) {
    return <MenuPrimitive.Separator ref={ref} className={cx('my-1 h-px bg-[var(--pb-border)]', className)} {...props} />;
  },
);

export const DropdownMenuLabel = forwardRef<ElementRef<typeof MenuPrimitive.Label>, ComponentPropsWithoutRef<typeof MenuPrimitive.Label>>(
  function DropdownMenuLabel({ className, ...props }, ref) {
    return <MenuPrimitive.Label ref={ref} className={cx('px-3 py-1.5 text-xs font-medium text-[var(--pb-muted)]', className)} {...props} />;
  },
);
