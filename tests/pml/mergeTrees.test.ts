import { mergeTrees } from '../../src/pml/mergeTrees';
import type { PmlNode } from '../../src/pml/primitives';

const h = (uid: string, text: string): PmlNode => ({ primitive: 'heading', props: { text }, uid });
const box = (uid: string, children: PmlNode[]): PmlNode => ({ primitive: 'box', children, uid });

const BASE = [h('head0001', 'Old headline'), box('body0001', [h('sub00001', 'Sub'), h('faq00001', 'FAQ')])];

describe('mergeTrees (B3: keep what the person did while Porter worked)', () => {
  it("takes Porter's result whole when nothing changed during the run", () => {
    const theirs = [h('head0001', 'Porter headline'), BASE[1]];

    expect(mergeTrees(BASE, theirs, BASE)).toEqual({ nodes: theirs, conflicts: 0, merged: false });
  });

  it("keeps the person's mid-run headline edit while taking Porter's other changes", () => {
    const ours = [h('head0001', 'My headline'), BASE[1]];
    const theirs = [BASE[0], box('body0001', [h('sub00001', 'Porter sub'), h('faq00001', 'FAQ')])];

    const result = mergeTrees(BASE, theirs, ours);

    expect(result.nodes[0].props?.text).toBe('My headline');
    expect(result.nodes[1].children?.[0].props?.text).toBe('Porter sub');
    expect(result.conflicts).toBe(0);
  });

  it("keeps the person's version when both changed the same element, and counts it", () => {
    const ours = [h('head0001', 'My headline'), BASE[1]];
    const theirs = [h('head0001', 'Porter headline'), BASE[1]];

    const result = mergeTrees(BASE, theirs, ours);

    expect(result.nodes[0].props?.text).toBe('My headline');
    expect(result.conflicts).toBe(1);
  });

  it('puts back an element the person added, after the one it followed', () => {
    const ours = [BASE[0], box('body0001', [h('sub00001', 'Sub'), h('new00001', 'Added by me'), h('faq00001', 'FAQ')])];
    const theirs = [h('head0001', 'Porter headline'), box('body0001', [h('sub00001', 'Sub'), h('faq00001', 'FAQ'), h('porter01', 'Added by Porter')])];

    const kids = mergeTrees(BASE, theirs, ours).nodes[1].children?.map((n) => n.uid);

    expect(kids).toEqual(['sub00001', 'new00001', 'faq00001', 'porter01']);
  });

  it('keeps an element the person removed removed', () => {
    const ours = [BASE[0], box('body0001', [h('sub00001', 'Sub')])];
    const theirs = [h('head0001', 'Porter headline'), box('body0001', [h('sub00001', 'Sub'), h('faq00001', 'Porter FAQ')])];

    expect(mergeTrees(BASE, theirs, ours).nodes[1].children?.map((n) => n.uid)).toEqual(['sub00001']);
  });

  it('does not call an untouched element changed because of key order or 1 versus "1"', () => {
    const base = [{ primitive: 'heading', props: { text: 'Hi', level: 1 }, uid: 'head0001' }, h('sub00001', 'Sub')] as PmlNode[];
    const ours = [{ ...base[0], props: { text: 'Mine', level: 1 } }, base[1]] as PmlNode[];
    const theirs = [{ uid: 'head0001', props: { level: '1', text: 'Hi' }, primitive: 'heading' }, h('sub00001', 'Porter sub')] as PmlNode[];

    const result = mergeTrees(base, theirs, ours);

    expect(result.conflicts).toBe(0);
    expect(result.nodes[0].props?.text).toBe('Mine');
    expect(result.nodes[1].props?.text).toBe('Porter sub');
  });
});
