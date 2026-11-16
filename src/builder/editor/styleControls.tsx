'use client';

import React from 'react';

import { RESPONSIVE_STYLE_KEYS, STYLE_TOKENS, tokenLabel } from '../../language';
import { Input } from '../ui/controls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { PaddingField } from './PaddingField';

/*
 * The Style modal's controls (shared program E4a4e, from Portify's StyleModal, split so neither file passes 400
 * lines): the token select, the responsive group, the palette picker and the pixel input.
 */

/** A token Select whose first option ("Default") clears the key. Labels via tokenLabel (phase 05). */
export function StyleSelect({
  label,
  value,
  options,
  onChange,
  defaultLabel = 'Default',
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  /** What leaving it unset means, when "Default" would not say (Width: the site's standard page width). */
  defaultLabel?: string;
}): React.JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <Select value={value || '__default'} onValueChange={(v) => onChange(v === '__default' ? '' : v)}>
        <SelectTrigger className="px-3 py-2 outline-none">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__default">{defaultLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {tokenLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** The words for each layout token that can differ by screen size (S2-09). */
const RESPONSIVE_LABELS: Record<(typeof RESPONSIVE_STYLE_KEYS)[number], string> = {
  padding: 'Top and bottom padding',
  padding_x: 'Left and right padding',
  margin_y: 'Outer margin',
  align: 'Text alignment',
  width: 'Width',
  heading_size: 'Heading size',
  body_size: 'Body size',
  justify: 'Distribute',
  align_items: 'Align items',
  min_height: 'Minimum height',
  col_span: 'Columns it spans (in a grid)',
  carousel_per_view: 'Carousel: items in view',
};

/**
 * Different on larger screens (S2-09): each layout token's TABLET (from 768px) and DESKTOP (from
 * 1024px) value, over the phone-first value set above. Collapsed by default: most elements look right
 * everywhere, and this is for the ones that should not.
 */
export function ResponsiveGroup({
  style,
  set,
}: {
  style: Record<string, unknown>;
  set: (updates: Record<string, unknown>) => void;
}): React.JSX.Element {
  const read = (key: string): string => {
    const v = style[key];

    return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
  };
  const count = RESPONSIVE_STYLE_KEYS.filter((k) => read(`md:${k}`) || read(`lg:${k}`)).length;

  return (
    <details className="group rounded-xl border border-white/20 p-3" open={count > 0}>
      <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-[var(--pb-muted)] outline-none">
        Different on larger screens{count > 0 ? ` (${count})` : ''}
      </summary>
      <p className="mt-2 text-xs text-[var(--pb-muted)]">
        The values above are for phones. Set a value here only where tablets (768px and wider) or desktops
        (1024px and wider) should differ. Colours and effects stay the same on every screen.
      </p>
      <div className="mt-3 space-y-4">
        {RESPONSIVE_STYLE_KEYS.map((key) => {
          const options = (STYLE_TOKENS as Record<string, readonly string[]>)[key].filter((o) => o !== 'custom');

          // A padding may be one size or one per side on each screen size too (owner 2026-11-12).
          if (key === 'padding' || key === 'padding_x') {
            const sides: [string, string] = key === 'padding' ? ['Top', 'Bottom'] : ['Left', 'Right'];

            return (
              <div key={key} className="space-y-3">
                <p className="text-sm font-medium">{RESPONSIVE_LABELS[key]}</p>
                <PaddingField label="Tablet" sideLabels={sides} value={read(`md:${key}`)} options={options} onChange={(v) => set({ [`md:${key}`]: v })} />
                <PaddingField label="Desktop" sideLabels={sides} value={read(`lg:${key}`)} options={options} onChange={(v) => set({ [`lg:${key}`]: v })} />
              </div>
            );
          }

          return (
            <div key={key}>
              <p className="mb-1 text-sm font-medium">{RESPONSIVE_LABELS[key]}</p>
              <div className="grid grid-cols-2 gap-2">
                <StyleSelect label="Tablet" value={read(`md:${key}`)} options={options} onChange={(v) => set({ [`md:${key}`]: v })} />
                <StyleSelect label="Desktop" value={read(`lg:${key}`)} options={options} onChange={(v) => set({ [`lg:${key}`]: v })} />
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

/** A titled group of related controls inside the modal. */
export function Group({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--pb-muted)]">{title}</h4>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/**
 * Palette colour swatches (theme vars) + a custom-hex escape valve. Choosing a swatch sets the
 * palette TOKEN (brand + legibility safe); the custom picker sets the bounded #rrggbb value instead.
 * The two are mutually exclusive, so picking one clears the other.
 */
export const TEXT_SWATCH: Record<string, string> = {
  default: 'var(--site-text)',
  muted: 'var(--site-muted)',
  accent: 'var(--site-accent)',
  'on-accent': 'var(--site-accent-text)',
  success: '#059669',
  danger: '#dc2626',
};

export const BORDER_SWATCH: Record<string, string> = {
  default: 'var(--site-text)',
  muted: 'var(--site-muted)',
  accent: 'var(--site-accent)',
};

export function PaletteControl({
  label,
  options,
  swatch,
  value,
  customValue,
  onToken,
  onCustom,
  onClear,
}: {
  label: string;
  options: readonly string[];
  swatch: Record<string, string>;
  value: string;
  customValue: string;
  onToken: (token: string) => void;
  onCustom: (hex: string) => void;
  onClear: () => void;
}): React.JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          title="Default"
          aria-pressed={!value && !customValue}
          className={`h-7 rounded-full border border-black/10 px-2 text-xs outline-none ${
            !value && !customValue ? 'ring-2 ring-[var(--pb-accent)] ring-offset-1' : ''
          }`}
        >
          Default
        </button>
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            title={tokenLabel(opt)}
            aria-label={tokenLabel(opt)}
            aria-pressed={value === opt}
            onClick={() => onToken(opt)}
            style={{ backgroundColor: swatch[opt] }}
            className={`h-7 w-7 rounded-full border border-black/15 outline-none ${
              value === opt ? 'ring-2 ring-[var(--pb-accent)] ring-offset-1' : ''
            }`}
          />
        ))}
        <input
          type="color"
          value={customValue || '#000000'}
          onChange={(e) => onCustom(e.target.value)}
          title="Custom colour"
          aria-label={`${label} custom colour`}
          className={`h-7 w-9 rounded border border-black/15 bg-transparent outline-none ${
            customValue ? 'ring-2 ring-[var(--pb-accent)] ring-offset-1' : ''
          }`}
        />
      </div>
    </div>
  );
}

/** A bounded 0-200 px number input for one side of a custom padding. */
export function PxInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium">{label}</label>
      <Input
        type="number"
        min={0}
        max={200}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 outline-none"
      />
    </div>
  );
}
