'use client';

import React, { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from 'react';

/**
 * The builder's own look, as VALUES the product passes (shared program E4a3): the package cannot import a product's
 * UI kit, so its primitives read these through CSS variables. A portalled piece (a dialog, a menu) renders outside
 * the provider's element, so it reads the same variables from context and sets them on itself.
 */
export interface BuilderTheme {
  /** The main action colour (a primary button, a switched-on switch, focus rings). */
  accent: string;
  /** Text on the accent colour. */
  accentText: string;
  text: string;
  muted: string;
  border: string;
  /** Fields, menus and dialogs. */
  surface: string;
  /** A hover or a selected row. */
  subtle: string;
  danger: string;
  dangerText: string;
  /** Corner radius of fields and panels (a button is always a pill or a circle). */
  radius: string;
  font: string;
}

/** Neutral defaults: a product that passes nothing still gets a readable, accessible builder. */
export const DEFAULT_BUILDER_THEME: BuilderTheme = {
  accent: '#4361EE',
  accentText: '#FFFFFF',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  surface: '#FFFFFF',
  subtle: '#F1F5F9',
  danger: '#DC2626',
  dangerText: '#FFFFFF',
  radius: '0.75rem',
  font: 'inherit',
};

// null outside a provider, so a primitive knows it must carry the variables itself.
const ThemeContext = createContext<BuilderTheme | null>(null);

/** The CSS variables the primitives read (`var(--pb-accent)` and so on). */
export function themeVars(theme: BuilderTheme): CSSProperties {
  return {
    '--pb-accent': theme.accent,
    // A light tint of the accent (a selected row): computed here, because Tailwind 3 cannot put an opacity on a
    // var() colour (`bg-[var(--pb-accent)]/10` compiles to nothing there), and hosts on Tailwind 3 exist (Portify).
    '--pb-accent-soft': `color-mix(in srgb, ${theme.accent} 10%, transparent)`,
    '--pb-accent-text': theme.accentText,
    '--pb-text': theme.text,
    '--pb-muted': theme.muted,
    '--pb-border': theme.border,
    '--pb-surface': theme.surface,
    '--pb-subtle': theme.subtle,
    '--pb-danger': theme.danger,
    '--pb-danger-text': theme.dangerText,
    '--pb-radius': theme.radius,
    '--pb-font': theme.font,
  } as CSSProperties;
}

/** Wraps the builder; a partial theme is merged over the defaults. */
export function BuilderThemeProvider({ theme, children }: { theme?: Partial<BuilderTheme>; children: ReactNode }) {
  const merged = useMemo(() => ({ ...DEFAULT_BUILDER_THEME, ...theme }), [theme]);

  return (
    <ThemeContext.Provider value={merged}>
      <div style={{ ...themeVars(merged), fontFamily: 'var(--pb-font)', color: 'var(--pb-text)' }}>{children}</div>
    </ThemeContext.Provider>
  );
}

/** The variables for a portalled piece, which does not sit inside the provider's element. */
export function useThemeVars(): CSSProperties {
  const theme = useContext(ThemeContext) ?? DEFAULT_BUILDER_THEME;

  return useMemo(() => ({ ...themeVars(theme), fontFamily: 'var(--pb-font)', color: 'var(--pb-text)' }), [theme]);
}

const DEFAULT_VARS = themeVars(DEFAULT_BUILDER_THEME);

/**
 * For a primitive's own element: nothing inside a provider (the provider's element already sets the variables, and
 * a host's override must win), the default theme's variables outside one, so a control dropped into a host page
 * that has no provider yet still has its colours instead of resolving every `var(--pb-*)` to nothing.
 */
export function useOwnVars(style?: CSSProperties): CSSProperties | undefined {
  const inProvider = useContext(ThemeContext) !== null;

  if (inProvider) return style;

  return style ? { ...DEFAULT_VARS, ...style } : DEFAULT_VARS;
}

/** Joins class names, skipping empty ones. */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}
