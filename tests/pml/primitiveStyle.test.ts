import { resolvePrimitiveStyle, gapClass, themeCornerClass } from '../../src/pml/primitiveStyle';

/** A style token resolves to a class only when it is a recognised value; garbage degrades to nothing. */
const classesOf = (style: Record<string, unknown>) => resolvePrimitiveStyle(style).className.split(/\s+/).filter(Boolean);

describe('resolvePrimitiveStyle - the expanded vocabulary', () => {
  it('maps placement tokens to flex utilities', () => {
    expect(classesOf({ justify: 'between' })).toContain('justify-between');
    expect(classesOf({ justify: 'evenly' })).toContain('justify-evenly');
    expect(classesOf({ align_items: 'end' })).toContain('items-end');
    expect(classesOf({ align_items: 'baseline' })).toContain('items-baseline');
    expect(classesOf({ self_align: 'end' })).toContain('self-end');
  });

  it('maps horizontal padding and outer margin', () => {
    expect(classesOf({ padding_x: 'normal' })).toEqual(expect.arrayContaining(['px-6', 'md:px-10']));
    expect(classesOf({ margin_y: 'lg' })).toContain('my-16');
  });

  it('reads per-side custom padding into inline style', () => {
    const { style } = resolvePrimitiveStyle({ padding: 'custom', padding_left_px: 24, padding_right_px: 40 });
    expect(style.paddingLeft).toBe('24px');
    expect(style.paddingRight).toBe('40px');
  });

  it('maps palette text colour to a site var and custom colour to inline style', () => {
    expect(classesOf({ text_color: 'accent' })).toContain('text-[var(--site-accent)]');
    expect(classesOf({ text_color: 'on-accent' })).toContain('text-[var(--site-accent-text)]');
    expect(classesOf({ text_color: 'success' })).toContain('text-emerald-600');
    const { style } = resolvePrimitiveStyle({ text_color_custom: '#aabbcc' });
    expect(style.color).toBe('#aabbcc');
  });

  it('lets the nearest paint decide the words\' colour unless the box names one', () => {
    // A mirrored "See all" outline button vanished on a navy band (2026-11-08).
    expect(resolvePrimitiveStyle({ background: 'custom', background_color: '#081234' }).style.color).toBe('#ffffff');
    // A white card inside that band reads dark again.
    expect(resolvePrimitiveStyle({ background: 'custom', background_color: '#ffffff' }).style.color).toBe('var(--site-text)');
    expect(resolvePrimitiveStyle({ background: 'gradient', background_gradient: 'ocean' }).style.color).toBe('var(--site-text)');
    // A box that names its colour keeps it.
    expect(resolvePrimitiveStyle({ background: 'custom', background_color: '#081234', text_color_custom: '#ffd700' }).style.color).toBe('#ffd700');
    expect(resolvePrimitiveStyle({ background: 'custom', background_color: '#081234', text_color: 'accent' }).style.color).toBeUndefined();
  });

  it('rejects a non-hex custom text colour (no inline colour emitted)', () => {
    const { style } = resolvePrimitiveStyle({ text_color_custom: 'red' });
    expect(style.color).toBeUndefined();
  });

  it('maps the typography axes', () => {
    expect(classesOf({ font_weight: 'bold' })).toContain('font-bold');
    expect(classesOf({ line_height: 'tight' })).toContain('leading-tight');
    expect(classesOf({ letter_spacing: 'wide' })).toContain('tracking-wide');
    expect(classesOf({ text_transform: 'uppercase' })).toContain('uppercase');
  });

  it('picks one of the site\'s two fonts inline (a class would lose to the site\'s heading rule)', () => {
    expect(resolvePrimitiveStyle({ font: 'body' }).style.fontFamily).toBe('var(--site-font-body)');
    expect(resolvePrimitiveStyle({ font: 'heading' }).style.fontFamily).toBe('var(--site-font-heading)');
    expect(resolvePrimitiveStyle({ font: 'comic-sans' }).style.fontFamily).toBeUndefined();
  });

  it('maps border, radius and shadow', () => {
    expect(classesOf({ border: 'hairline' })).toContain('border');
    expect(classesOf({ border: 'thick' })).toContain('border-4');
    expect(classesOf({ radius: 'full' })).toContain('rounded-full');
    expect(classesOf({ shadow: 'md' })).toContain('shadow-md');
    expect(classesOf({ min_height: 'lg' })).toContain('min-h-[640px]');
  });

  it('applies a border colour only when a border width is set', () => {
    expect(classesOf({ border: 'thin', border_color: 'accent' })).toContain('border-[var(--site-accent)]');
    // No visible border => no border colour class leaks out.
    expect(classesOf({ border_color: 'accent' })).not.toContain('border-[var(--site-accent)]');
    const withBorder = resolvePrimitiveStyle({ border: 'thin', border_color_custom: '#112233' });
    expect(withBorder.style.borderColor).toBe('#112233');
    const noBorder = resolvePrimitiveStyle({ border_color_custom: '#112233' });
    expect(noBorder.style.borderColor).toBeUndefined();
  });

  it('ignores unknown values for the new axes', () => {
    expect(classesOf({ justify: 'middle', radius: 'giant', font_weight: 'heavy', min_height: 'none' })).toEqual([]);
  });

  it('keeps the existing axes working', () => {
    expect(classesOf({ align: 'center' })).toContain('text-center');
    expect(classesOf({ width: 'wide' })).toEqual(expect.arrayContaining(['mx-auto', 'max-w-6xl']));
  });

  it('widens the gap scale to xs..xl', () => {
    expect(gapClass('xs')).toBe('gap-2');
    expect(gapClass('xl')).toBe('gap-16');
    expect(gapClass('md')).toBe('gap-6');
    expect(gapClass('bogus')).toBe('gap-6');
  });
});

describe('themeCornerClass (S2a-03: cards follow the site Corners choice)', () => {
  it('rounds a container that paints a panel and names no radius', () => {
    expect(themeCornerClass({ background: 'surface' })).toBe('rounded-[var(--site-radius)]');
    expect(themeCornerClass({ border: 'hairline' })).toBe('rounded-[var(--site-radius)]');
  });

  it('leaves an explicit radius, a transparent box and malformed input alone', () => {
    expect(themeCornerClass({ background: 'surface', radius: 'none' })).toBe('');
    expect(themeCornerClass({ background: 'none' })).toBe('');
    expect(themeCornerClass({ border: 'none' })).toBe('');
    expect(themeCornerClass(undefined)).toBe('');
    expect(themeCornerClass('surface')).toBe('');
  });
});
