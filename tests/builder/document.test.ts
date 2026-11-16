import { describe, expect, it } from 'vitest';

import { paramDefaultText } from '../../src/builder/components';
import { pathExpr } from '../../src/pml/expressions';
import { isConflict, isPlaceholders, isRefused, type PublishResult, type SaveDraftResult } from '../../src/builder/document';

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

/**
 * E4a2a: a publish refused by a check, or held back by placeholders, is an answer the builder shows in place, told
 * apart from a result and from a conflict without guessing; and the settings default reads as text.
 */
describe('isRefused and isPlaceholders', () => {
  const refused: PublishResult = { refused: { mayPublish: false, findings: [{ source: 'pack', severity: 'block', rule: 'guarantee', message: 'A guaranteed outcome.', excerpt: 'We guarantee', suggestion: null }] } };
  const left: PublishResult = { placeholders: { message: 'Two pictures are still placeholders.', total: 2, pictures: 2, other: 0, examples: [] } };
  const published: PublishResult = { published: true, url: null };
  const conflict: PublishResult = { conflict: { message: 'Changed.', by: null, at: null } };

  it('tells each answer apart', () => {
    expect([refused, left, published, conflict].map(isRefused)).toEqual([true, false, false, false]);
    expect([refused, left, published, conflict].map(isPlaceholders)).toEqual([false, true, false, false]);
    expect([refused, left, published, conflict].map(isConflict)).toEqual([false, false, false, true]);
  });

  it('reads a setting default as text', () => {
    expect(paramDefaultText({ default: '49' })).toBe('49');
    expect(paramDefaultText({ default: pathExpr('props.plans') })).toBe('props.plans');
    expect(paramDefaultText({ default: null })).toBe('');
  });
});
