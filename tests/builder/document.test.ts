import { describe, expect, it } from 'vitest';

import { paramDefaultText } from '../../src/builder/components';
import { pathExpr } from '../../src/pml/expressions';
import { isConflict, isPlaceholders, isRefused, type DocumentFieldsPort, type PublishResult, type SaveDraftResult } from '../../src/builder/document';

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

describe('a conflict can carry the newer revision', () => {
  it('so "Keep mine" saves from it (E4a2b)', () => {
    const refused: SaveDraftResult = { conflict: { message: 'Changed elsewhere.', by: null, at: null, revision: 'rev-9' } };

    expect(isConflict(refused) && refused.conflict.revision).toBe('rev-9');
  });
});

/** Post layouts C1 (owner 2026-11-16): a document's own fields, read and written like its design. */
describe('the fields port', () => {
  it('describes, reads and writes fields, and a write over a newer revision is a conflict, never an overwrite', async () => {
    let revision = 'r1';
    const values: Record<string, unknown> = { title: 'Canada Express Entry 2026', tags: ['express entry'], read_minutes: 12 };
    const fields: DocumentFieldsPort = {
      describe: async () => [
        { name: 'title', label: 'Title', kind: 'text', max: 60 },
        { name: 'tags', label: 'Tags', kind: 'list', max: 8 },
        { name: 'read_minutes', label: 'Read time', kind: 'text', readOnly: true },
      ],
      read: async () => ({ values: { ...values }, revision }),
      write: async (_id, name, value, base) => {
        if (base !== revision) return { conflict: { message: 'This post was changed somewhere else.', by: null, at: null } };
        values[name] = value;
        revision = `r${Number(revision.slice(1)) + 1}`;

        return { revision };
      },
    };

    expect((await fields.describe('p1')).find((f) => f.name === 'read_minutes')?.readOnly).toBe(true);

    const first = await fields.write('p1', 'title', 'Express Entry 2026: who qualifies', 'r1', 's1');
    expect(isConflict(first)).toBe(false);
    expect((await fields.read('p1')).values.title).toBe('Express Entry 2026: who qualifies');

    expect(isConflict(await fields.write('p1', 'title', 'Stale words', 'r1', 's2'))).toBe(true);
    expect((await fields.read('p1')).values.title).toBe('Express Entry 2026: who qualifies');
  });
});
