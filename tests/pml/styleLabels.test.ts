import { tokenLabel } from '../../src/pml/styleLabels';

describe('tokenLabel', () => {
  it('humanizes a plain token to sentence case', () => {
    expect(tokenLabel('narrow')).toBe('Narrow');
    expect(tokenLabel('semibold')).toBe('Semibold');
    expect(tokenLabel('row')).toBe('Row');
  });

  it('turns hyphen/underscore tokens into spaced sentence case', () => {
    expect(tokenLabel('on-accent')).toBe('On accent');
    expect(tokenLabel('reveal-up')).toBe('Reveal up');
    expect(tokenLabel('parallax-soft')).toBe('Parallax soft');
  });

  it('uses friendly overrides for the placement distribution tokens', () => {
    expect(tokenLabel('between')).toBe('Space between');
    expect(tokenLabel('around')).toBe('Space around');
    expect(tokenLabel('evenly')).toBe('Space evenly');
    expect(tokenLabel('space-between')).toBe('Space between');
  });

  it('uses friendly size names for the shared size scale', () => {
    expect(tokenLabel('xs')).toBe('Extra small');
    expect(tokenLabel('sm')).toBe('Small');
    expect(tokenLabel('md')).toBe('Medium');
    expect(tokenLabel('lg')).toBe('Large');
    expect(tokenLabel('xl')).toBe('Extra large');
  });

  it('leaves numeric tokens untouched', () => {
    expect(tokenLabel('1')).toBe('1');
    expect(tokenLabel('4')).toBe('4');
  });
});
