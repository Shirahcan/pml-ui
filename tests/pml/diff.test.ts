import { lineDiff, type DiffRow } from '../../src/pml/diff';

/** Reconstruct `before` from the rows that belong to it (del + same, in order). */
const rebuildBefore = (rows: DiffRow[]): string =>
  rows.filter((r) => r.type !== 'add').map((r) => r.text).join('\n');

/** Reconstruct `after` from the rows that belong to it (add + same, in order). */
const rebuildAfter = (rows: DiffRow[]): string =>
  rows.filter((r) => r.type !== 'del').map((r) => r.text).join('\n');

const countOf = (rows: DiffRow[], type: DiffRow['type']): number =>
  rows.filter((r) => r.type === type).length;

describe('lineDiff', () => {
  it('marks identical inputs as all "same" with no add/del', () => {
    const src = 'line one\nline two\nline three';
    const rows = lineDiff(src, src);
    expect(countOf(rows, 'add')).toBe(0);
    expect(countOf(rows, 'del')).toBe(0);
    expect(rows.every((r) => r.type === 'same')).toBe(true);
    expect(rows.map((r) => r.oldLine)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.newLine)).toEqual([1, 2, 3]);
  });

  it('represents a pure append as a single add, the rest same', () => {
    const before = 'a\nb';
    const after = 'a\nb\nc';
    const rows = lineDiff(before, after);
    expect(countOf(rows, 'add')).toBe(1);
    expect(countOf(rows, 'del')).toBe(0);
    const added = rows.find((r) => r.type === 'add');
    expect(added?.text).toBe('c');
    expect(added?.newLine).toBe(3);
  });

  it('represents a pure deletion as a single del', () => {
    const before = 'a\nb\nc';
    const after = 'a\nc';
    const rows = lineDiff(before, after);
    expect(countOf(rows, 'del')).toBe(1);
    expect(countOf(rows, 'add')).toBe(0);
    const removed = rows.find((r) => r.type === 'del');
    expect(removed?.text).toBe('b');
    expect(removed?.oldLine).toBe(2);
  });

  it('represents a changed line as one del + one add', () => {
    const before = 'a\nOLD\nc';
    const after = 'a\nNEW\nc';
    const rows = lineDiff(before, after);
    expect(countOf(rows, 'del')).toBe(1);
    expect(countOf(rows, 'add')).toBe(1);
    expect(rows.find((r) => r.type === 'del')?.text).toBe('OLD');
    expect(rows.find((r) => r.type === 'add')?.text).toBe('NEW');
  });

  it('reconstructs both sides from the diff rows (the accept-is-trustworthy invariant)', () => {
    const before = '<hero headline="Old"/>\n<text value="one"/>\n<footer/>';
    const after = '<hero headline="New"/>\n<text value="one"/>\n<text value="two"/>\n<footer/>';
    const rows = lineDiff(before, after);
    expect(rebuildBefore(rows)).toBe(before);
    expect(rebuildAfter(rows)).toBe(after);
  });

  it('handles an empty before (all adds) and an empty after (all dels)', () => {
    const content = 'x\ny';
    const allAdds = lineDiff('', content);
    // '' splits to [''] so the first line matches the empty leading line; the real content is added.
    expect(rebuildAfter(allAdds)).toBe(content);
    expect(countOf(allAdds, 'add')).toBe(2);

    const allDels = lineDiff(content, '');
    expect(rebuildBefore(allDels)).toBe(content);
    expect(countOf(allDels, 'del')).toBe(2);
  });
});
