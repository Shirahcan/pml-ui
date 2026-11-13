import { hideClass, resolvePrimitiveStyle, withResponsive } from '../../src/pml/primitiveStyle';
import { splitSectionFrame } from '../../src/pml/sectionFrame';

const classes = (style: Record<string, unknown>) => resolvePrimitiveStyle(style).className.split(/\s+/).filter(Boolean);

describe('responsive overrides (PML v2 S2-01/02)', () => {
  it('replaces the base value from tablets up instead of competing with it', () => {
    const c = classes({ padding: 'compact', 'md:padding': 'spacious' });

    expect(c).toContain('py-3');
    expect(c).toContain('md:py-16');
    expect(c).not.toContain('md:py-4');
  });

  it('adds a laptop override on top of a tablet one', () => {
    const c = classes({ align: 'center', 'md:align': 'left', 'lg:align': 'right' });

    expect(c).toEqual(expect.arrayContaining(['text-center', 'md:text-left', 'lg:text-right']));
  });

  it('keeps the halved spacing scale (owner 2026-11-12: normal padding read as far too spacious)', () => {
    expect(classes({ padding: 'normal' })).toEqual(expect.arrayContaining(['py-6', 'md:py-8']));
    expect(classes({ padding: 'compact' })).toEqual(expect.arrayContaining(['py-3', 'md:py-4']));
    expect(classes({ padding: 'spacious' })).toEqual(expect.arrayContaining(['py-12', 'md:py-16']));
    expect(classes({ padding: 'normal' })).not.toContain('md:py-16');
  });

  it('takes one size per side when a padding is a pair (owner 2026-11-12)', () => {
    expect(classes({ padding: 'none spacious' })).toEqual(expect.arrayContaining(['pt-0', 'pb-12', 'md:pb-16']));
    expect(classes({ padding: 'none spacious' }).some((t) => t.startsWith('py-'))).toBe(false);
    expect(classes({ padding_x: 'compact normal' })).toEqual(expect.arrayContaining(['pl-4', 'md:pl-6', 'pr-6', 'md:pr-10']));

    // A pair override from tablets up replaces the base's own tablet step, and a single size replaces a pair's.
    const c = classes({ padding: 'normal', 'md:padding': 'spacious none' });
    expect(c).toEqual(expect.arrayContaining(['py-6', 'md:pt-16', 'md:pb-0']));
    expect(c).not.toContain('md:py-8');
    const d = classes({ padding: 'compact spacious', 'lg:padding': 'normal' });
    expect(d).toEqual(expect.arrayContaining(['pt-3', 'md:pt-4', 'pb-12', 'md:pb-16', 'lg:py-8']));
  });

  it('ignores a pair it cannot read', () => {
    expect(classes({ padding: 'none huge' }).some((t) => /^(p[tby]|md:p[tby])-/.test(t))).toBe(false);
    expect(classes({ padding: 'none normal spacious' }).some((t) => /^p[tby]-/.test(t))).toBe(false);
  });

  it('works with no base value, and ignores an unknown value', () => {
    expect(classes({ 'md:width': 'narrow' })).toEqual(expect.arrayContaining(['md:mx-auto', 'md:max-w-2xl']));
    expect(classes({ 'md:padding': 'huge' }).some((t) => t.startsWith('md:py'))).toBe(false);
  });

  it('applies heading and body size overrides through the renderer scale', () => {
    const base = 'leading-tight text-[length:calc(1.5rem*var(--site-type-scale,1))] md:text-[length:calc(1.875rem*var(--site-type-scale,1))]';
    expect(withResponsive(base, { heading_size: 'md', 'lg:heading_size': 'xl' }, ['heading_size'])).toBe(`${base} lg:text-[length:calc(3.75rem*var(--site-type-scale,1))]`);
  });
});

describe('visibility (S2-03)', () => {
  it('hides per device with literal classes', () => {
    expect(hideClass({ hide: 'mobile' })).toBe('max-md:hidden');
    expect(hideClass({ hide: 'tablet' })).toBe('md:max-lg:hidden');
    expect(hideClass({ hide: 'desktop' })).toBe('lg:hidden');
    expect(hideClass({ hide: 'none' })).toBe('');
  });

  it('a hidden top-level element takes its whole band with it', () => {
    const parts = splitSectionFrame({ primitive: 'heading', props: { text: 'x', level: 2 }, style: { hide: 'mobile', 'md:padding': 'spacious' } });

    expect(parts.band.hide).toBe('mobile');
    expect(parts.node.style).not.toHaveProperty('hide');
  });

  it('a container sends md:padding to the band and md:width to the container', () => {
    const parts = splitSectionFrame({ primitive: 'box', props: {}, style: { 'md:padding': 'spacious', 'md:width': 'narrow' }, children: [] });

    expect(parts.band['md:padding']).toBe('spacious');
    expect(parts.container['md:width']).toBe('narrow');
  });
});

import { panelGutterClass } from '../../src/pml/primitiveStyle';

describe('panel gutters (S2-11)', () => {
  it('gives a panel default side padding unless the author set one', () => {
    expect(panelGutterClass({ background: 'surface' })).toBe('px-5 md:px-8');
    expect(panelGutterClass({ border: 'hairline' })).toBe('px-5 md:px-8');
    expect(panelGutterClass({ background: 'surface', padding_x: 'none' })).toBe('');
    expect(panelGutterClass({ background: 'none' })).toBe('');
  });
});
