import { addComment, collectComments, removeComment, repinComment, updateComment } from '../../src/pml/comments';
import { isCommentNode } from '../../src/pml/nodeTree';
import type { PmlNode } from '../../src/pml/primitives';

const heading = (text: string, uid: string) => ({ primitive: 'heading', props: { text, level: 2 }, uid }) as PmlNode;
const box = (uid: string, ...children: PmlNode[]) => ({ primitive: 'box', uid, children }) as PmlNode;

describe('studio comments', () => {
  const page = (): PmlNode[] => [box('box11111', heading('A', 'head1111'), heading('B', 'head2222')), heading('C', 'head3333')];

  it('is written right before its element and pinned by its id', () => {
    const added = addComment(page(), [0, 1], 'Fix this', { author: 'Ada', at: '2026-11-07T10:00:00Z' })!;

    expect(added.path).toEqual([0, 1]);
    expect(added.nodes[0].children?.[1]).toEqual({ comment: 'Fix this', note: { author: 'Ada', at: '2026-11-07T10:00:00Z', for: 'head2222' } });

    const [comment] = collectComments(added.nodes);
    expect(comment.target).toEqual([0, 2]);
  });

  it('always pins to the target, whatever note was passed in', () => {
    const added = addComment(page(), [1], 'x', { for: 'someone-else' } as never)!;

    expect(added.nodes[1].note?.for).toBe('head3333');
  });

  it('follows its element when the element moves, and becomes an orphan when it goes', () => {
    const added = addComment(page(), [1], 'Top level', { author: 'Ada' })!;
    const moved = [added.nodes[2], added.nodes[1], added.nodes[0]];

    expect(collectComments(moved)[0].target).toEqual([0]);
    expect(collectComments([added.nodes[0], added.nodes[1]])[0].target).toBeNull();
  });

  it('a comment saved empty comes back as null and is still a comment, never a section', () => {
    // Laravel turns "" into null on the way in (2026-11-07): that ghost shifted every preview by one.
    const ghost = { comment: null, note: { for: 'head3333' } } as unknown as PmlNode;

    expect(isCommentNode(ghost)).toBe(true);
    expect(collectComments([ghost, heading('C', 'head3333')])[0]).toMatchObject({ text: '', target: [1] });
  });

  it('a comment pinned to another comment is an orphan', () => {
    const odd = [{ comment: 'a', note: { for: 'ghost111' } }, { comment: null, uid: 'ghost111', note: {} }] as unknown as PmlNode[];

    expect(collectComments(odd)[0].target).toBeNull();
  });

  it('on a component, a comment on the one top element goes inside it, never beside it', () => {
    const design = [box('root1111', heading('A', 'head1111'))];
    const added = addComment(design, [0], 'About the whole card', {}, { insideTop: true })!;

    expect(added.nodes).toHaveLength(1);
    expect(added.path).toEqual([0, 0]);
    expect(collectComments(added.nodes)[0].target).toEqual([0]);
  });

  it('is edited, resolved, reopened, moved and deleted in place', () => {
    const { nodes, path } = addComment(page(), [1], 'One', { color: 'yellow' })!;
    const edited = updateComment(nodes, path, { text: 'Two', note: { color: 'blue', resolved: true } });

    expect(edited[path[0]]).toEqual({ comment: 'Two', note: { color: 'blue', resolved: true, for: 'head3333' } });
    expect(updateComment(edited, path, { note: { resolved: false } })[path[0]].note).not.toHaveProperty('resolved');

    const repinned = repinComment(edited, path, [0, 0]);
    const [moved] = collectComments(repinned);
    expect(moved.note.for).toBe('head1111');
    expect(moved.path).toEqual([0, 0]);

    expect(collectComments(removeComment(repinned, moved.path))).toEqual([]);
  });
});
