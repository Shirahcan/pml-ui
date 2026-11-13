import { elementAtCaret, lineOfElement } from '../../src/pml/caretElement';

const SOURCE = [
  '<section uid="sec1" padding="lg">',
  '  <heading text="Hi > there" level="1" uid="h1"/>',
  '  <!-- a note <box uid="ghost"> -->',
  '  <row uid="row1">',
  '    <text value="{a > b}" uid="t1"/>',
  '    <box>',
  '      <button label="Go" uid="b1"/>',
  '    </box>',
  '  </row>',
  '</section>',
  '<script>if (a < b) { x = 1 }</script>',
  '<text value="after" uid="t2"/>',
].join('\n');

const at = (needle: string, offset = 0): number => {
  const index = SOURCE.indexOf(needle);

  if (index === -1) throw new Error(`missing ${needle}`);

  return index + offset;
};

describe('elementAtCaret', () => {
  it('answers the element whose tag holds the caret', () => {
    expect(elementAtCaret(SOURCE, at('padding'))).toBe('sec1');
    expect(elementAtCaret(SOURCE, at('level="1"'))).toBe('h1');
  });

  it('reads past a > inside a quoted value or an expression', () => {
    expect(elementAtCaret(SOURCE, at('there'))).toBe('h1');
    expect(elementAtCaret(SOURCE, at('{a > b}', 4))).toBe('t1');
  });

  it('answers the enclosing element between tags, past a closed self-closing one', () => {
    expect(elementAtCaret(SOURCE, at('  <!--'))).toBe('sec1');
    expect(elementAtCaret(SOURCE, at('    <box>'))).toBe('row1');
  });

  it('ignores tags written inside a comment', () => {
    expect(elementAtCaret(SOURCE, at('ghost'))).toBe('sec1');
  });

  it('falls back to the nearest ancestor with an id', () => {
    expect(elementAtCaret(SOURCE, at('    <box>', 6))).toBe('row1');
  });

  it('gives a closing tag to the element it closes', () => {
    expect(elementAtCaret(SOURCE, at('</row>', 2))).toBe('row1');
  });

  it('skips a script body and goes on after it', () => {
    expect(elementAtCaret(SOURCE, at('a < b'))).toBeNull();
    expect(elementAtCaret(SOURCE, at('after'))).toBe('t2');
  });

  it('answers null before any element', () => {
    expect(elementAtCaret(SOURCE, 0)).toBeNull();
  });
});

describe('bare ids', () => {
  const BARE = '<box gap=sm uid=r2s380h6>\n  <heading text={title} level=2 uid=k3ysy4gz/>\n</box>';

  it('reads an unquoted id', () => {
    expect(elementAtCaret(BARE, BARE.indexOf('level'))).toBe('k3ysy4gz');
    expect(elementAtCaret(BARE, BARE.indexOf('gap'))).toBe('r2s380h6');
  });

  it('finds the line of an unquoted id, and not a longer id that starts the same', () => {
    expect(lineOfElement(BARE, 'k3ysy4gz')).toEqual({ line: 2, col: 3 });
    expect(lineOfElement(BARE, 'k3ysy')).toBeNull();
  });
});

describe('lineOfElement', () => {
  it('finds the line and column of an element tag', () => {
    expect(lineOfElement(SOURCE, 'b1')).toEqual({ line: 7, col: 7 });
    expect(lineOfElement(SOURCE, 'sec1')).toEqual({ line: 1, col: 1 });
  });

  it('answers null for an id that is not there', () => {
    expect(lineOfElement(SOURCE, 'nope')).toBeNull();
  });
});
