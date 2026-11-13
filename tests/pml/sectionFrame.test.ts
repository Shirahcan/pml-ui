import { DEFAULT_FRAME_WIDTH, FRAME_GUTTER, FRAME_MAX_WIDTH, SITE_COLUMN, designColumnClass, splitSectionFrame } from '../../src/pml/sectionFrame';
import type { PmlNode } from '../../src/pml/primitives';

describe('a section that draws its own edge', () => {
  it('is a card in the column, keeping its border, padding and background on itself', () => {
    const parts = splitSectionFrame({
      primitive: 'box',
      style: { border: 'hairline', border_color: 'muted', padding: 'compact', padding_x: 'compact', background: 'surface', width: 'normal' },
    });

    expect(parts.band).toEqual({ padding: 'compact' });
    expect(parts.width).toBe('normal');
    expect(parts.node.style).toEqual({ border: 'hairline', border_color: 'muted', padding: 'compact', padding_x: 'compact', background: 'surface' });
  });

  it('treats a shadow or a corner the same way, and no border as no edge', () => {
    expect(splitSectionFrame({ primitive: 'grid', style: { shadow: 'sm' } }).node.style).toEqual({ shadow: 'sm' });
    expect(splitSectionFrame({ primitive: 'box', style: { radius: 'lg' } }).node.style).toEqual({ radius: 'lg' });
    expect(splitSectionFrame({ primitive: 'box', style: { border: 'none', background: 'surface' } }).band.background).toBe('surface');
  });

  it('keeps a plain band and a landmark full width', () => {
    expect(splitSectionFrame({ primitive: 'box', style: { background: 'accent' } }).band.background).toBe('accent');
    expect(splitSectionFrame({ primitive: 'header', style: { border: 'hairline' } }).band.border).toBe('hairline');
    expect(splitSectionFrame({ primitive: 'footer', style: { shadow: 'sm' } }).band.shadow).toBe('sm');
  });
});

describe('splitSectionFrame (S2a-01: section band + centred container)', () => {
  it('frames a bare heading with default padding and the page width', () => {
    const parts = splitSectionFrame({ primitive: 'heading', props: { text: 'Hello', level: 2 } });

    expect(parts.framed).toBe(true);
    expect(parts.band).toEqual({ padding: 'compact' });
    expect(parts.width).toBe('page');
    expect(parts.defaultGutter).toBe(true);
  });

  it('gives every kind of block the site standard page width when it sets none (owner 2026-11-12)', () => {
    // "everything block element should feed off this standard width (default) with the ability to be customized"
    for (const primitive of ['text', 'heading', 'list', 'grid', 'box', 'image', 'growth_form', 'header', 'footer']) {
      expect(splitSectionFrame({ primitive, props: {} } as PmlNode).width).toBe(DEFAULT_FRAME_WIDTH);
    }
    expect(DEFAULT_FRAME_WIDTH).toBe('page');
    expect(splitSectionFrame({ primitive: 'text', props: {}, style: { width: 'narrow' } }).width).toBe('narrow');
  });

  it('draws the page width in the site header column, and a host frames a design in it whatever the design', () => {
    expect(SITE_COLUMN).toBe(`${FRAME_MAX_WIDTH.page} mx-auto ${FRAME_GUTTER}`);
    expect(SITE_COLUMN).toBe('container mx-auto px-4');
    expect(designColumnClass([{ primitive: 'box', style: { width: 'narrow' }, children: [] }])).toBe(SITE_COLUMN);
    expect(designColumnClass([])).toBe(SITE_COLUMN);
  });

  it('puts each style key on the right layer', () => {
    const node: PmlNode = {
      primitive: 'box',
      style: {
        background: 'accent',
        padding: 'spacious',
        width: 'wide',
        padding_x: 'normal',
        align: 'center',
        font_weight: 'bold',
        motion: 'reveal-up',
      },
      children: [],
    };

    const parts = splitSectionFrame(node);

    expect(parts.band).toEqual({ background: 'accent', padding: 'spacious' });
    expect(parts.container).toEqual({ padding_x: 'normal' });
    expect(parts.width).toBe('wide');
    expect(parts.defaultGutter).toBe(false);
    expect(parts.align).toBe('center');
    expect(parts.node.style).toEqual({ align: 'center', font_weight: 'bold', motion: 'reveal-up' });
  });

  it("keeps a single element's own styling on the element (a button's pill is the button's)", () => {
    const parts = splitSectionFrame({
      primitive: 'button',
      props: { label: 'Start', href: '#' },
      style: { radius: 'full', shadow: 'md', text_color: 'accent', padding: 'normal', width: 'narrow', self_align: 'center' },
    });

    expect(parts.band).toEqual({ padding: 'compact' });
    expect(parts.width).toBe('narrow');
    expect(parts.node.style).toEqual({ radius: 'full', shadow: 'md', text_color: 'accent', padding: 'normal', self_align: 'center' });
  });

  it('splits a custom padding: top and bottom on the band, left and right on the container', () => {
    const parts = splitSectionFrame({
      primitive: 'box',
      style: { padding: 'custom', padding_top_px: 40, padding_bottom_px: 20, padding_left_px: 12, padding_right_px: 12 },
      children: [],
    });

    expect(parts.band).toEqual({ padding: 'custom', padding_top_px: 40, padding_bottom_px: 20 });
    expect(parts.container).toEqual({ padding: 'custom', padding_left_px: 12, padding_right_px: 12 });
    expect(parts.defaultGutter).toBe(false);
  });

  it('leaves self-contained modules, scripts and comments unframed', () => {
    expect(splitSectionFrame({ primitive: 'packages', props: {} }).framed).toBe(false);
    expect(splitSectionFrame({ primitive: 'script', props: {} }).framed).toBe(false);
    expect(splitSectionFrame({ comment: 'a note' } as unknown as PmlNode).framed).toBe(false);
  });

  it('frames credentials, which has no container of its own', () => {
    expect(splitSectionFrame({ primitive: 'credentials', props: {} }).framed).toBe(true);
  });

  it('makes the band the sticky element and takes sticky off the node', () => {
    const parts = splitSectionFrame({ primitive: 'header', style: { motion: 'sticky', background: 'surface' }, children: [] });

    expect(parts.framed).toBe(true);
    expect(parts.sticky).toBe(true);
    expect(parts.band).toEqual({ background: 'surface', padding: 'compact' });
    expect(parts.node.style).toEqual({});
  });

  it('falls back to the default width for an unknown width token', () => {
    expect(splitSectionFrame({ primitive: 'image', style: { width: 'enormous' }, props: {} }).width).toBe('page');
  });
});
