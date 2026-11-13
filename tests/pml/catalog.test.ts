import {
  PML_CATALOG_BY_NAME,
  PML_SECTIONS,
  PML_GROUP_ORDER,
  PML_GROUP_LABELS,
  groupOf,
  type PmlGroup,
} from '../../src/pml/catalog';
import { PRIMITIVES } from '../../src/pml/primitives';

describe('PML catalog grouping', () => {
  it('every menu section resolves to a known group', () => {
    for (const section of PML_SECTIONS) {
      expect(PML_GROUP_ORDER).toContain(groupOf(section));
    }
  });

  it('the group order covers the six groups exactly once', () => {
    const expected: PmlGroup[] = ['basic', 'layout', 'components', 'sections', 'portify-components', 'my-components'];
    expect([...PML_GROUP_ORDER].sort()).toEqual([...expected].sort());
    expect(new Set(PML_GROUP_ORDER).size).toBe(PML_GROUP_ORDER.length);
  });

  it('every group has a non-empty label', () => {
    for (const group of PML_GROUP_ORDER) {
      expect(PML_GROUP_LABELS[group]).toBeTruthy();
    }
  });

  it('curated sections default to the components group', () => {
    const hero = PML_SECTIONS.find((s) => s.name === 'hero');
    expect(hero).toBeDefined();
    expect(groupOf(hero!)).toBe('components');
  });

  it('inserts the hero as an editable primitive tree whose button is a stylable child', () => {
    const hero = PML_CATALOG_BY_NAME['hero'];
    expect(hero).toBeDefined();
    // A NEW hero drops a primitive box tree (not a {component:'hero'}), so every piece is selectable.
    expect(hero!.defaults.primitive).toBe('box');
    expect(hero!.defaults.component).toBeUndefined();

    const kinds = (hero!.defaults.children ?? []).map((c) => c.primitive);
    expect(kinds).toEqual(expect.arrayContaining(['heading', 'text', 'button']));
    // The CTA button carries its own style tokens, so it looks polished by default and is restylable.
    const button = (hero!.defaults.children ?? []).find((c) => c.primitive === 'button');
    expect(button?.props?.href).toBeTruthy();
    expect(button?.style).toBeDefined();
  });

  it('inserts the callout as its own container primitive with prose inside (S1-04)', () => {
    const callout = PML_CATALOG_BY_NAME['callout'];
    expect(callout!.defaults.primitive).toBe('callout');
    expect(callout!.defaults.component).toBeUndefined();
    expect(callout!.defaults.props?.tone).toBe('info');
    expect((callout!.defaults.children ?? [])[0]?.primitive).toBe('text');
  });

  it('offers the long-form vocabulary as primitives (S1-06..S1-10)', () => {
    expect(PML_CATALOG_BY_NAME['toc']!.defaults.primitive).toBe('toc');
    expect(PML_CATALOG_BY_NAME['sources']!.defaults.primitive).toBe('sources');
    expect(PML_CATALOG_BY_NAME['sources']!.itemComponent).toBe('source');
    expect(PML_CATALOG_BY_NAME['faq']!.defaults.primitive).toBe('faq');
    expect(PML_CATALOG_BY_NAME['faq']!.defaults.children?.[0]?.primitive).toBe('faq_item');
    // Anything that can be linked to offers a link name.
    for (const name of ['heading', 'box', 'grid', 'list', 'table', 'callout', 'faq', 'sources']) {
      expect(PML_CATALOG_BY_NAME[name]!.fields.some((f) => f.key === 'anchor' && f.kind === 'anchor')).toBe(true);
    }
  });

  it('inserts cta_banner / image_text / announcement as editable primitive trees', () => {
    for (const name of ['cta_banner', 'image_text', 'announcement']) {
      const def = PML_CATALOG_BY_NAME[name];
      expect(def).toBeDefined();
      // A NEW insert is a primitive tree (box or grid), not a {component:...}, and it has children.
      expect(def!.defaults.component).toBeUndefined();
      expect(['box', 'grid']).toContain(def!.defaults.primitive);
      expect((def!.defaults.children ?? []).length).toBeGreaterThan(0);
    }
  });

  it('ships polished defaults so a fresh primitive looks intentional, not broken', () => {
    // A button renders only with a label AND an href; the default carries both so it shows on add.
    const button = PML_CATALOG_BY_NAME['button'];
    expect(button!.defaults.props?.href).toBeTruthy();
    expect(button!.defaults.style).toBeDefined();

    // The table ships a hairline frame so it reads as a tidy table, not a bare grid of cells.
    const table = PML_CATALOG_BY_NAME['table'];
    expect(table!.defaults.style).toMatchObject({ border: 'hairline' });
  });

  it('every Basic/Layout entry drops a real leaf primitive, not a component', () => {
    const raw = PML_SECTIONS.filter((s) => groupOf(s) === 'basic' || groupOf(s) === 'layout');
    expect(raw.length).toBeGreaterThan(0);

    for (const entry of raw) {
      expect(entry.defaults.primitive).toBeDefined();
      expect(PRIMITIVES).toContain(entry.defaults.primitive);
      expect(entry.defaults.component).toBeUndefined();
    }
  });

  it('offers the raw leaf primitives under Basic', () => {
    const names = PML_SECTIONS.filter((s) => groupOf(s) === 'basic').map((s) => s.name);

    expect(names).toEqual(
      expect.arrayContaining(['text', 'heading', 'image', 'button', 'icon', 'list', 'divider', 'spacer']),
    );
  });

  it('offers a table in Layout but keeps row/cell out of the top-level menu', () => {
    const layout = PML_SECTIONS.filter((s) => groupOf(s) === 'layout').map((s) => s.name);
    expect(layout).toEqual(expect.arrayContaining(['box', 'grid', 'table']));
    // row/cell are structural children of a table, added by the rail, never dropped standalone.
    expect(layout).not.toContain('row');
    expect(layout).not.toContain('cell');
    expect(PML_CATALOG_BY_NAME['row']?.container).toBe(true);
    expect(PML_CATALOG_BY_NAME['cell']?.container).toBe(true);
  });

  it('offers header/nav/footer as self-contained semantic-element primitives under Sections', () => {
    const sections = PML_SECTIONS.filter((s) => groupOf(s) === 'sections').map((s) => s.name);
    expect(sections).toEqual(expect.arrayContaining(['header', 'nav', 'footer']));

    for (const name of ['header', 'nav', 'footer']) {
      // They are PRIMITIVES (not component references) and, crucially, SELF-CONTAINED: adding one
      // drops the BARE tag (no children in the source), and the server fills its body at build.
      expect(PML_CATALOG_BY_NAME[name]?.defaults.primitive).toBe(name);
      expect(PML_CATALOG_BY_NAME[name]?.defaults.component).toBeUndefined();
      expect(PML_CATALOG_BY_NAME[name]?.defaults.children).toBeUndefined();
      // So they are NOT authored as containers: the rail shows no empty Contents editor for them.
      expect(PML_CATALOG_BY_NAME[name]?.container).not.toBe(true);
      expect(PRIMITIVES).toContain(name);
    }
    // header + footer are singletons (one per page); the nav can repeat inside/outside a header.
    expect(PML_CATALOG_BY_NAME['header']?.singleton).toBe(true);
    expect(PML_CATALOG_BY_NAME['footer']?.singleton).toBe(true);
  });

  it('offers a custom form as an editable container and keeps field out of the top-level menu', () => {
    // The form is a container primitive with its own rail fields + a fields-editing contents editor.
    expect(PML_CATALOG_BY_NAME['form']?.defaults.primitive).toBe('form');
    expect(PML_CATALOG_BY_NAME['form']?.container).toBe(true);
    // The form is a Scale-plan component: it lives in the dedicated premium modal, not the standard one.
    expect(PML_CATALOG_BY_NAME['form']?.premium).toBe(true);
    // Its starter ships a consent notice and a couple of fields ready to edit.
    expect(PML_CATALOG_BY_NAME['form']?.defaults.props?.consent_notice).toBeTruthy();
    expect((PML_CATALOG_BY_NAME['form']?.defaults.children ?? []).length).toBeGreaterThan(0);

    const menuNames = PML_SECTIONS.map((s) => s.name);
    expect(menuNames).toContain('form');
    // A `field` is an item added inside a form, never offered standalone in the Add menu.
    expect(menuNames).not.toContain('field');
    expect(PML_CATALOG_BY_NAME['field']?.isItem).toBe(true);
    expect(PML_CATALOG_BY_NAME['field']?.defaults.primitive).toBe('field');
  });

  it('offers the three kinds of words and keeps the inline elements out of the Add menu', () => {
    // PML v3 L4: Text, Paragraph and Rich text are Basic elements; strong, link... live inside a
    // paragraph, so they are named in the catalog (the panel shows them) but never offered on their own.
    for (const name of ['text', 'p', 'rich_text']) expect(PML_SECTIONS.some((s) => s.name === name)).toBe(true);
    for (const name of ['strong', 'link', 'code', 'br']) {
      expect(PML_CATALOG_BY_NAME[name]).toBeDefined();
      expect(PML_SECTIONS.some((s) => s.name === name)).toBe(false);
    }
  });
});
