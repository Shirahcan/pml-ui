import { STYLE_PRESETS, applyPreset } from '../../src/pml/stylePresets';
import { STYLE_TOKENS } from '../../src/pml/primitives';

describe('style presets', () => {
  it('every preset token is a whitelisted STYLE_TOKENS value', () => {
    const tokens = STYLE_TOKENS as Record<string, readonly string[]>;

    for (const preset of STYLE_PRESETS) {
      for (const [key, value] of Object.entries(preset.tokens)) {
        expect(tokens[key]).toBeDefined();
        expect(tokens[key]).toContain(value);
      }
    }
  });

  it('applying a preset sets exactly its keys and clears none of the others', () => {
    const existing = { align: 'left', motion: 'reveal-up' };
    const banner = STYLE_PRESETS.find((p) => p.name === 'banner')!;

    const next = applyPreset(existing, banner);

    // Unrelated existing tokens survive.
    expect(next.motion).toBe('reveal-up');
    // The preset's tokens win where they overlap and are added where they are new.
    expect(next.align).toBe('center');
    expect(next.background).toBe('accent');
    expect(next.padding).toBe('spacious');
    // Exactly the union of keys, nothing dropped.
    expect(new Set(Object.keys(next))).toEqual(new Set(['align', 'motion', 'background', 'padding']));
  });

  it('does not mutate the input style', () => {
    const existing = { align: 'left' };
    applyPreset(existing, STYLE_PRESETS[0]);
    expect(existing).toEqual({ align: 'left' });
  });
});
