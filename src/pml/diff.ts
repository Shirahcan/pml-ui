/**
 * A pure, dependency-free line diff powering the Code-view "accept/discard" preview.
 *
 * It compares two whole PML/PSL buffers line-by-line and returns a flat list of rows describing the
 * minimal change: `del` rows appear only in `before`, `add` rows only in `after`, and `same` rows in
 * both. The classic O(n*m) LCS is more than enough here (a page's source is small), and keeping it
 * dependency-free means the diff renders identically on the server-less client with no bundle cost.
 *
 * Invariants the tests pin down:
 *  - The `del` + `same` rows, in order, reconstruct `before` exactly.
 *  - The `add` + `same` rows, in order, reconstruct `after` exactly.
 * Those two are what make an "Accept" trustworthy: what the consultant sees removed/added IS the
 * whole of the change.
 */

export type DiffRow = {
  /** `same` = unchanged line, `add` = only in the proposal, `del` = only in the current buffer. */
  type: 'same' | 'add' | 'del';
  text: string;
  /** 1-based line number in `before` (null for an added line). */
  oldLine: number | null;
  /** 1-based line number in `after` (null for a removed line). */
  newLine: number | null;
};

/**
 * Line-level LCS diff of two strings.
 *
 * Splits both on `\n` (so a trailing newline surfaces as a final empty line, matching the editor's
 * own line model) and walks the LCS table to emit deletions before additions at each divergence.
 */
export function lineDiff(before: string, after: string): DiffRow[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const n = a.length;
  const m = b.length;

  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..].
  // Sized (n+1) x (m+1) so the base row/column of zeros needs no special-casing.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      rows.push({ type: 'same', text: a[i], oldLine: i + 1, newLine: j + 1 });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      // Dropping a[i] keeps at least as long a common tail: it's a deletion.
      rows.push({ type: 'del', text: a[i], oldLine: i + 1, newLine: null });
      i++;
    } else {
      rows.push({ type: 'add', text: b[j], oldLine: null, newLine: j + 1 });
      j++;
    }
  }
  while (i < n) {
    rows.push({ type: 'del', text: a[i], oldLine: i + 1, newLine: null });
    i++;
  }
  while (j < m) {
    rows.push({ type: 'add', text: b[j], oldLine: null, newLine: j + 1 });
    j++;
  }
  return rows;
}
