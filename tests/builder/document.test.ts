import { describe, expect, it } from 'vitest';

import { isConflict, type PublishResult, type SaveDraftResult } from '../../src/builder/document';

/**
 * The DocumentAdapter contract (shared program E4a1): a save or publish that lost a race answers a conflict, which the
 * builder must tell apart from a result without guessing.
 */
describe('isConflict', () => {
  it('tells a refused save from a saved one', () => {
    const saved: SaveDraftResult = { revision: 'abc' };
    const refused: SaveDraftResult = { conflict: { message: 'This page was changed somewhere else.', by: 'Ada', at: '2026-11-13T22:00:00Z' } };

    expect(isConflict(saved)).toBe(false);
    expect(isConflict(refused)).toBe(true);
  });

  it('tells a refused publish from a published or scheduled one', () => {
    const published: PublishResult = { published: true, url: 'https://example.com/a' };
    const scheduled: PublishResult = { scheduled: '2026-11-20T09:00:00Z' };
    const refused: PublishResult = { conflict: { message: 'Changed since you opened it.', by: null, at: null } };

    expect(isConflict(published)).toBe(false);
    expect(isConflict(scheduled)).toBe(false);
    expect(isConflict(refused)).toBe(true);
  });
});
