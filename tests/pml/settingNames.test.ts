import { readSettingNames } from '../../src/pml/settingNames';

/** The partial editor's live "Settings:" hint (partials moved to `<props>`, 2026-11-11). */
describe('readSettingNames', () => {
  it('reads the top-level settings and skips a list’s own fields', () => {
    const pml = `<props>
  <prop name="heading" kind="text" label="Heading"/>
  <prop name="steps" kind="list" label="Steps">
    <prop name="title" kind="text" label="Title"/>
    <prop name="body" kind="long-text" label="Body"/>
  </prop>
  <prop name="dark" kind="yes-no" label="Dark"/>
</props>

<box><heading text={props.heading} level="2"/></box>`;

    expect(readSettingNames(pml)).toEqual(['heading', 'steps', 'dark']);
  });

  it('reads nothing without a block, and never a <prop> in the design', () => {
    expect(readSettingNames('<box><heading text="Hi" level="2"/></box>')).toEqual([]);
    expect(readSettingNames('<box/>\n<props><prop name="late" kind="text" label="Late"/></props>')).toEqual([]);
  });

  it('does not count the old param lines', () => {
    expect(readSettingNames('param heading\n\n<box/>')).toEqual([]);
  });
});
