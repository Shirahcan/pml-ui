'use client';

import React, { useId, useState } from 'react';

import { PADDING_SIZES, joinPadding, paddingPair, type PaddingSize } from '../../pml/paddingPair';
import { tokenLabel } from '../../pml/styleLabels';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useOwnVars } from '../ui/theme';

/**
 * One padding axis in the style panel: one size for both sides, or "Set each side" for two. Two sides that match are
 * written back as one size, so the simple form stays the common one. `custom` (pixel sides) is a single value with
 * its own inputs, so the switch is not offered while it is chosen.
 */
export function PaddingField({
  label,
  sideLabels,
  value,
  options,
  onChange,
}: {
  label: string;
  /** What each side is called, in the value's order: top then bottom, or left then right. */
  sideLabels: [string, string];
  value: string;
  /** The single sizes offered (may include `custom` for the base top-and-bottom padding). */
  options: readonly string[];
  onChange: (value: string) => void;
}): React.JSX.Element {
  const pair = paddingPair(value);
  // Open while the person is choosing sides, or whenever the stored value already is a pair.
  const [eachSide, setEachSide] = useState(false);
  const split = pair !== null || eachSide;
  const single = (PADDING_SIZES as readonly string[]).includes(value) ? (value as PaddingSize) : 'normal';
  const sides: [PaddingSize, PaddingSize] = pair ?? [single, single];
  const id = useId();
  const vars = useOwnVars();

  const toggle = (on: boolean) => {
    setEachSide(on);
    // Turning it off keeps the first side for both, so nothing disappears without a trace.
    if (!on && pair) onChange(pair[0]);
  };

  return (
    <div className="space-y-2" style={vars}>
      {split ? (
        <div>
          <span className="mb-1 block text-sm font-medium">{label}</span>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map((i) => (
              <div key={sideLabels[i]}>
                <span className="mb-1 block text-xs text-[var(--pb-muted)]">{sideLabels[i]}</span>
                <Select
                  value={sides[i]}
                  onValueChange={(v) => onChange(i === 0 ? joinPadding(v as PaddingSize, sides[1]) : joinPadding(sides[0], v as PaddingSize))}
                >
                  <SelectTrigger aria-label={`${label}: ${sideLabels[i]}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PADDING_SIZES.map((size) => (
                      <SelectItem key={size} value={size}>
                        {tokenLabel(size)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <span className="mb-1 block text-sm font-medium">{label}</span>
          {/* "Default" clears the key, as every other style select does. */}
          <Select value={value || '__default'} onValueChange={(v) => onChange(v === '__default' ? '' : v)}>
            <SelectTrigger aria-label={label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__default">Default</SelectItem>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {tokenLabel(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value !== 'custom' ? (
        <label htmlFor={id} className="flex items-center gap-2 text-xs text-[var(--pb-muted)]">
          <input id={id} type="checkbox" className="accent-[var(--pb-accent)] outline-none" checked={split} onChange={(e) => toggle(e.target.checked)} />
          Set each side
        </label>
      ) : null}
    </div>
  );
}
