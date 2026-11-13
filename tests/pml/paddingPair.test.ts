import { designColumnClass } from '../../src/pml/sectionFrame';
import { joinPadding, paddingPair } from '../../src/pml/paddingPair';
import type { PmlNode } from '../../src/pml/primitives';

describe('padding: one size or two (owner 2026-11-12)', () => {
  it('reads a pair of known sizes and nothing else', () => {
    expect(paddingPair('none spacious')).toEqual(['none', 'spacious']);
    expect(paddingPair('  compact   normal ')).toEqual(['compact', 'normal']);
    expect(paddingPair('normal')).toBeNull();
    expect(paddingPair('custom none')).toBeNull();
    expect(paddingPair('none normal spacious')).toBeNull();
    expect(paddingPair(4)).toBeNull();
  });

  it('writes matching sides back as one size', () => {
    expect(joinPadding('normal', 'normal')).toBe('normal');
    expect(joinPadding('none', 'spacious')).toBe('none spacious');
  });
});

describe("a host's column is the site's standard page column (owner 2026-11-12)", () => {
  const box = (width?: string): PmlNode => ({ primitive: 'box', style: width ? { width } : {}, children: [] }) as PmlNode;

  it('is the header and footer column whatever widths the design sets', () => {
    // "The platform has a standard page width for most pages - that's supposed to be maintained"
    for (const nodes of [[box()], [box('narrow'), box('xwide')], [box('full')], []]) {
      expect(designColumnClass(nodes)).toBe('container mx-auto px-4');
    }
  });
});
