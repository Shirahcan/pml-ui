import { KNOWN_TAG_NAMES, attributesForTag, enumValuesFor } from '../../src/pml/pmlVocabulary';

describe('KNOWN_TAG_NAMES', () => {
  it('includes primitives (incl. script) and components, kebab-cased', () => {
    expect(KNOWN_TAG_NAMES).toContain('button');
    expect(KNOWN_TAG_NAMES).toContain('script'); // a primitive, not in the catalog
    expect(KNOWN_TAG_NAMES).toContain('hero');
    expect(KNOWN_TAG_NAMES).toContain('contact-form'); // snake contact_form -> kebab
    expect(KNOWN_TAG_NAMES).toContain('image-text');
  });
});

describe('attributesForTag', () => {
  it('includes the tag props + global style + reactive attrs (kebab)', () => {
    const btn = attributesForTag('button');
    expect(btn).toContain('label');
    expect(btn).toContain('href');
    expect(btn).toContain('variant');
    expect(btn).toContain('align'); // global style
    expect(btn).toContain('heading-size'); // global style, kebab-cased
    expect(btn).toContain('on-click'); // reactive
    expect(btn).toContain('if');
    expect(btn).toContain('each');
  });

  it('never invents an attribute for an unknown tag (globals only)', () => {
    const attrs = attributesForTag('not-a-real-tag');
    expect(attrs).toContain('align');
    expect(attrs).not.toContain('label');
  });
});

describe('enumValuesFor', () => {
  it('returns a prop enum, a style enum, and [] for a free-text value', () => {
    expect(enumValuesFor('button', 'variant')).toEqual(['primary', 'outline', 'soft', 'ghost', 'link']);
    expect(enumValuesFor('box', 'align')).toEqual(['left', 'center', 'right']); // global style token
    expect(enumValuesFor('button', 'href')).toEqual([]); // free text
    expect(enumValuesFor('grid', 'columns')).toEqual(['1', '2', '3', '4', '6', '12']);
  });

  it('is per-tag: a field name is free text, an icon name is the icon set', () => {
    expect(enumValuesFor('field', 'name')).toEqual([]);
    expect(enumValuesFor('icon', 'name')).toContain('star');
  });
});
