'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import React, { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type HTMLAttributes } from 'react';

import { cx, useOwnVars, useThemeVars } from './theme';

/**
 * The builder's Select and Card (shared program E4a3c), the two the designer uses beside E4a3's eight. The select is
 * Radix (typeahead, arrow keys, the value announced), portalled with the theme's variables set on itself.
 */

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<ElementRef<typeof SelectPrimitive.Trigger>, ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>>(
  function SelectTrigger({ className, children, style, ...props }, ref) {
    const vars = useOwnVars(style);

    return (
      <SelectPrimitive.Trigger
        ref={ref}
        style={vars}
        className={cx(
          'flex h-10 w-full items-center justify-between gap-2 rounded-[var(--pb-radius)] border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3 py-2 text-sm text-[var(--pb-text)] outline-none',
          'focus-visible:ring-2 focus-visible:ring-[var(--pb-accent)] disabled:opacity-50 data-[placeholder]:text-[var(--pb-muted)]',
          className,
        )}
        {...props}
      >
        {children}
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
    );
  },
);

export const SelectContent = forwardRef<ElementRef<typeof SelectPrimitive.Content>, ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(
  function SelectContent({ className, style, children, position = 'popper', ...props }, ref) {
    const vars = useThemeVars();

    return (
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          ref={ref}
          position={position}
          sideOffset={4}
          className={cx(
            'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--pb-radius)] border border-[var(--pb-border)] bg-[var(--pb-surface)] shadow-lg',
            className,
          )}
          style={{ ...vars, ...style }}
          {...props}
        >
          <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    );
  },
);

export const SelectItem = forwardRef<ElementRef<typeof SelectPrimitive.Item>, ComponentPropsWithoutRef<typeof SelectPrimitive.Item>>(
  function SelectItem({ className, children, ...props }, ref) {
    return (
      <SelectPrimitive.Item
        ref={ref}
        className={cx(
          'relative flex cursor-default select-none items-center rounded-[calc(var(--pb-radius)/2)] py-2 pl-8 pr-3 text-sm text-[var(--pb-text)] outline-none',
          'data-[disabled]:opacity-50 data-[highlighted]:bg-[var(--pb-subtle)]',
          className,
        )}
        {...props}
      >
        <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
          <SelectPrimitive.ItemIndicator>
            <Check className="h-4 w-4" />
          </SelectPrimitive.ItemIndicator>
        </span>
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </SelectPrimitive.Item>
    );
  },
);

/** A plain panel in the theme's surface, border and radius. */
export function Card({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-[var(--pb-radius)] border border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-text)]', className)} style={useOwnVars(style)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('p-4', className)} {...props} />;
}
