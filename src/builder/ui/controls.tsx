'use client';

import React, { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type LabelHTMLAttributes, type TextareaHTMLAttributes } from 'react';

import { cx } from './theme';

/**
 * The builder's simple controls (shared program E4a3), styled only through the theme's variables so any product's
 * look carries through. Field padding is px-3 py-2, nothing draws the browser's outline (the focus ring is the accent
 * colour), and a button never wraps.
 */

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--pb-accent)] focus-visible:ring-offset-1';

const BUTTON_VARIANTS = {
  primary: 'bg-[var(--pb-accent)] text-[var(--pb-accent-text)] hover:opacity-90',
  outline: 'border border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-text)] hover:bg-[var(--pb-subtle)]',
  ghost: 'bg-transparent text-[var(--pb-text)] hover:bg-[var(--pb-subtle)]',
  danger: 'bg-[var(--pb-danger)] text-[var(--pb-danger-text)] hover:opacity-90',
  link: 'bg-transparent text-[var(--pb-accent)] underline-offset-4 hover:underline',
} as const;

const BUTTON_SIZES = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  icon: 'h-9 w-9',
} as const;

export interface BuilderButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
}

/** A pill (a circle at `icon` size). Defaults to `type="button"`, so a button in a form never submits it by accident. */
export const Button = forwardRef<HTMLButtonElement, BuilderButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
        FOCUS,
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
});

const FIELD = cx(
  'w-full rounded-[var(--pb-radius)] border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3 py-2 text-sm text-[var(--pb-text)] placeholder:text-[var(--pb-muted)] disabled:opacity-50',
  FOCUS,
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cx(FIELD, className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cx(FIELD, 'min-h-20', className)} {...props} />;
});

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(function Label({ className, ...props }, ref) {
  // The caller passes htmlFor, or wraps the control in the label.
  return <label ref={ref} className={cx('text-sm font-medium text-[var(--pb-text)]', className)} {...props} />;
});

export interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** An on/off switch: a button with `role="switch"`, toggled by click, Space or Enter (a native button's keys). */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(function Switch({ checked, onCheckedChange, className, disabled, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      data-state={checked ? 'checked' : 'unchecked'}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
        FOCUS,
        checked ? 'bg-[var(--pb-accent)]' : 'bg-[var(--pb-border)]',
        className,
      )}
      {...props}
    >
      <span className={cx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
});
