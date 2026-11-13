import { ensureUids, findPathByUid, isRunNode, newUid } from '../../src/pml/nodeTree';
import type { PmlNode } from '../../src/pml/primitives';

const heading = (text: string, uid?: string): PmlNode => ({ primitive: 'heading', props: { text }, ...(uid ? { uid } : {}) });

describe('element ids (B1)', () => {
  it('makes 8-character lowercase ids', () => {
    expect(newUid()).toMatch(/^[a-z0-9]{8}$/);
  });

  it('gives missing ids, keeps existing ones, and splits a duplicate', () => {
    const tree = ensureUids([heading('A', 'keepme01'), heading('B', 'keepme01'), { primitive: 'box', children: [heading('C')] }]);

    expect(tree[0].uid).toBe('keepme01');
    expect(tree[1].uid).not.toBe('keepme01');
    expect(tree[2].uid).toMatch(/^[a-z0-9]{8}$/);
    expect(tree[2].children?.[0].uid).toMatch(/^[a-z0-9]{8}$/);
  });

  it('returns the same tree when every element already has its id', () => {
    const tree = ensureUids([heading('A'), { primitive: 'box', children: [heading('B')] }]);

    expect(ensureUids(tree)).toBe(tree);
  });

  it('gives no id to a word run inside a paragraph or to a comment, but does to the paragraph and to a text element', () => {
    const run: PmlNode = { primitive: 'text', props: { value: 'Book a call' } };
    const [p, c, t] = ensureUids([{ primitive: 'p', children: [run] }, { comment: 'a note' }, { primitive: 'text', props: { value: 'On its own' } }]);

    expect(isRunNode(p.children?.[0] as PmlNode)).toBe(true);
    expect(p.uid).toBeDefined();
    expect(p.children?.[0].uid).toBeUndefined();
    expect(c.uid).toBeUndefined();
    expect(t.uid).toBeDefined();
  });

  it('finds an element by its id wherever it moved', () => {
    const tree = ensureUids([heading('A'), { primitive: 'box', children: [heading('B', 'target01')] }]);

    expect(findPathByUid(tree, 'target01')).toEqual([1, 0]);
    expect(findPathByUid(tree, 'gone0001')).toBeNull();
  });
});
