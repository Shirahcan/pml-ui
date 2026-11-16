'use client';

import React, { useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';

import { applyPreset, CONTAINER_PRIMITIVES, DISPLAY_FOR_CONTAINER, DISPLAY_FOR_LEAF, STYLE_PRESETS, STYLE_TOKENS, type PmlNode } from '../../language';
import { Button, Input } from '../ui/controls';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/overlays';
import { BORDER_SWATCH, Group, PaletteControl, PxInput, ResponsiveGroup, StyleSelect, TEXT_SWATCH } from './styleControls';
import { PaddingField } from './PaddingField';

/** What the host adds to the Style modal. */
export interface StyleModalExtras {
  /** The host's own controls at the top of the modal (Portify: a Studio component's per-page style choices). */
  renderBindings?: (args: { label: string; style: Record<string, unknown>; onChange: (updates: Record<string, unknown>) => void }) => ReactNode;
  /** Said where premium styling (motion, gradient and image backgrounds) is locked, in the host's plan words. */
  lockedNote?: ReactNode;
}

/**
 * The styling modal (shared program E4a4e, from Portify): a roomy, grouped home for an element's `style` tokens,
 * opened from the settings rail. Its body scrolls between a pinned header and footer, so every group and Done stay
 * reachable on a short screen (the modal rule, built into DialogBody).
 */
function StyleModal({
  node,
  onChange,
  canAuthorPml,
  open,
  onOpenChange,
  renderBindings,
  lockedNote,
}: {
  node: PmlNode;
  onChange: (next: PmlNode) => void;
  canAuthorPml?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & StyleModalExtras): React.JSX.Element {
  const style = (node.style ?? {}) as Record<string, unknown>;
  // ⚠ The parser reads a number as a number (`carousel-per-view=2` is 2): show it as its token.
  const val = (key: string): string => (typeof style[key] === 'string' ? (style[key] as string) : typeof style[key] === 'number' ? String(style[key]) : '');
  const container = (CONTAINER_PRIMITIVES as readonly string[]).includes(String(node.primitive ?? ''));
  // Per-side paddings are stored as INTEGERS (the backend requires is_int), so they have their own
  // reader/writer separate from the token axes.
  const valNum = (key: string): string => (typeof style[key] === 'number' ? String(style[key]) : '');

  const set = (updates: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...style };

    for (const [key, value] of Object.entries(updates)) {
      if (value === '' || value === undefined || value === null) delete next[key];
      else next[key] = value;
    }

    onChange({ ...node, style: next });
  };

  const setPx = (key: string, raw: string) => {
    if (raw.trim() === '') {
      set({ [key]: '' });

      return;
    }

    const clamped = Math.min(Math.max(Math.round(Number(raw) || 0), 0), 200);
    onChange({ ...node, style: { ...style, [key]: clamped } });
  };

  const background = val('background');
  // Without the plan's premium styling, the simple backgrounds only; gradient/image stay premium (a premium value
  // already set, by the assistant say, stays in the tree and renders; it is just not editable here without the plan).
  const backgroundOptions = canAuthorPml
    ? STYLE_TOKENS.background
    : STYLE_TOKENS.background.filter((b) => b !== 'gradient' && b !== 'image');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Style</DialogTitle>
          <DialogDescription>
            Fine-tune this element&rsquo;s appearance. Every option is a safe preset - no raw CSS.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* The host's own controls first (Portify: while designing a Studio component, the styles each page may choose). */}
          {renderBindings?.({ label: String(node.primitive ?? 'element').replace(/_/g, ' '), style, onChange: set })}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--pb-muted)]">Presets</p>
            <div className="flex flex-wrap gap-2">
              {STYLE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  title={preset.description}
                  onClick={() => onChange({ ...node, style: applyPreset(style, preset) })}
                  className="whitespace-nowrap rounded-full border border-white/25 px-3 py-1 text-xs outline-none hover:bg-black/5"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <Group title="Placement">
            <StyleSelect label="Width" value={val('width')} options={STYLE_TOKENS.width} defaultLabel="Page width (standard)" onChange={(v) => set({ width: v })} />
            <StyleSelect label="Distribute (justify)" value={val('justify')} options={STYLE_TOKENS.justify} onChange={(v) => set({ justify: v })} />
            <StyleSelect label="Align items" value={val('align_items')} options={STYLE_TOKENS.align_items} onChange={(v) => set({ align_items: v })} />
            <StyleSelect label="Align self" value={val('self_align')} options={STYLE_TOKENS.self_align} onChange={(v) => set({ self_align: v })} />
            <StyleSelect label="Hide on" value={val('hide')} options={STYLE_TOKENS.hide} onChange={(v) => set({ hide: v })} />
          </Group>

          <Group title="Display">
            <StyleSelect
              label="Display"
              value={val('display')}
              options={container ? DISPLAY_FOR_CONTAINER : DISPLAY_FOR_LEAF}
              onChange={(v) => set({ display: v })}
            />
            {val('display') === 'carousel' ? (
              <>
                <StyleSelect label="Items in view" value={val('carousel_per_view')} options={STYLE_TOKENS.carousel_per_view} onChange={(v) => set({ carousel_per_view: v })} />
                <StyleSelect label="Moves on its own" value={val('carousel_motion')} options={STYLE_TOKENS.carousel_motion} onChange={(v) => set({ carousel_motion: v })} />
                <StyleSelect label="Speed" value={val('carousel_speed')} options={STYLE_TOKENS.carousel_speed} onChange={(v) => set({ carousel_speed: v })} />
                <StyleSelect label="Controls" value={val('carousel_controls')} options={STYLE_TOKENS.carousel_controls} onChange={(v) => set({ carousel_controls: v })} />
                <StyleSelect label="Back to the start after the last" value={val('carousel_loop')} options={STYLE_TOKENS.carousel_loop} onChange={(v) => set({ carousel_loop: v })} />
              </>
            ) : null}
          </Group>

          <Group title="Position">
            <StyleSelect label="As the page scrolls" value={val('placement')} options={STYLE_TOKENS.placement} onChange={(v) => set({ placement: v })} />
            {val('placement') === 'sticky' || val('placement') === 'fixed' ? (
              <StyleSelect label="Pinned to" value={val('placement_edge')} options={STYLE_TOKENS.placement_edge} onChange={(v) => set({ placement_edge: v })} />
            ) : null}
            <StyleSelect label="Stacking" value={val('stacking')} options={STYLE_TOKENS.stacking} onChange={(v) => set({ stacking: v })} />
            <StyleSelect label="Overflow" value={val('overflow')} options={STYLE_TOKENS.overflow} onChange={(v) => set({ overflow: v })} />
          </Group>

          <Group title="Spacing">
            <PaddingField label="Top and bottom padding" sideLabels={['Top', 'Bottom']} value={val('padding')} options={STYLE_TOKENS.padding} onChange={(v) => set({ padding: v })} />

            {val('padding') === 'custom' ? (
              <div className="grid grid-cols-2 gap-2">
                <PxInput label="Top (px)" value={valNum('padding_top_px')} onChange={(v) => setPx('padding_top_px', v)} />
                <PxInput label="Bottom (px)" value={valNum('padding_bottom_px')} onChange={(v) => setPx('padding_bottom_px', v)} />
                <PxInput label="Left (px)" value={valNum('padding_left_px')} onChange={(v) => setPx('padding_left_px', v)} />
                <PxInput label="Right (px)" value={valNum('padding_right_px')} onChange={(v) => setPx('padding_right_px', v)} />
              </div>
            ) : null}

            <PaddingField label="Left and right padding" sideLabels={['Left', 'Right']} value={val('padding_x')} options={STYLE_TOKENS.padding_x} onChange={(v) => set({ padding_x: v })} />
            <StyleSelect label="Outer margin" value={val('margin_y')} options={STYLE_TOKENS.margin_y} onChange={(v) => set({ margin_y: v })} />
          </Group>

          <Group title="Typography">
            <StyleSelect label="Text alignment" value={val('align')} options={STYLE_TOKENS.align} onChange={(v) => set({ align: v })} />
            <StyleSelect label="Heading size" value={val('heading_size')} options={STYLE_TOKENS.heading_size} onChange={(v) => set({ heading_size: v })} />
            <StyleSelect label="Body size" value={val('body_size')} options={STYLE_TOKENS.body_size} onChange={(v) => set({ body_size: v })} />
            <StyleSelect label="Font" value={val('font')} options={STYLE_TOKENS.font} onChange={(v) => set({ font: v })} />
            <StyleSelect label="Weight" value={val('font_weight')} options={STYLE_TOKENS.font_weight} onChange={(v) => set({ font_weight: v })} />
            <StyleSelect label="Line height" value={val('line_height')} options={STYLE_TOKENS.line_height} onChange={(v) => set({ line_height: v })} />
            <StyleSelect label="Letter spacing" value={val('letter_spacing')} options={STYLE_TOKENS.letter_spacing} onChange={(v) => set({ letter_spacing: v })} />
            <StyleSelect label="Transform" value={val('text_transform')} options={STYLE_TOKENS.text_transform} onChange={(v) => set({ text_transform: v })} />
          </Group>

          <Group title="Colour">
            <StyleSelect
              label="Background"
              value={background}
              options={backgroundOptions}
              onChange={(v) =>
                // Switching background clears every other background's sub-keys.
                set({ background: v, background_gradient: '', background_image_url: '', background_overlay: '', background_color: '' })
              }
            />

            {background === 'gradient' ? (
              <StyleSelect
                label="Gradient"
                value={val('background_gradient')}
                options={STYLE_TOKENS.background_gradient}
                onChange={(v) => set({ background_gradient: v })}
              />
            ) : null}

            {background === 'image' ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">Image URL</label>
                  <Input
                    type="text"
                    inputMode="url"
                    placeholder="https://"
                    value={val('background_image_url')}
                    onChange={(e) => set({ background_image_url: e.target.value })}
                    className="px-3 py-2 outline-none"
                  />
                </div>
                <StyleSelect
                  label="Overlay (keeps text legible)"
                  value={val('background_overlay')}
                  options={STYLE_TOKENS.background_overlay}
                  onChange={(v) => set({ background_overlay: v })}
                />
              </>
            ) : null}

            {background === 'custom' ? (
              <div>
                <label className="mb-1 block text-sm font-medium">Background colour</label>
                <input
                  type="color"
                  value={val('background_color') || '#ffffff'}
                  onChange={(e) => set({ background_color: e.target.value })}
                  className="h-9 w-full rounded-lg border border-input bg-transparent outline-none"
                />
              </div>
            ) : null}

            <PaletteControl
              label="Text colour"
              options={STYLE_TOKENS.text_color}
              swatch={TEXT_SWATCH}
              value={val('text_color')}
              customValue={val('text_color_custom')}
              onToken={(t) => set({ text_color: t, text_color_custom: '' })}
              onCustom={(hex) => set({ text_color_custom: hex, text_color: '' })}
              onClear={() => set({ text_color: '', text_color_custom: '' })}
            />
          </Group>

          <Group title="Border & effects">
            <StyleSelect label="Border" value={val('border')} options={STYLE_TOKENS.border} onChange={(v) => set({ border: v })} />

            {val('border') && val('border') !== 'none' ? (
              <PaletteControl
                label="Border colour"
                options={STYLE_TOKENS.border_color}
                swatch={BORDER_SWATCH}
                value={val('border_color')}
                customValue={val('border_color_custom')}
                onToken={(t) => set({ border_color: t, border_color_custom: '' })}
                onCustom={(hex) => set({ border_color_custom: hex, border_color: '' })}
                onClear={() => set({ border_color: '', border_color_custom: '' })}
              />
            ) : null}

            <StyleSelect label="Corners (radius)" value={val('radius')} options={STYLE_TOKENS.radius} onChange={(v) => set({ radius: v })} />
            <StyleSelect label="Shadow" value={val('shadow')} options={STYLE_TOKENS.shadow} onChange={(v) => set({ shadow: v })} />
            <StyleSelect label="Minimum height" value={val('min_height')} options={STYLE_TOKENS.min_height} onChange={(v) => set({ min_height: v })} />
          </Group>

          <ResponsiveGroup style={style} set={set} />

          <Group title="Motion">
            {canAuthorPml ? (
              <StyleSelect label="Motion" value={val('motion')} options={STYLE_TOKENS.motion} onChange={(v) => set({ motion: v })} />
            ) : (
              <p className="rounded-lg border border-dashed border-white/25 px-3 py-2 text-xs text-[var(--pb-muted)]">
                {lockedNote ?? 'Motion and premium backgrounds are not included in your plan.'}
              </p>
            )}
          </Group>
        </DialogBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The rail trigger: a full-width "Style" button that opens the modal, with a small count of how many
 * style tokens are set so the consultant sees at a glance that an element is customised.
 */
export function StyleModalTrigger({
  node,
  onChange,
  canAuthorPml,
  renderBindings,
  lockedNote,
}: {
  node: PmlNode;
  onChange: (next: PmlNode) => void;
  canAuthorPml?: boolean;
} & StyleModalExtras): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const activeCount = Object.keys((node.style ?? {}) as Record<string, unknown>).length;

  return (
    <div className="border-t border-white/10 pt-4">
      <Button variant="outline" onClick={() => setOpen(true)} className="w-full justify-between">
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Style
        </span>
        {activeCount > 0 ? <span className="text-xs text-[var(--pb-muted)]">{activeCount} applied</span> : null}
      </Button>

      <StyleModal node={node} onChange={onChange} canAuthorPml={canAuthorPml} open={open} onOpenChange={setOpen} renderBindings={renderBindings} lockedNote={lockedNote} />
    </div>
  );
}
