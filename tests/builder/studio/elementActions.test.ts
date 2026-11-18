import { CLIPBOARD_KEY, availableActions, elementActions, freshCopy, heldElement, holdElement } from '../../../src/builder/studio/elementActions';
import type { PmlNode } from '../../../src/language';

const p = (uid: string, value: string) => ({ primitive: 'p', uid, children: [{ primitive: 'text', props: { value } }] }) as unknown as PmlNode;
const pin = (uid: string) => ({ comment: 'Purpose: pinned.', note: { for: uid } }) as unknown as PmlNode;

/** abc111, a pinned comment, a box (bbb222) holding two paragraphs, abc333. */
const page = (): PmlNode[] =>
  [
    p('abc111', 'One'),
    pin('abc111'),
    { primitive: 'box', uid: 'bbb222', children: [p('kid111', 'Inner one'), p('kid222', 'Inner two')] },
    p('abc333', 'Three'),
  ] as unknown as PmlNode[];

const uids = (nodes: PmlNode[]): string[] => nodes.flatMap((node) => [...(node.uid ? [node.uid] : []), ...uids(node.children ?? [])]);
const words = (nodes: PmlNode[]) => nodes.map((n) => n.comment ?? n.children?.[0]?.props?.value ?? n.primitive);

/** The Studio's element menu, as tree edits (shared PML Studio P3a). */
describe('elementActions', () => {
  beforeEach(() => sessionStorage.clear());

  it('duplicates right after the element, with NEW ids all the way down', () => {
    const moved = elementActions.duplicate(page(), [2])!;
    const copy = moved.nodes[3];

    expect(moved.path).toEqual([3]);
    expect(copy.primitive).toBe('box');
    expect(uids([copy]).some((uid) => ['bbb222', 'kid111', 'kid222'].includes(uid))).toBe(false);
    expect(new Set(uids(moved.nodes)).size).toBe(uids(moved.nodes).length);
  });

  it('a paste ABOVE the original never takes the original id (its pinned comments stay on it)', () => {
    holdElement(page()[2]);
    const moved = elementActions.pasteAfter(page(), [0], heldElement()!)!;

    // The pasted copy sits at [1], above the original box, which keeps bbb222.
    expect(moved.nodes[3].uid).toBe('bbb222');
    expect(moved.nodes[1].uid).not.toBe('bbb222');
    expect(moved.nodes[2]).toEqual(pin('abc111'));
  });

  it('holds what was copied in the session under the key the site creator uses, so it pastes across designers', () => {
    expect(holdElement(page()[0])).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(CLIPBOARD_KEY)!).uid).toBe('abc111');
    expect(heldElement()?.primitive).toBe('p');

    sessionStorage.setItem(CLIPBOARD_KEY, '"not an element"');
    expect(heldElement()).toBeNull();
  });

  it('pastes at the end of the page with nothing selected', () => {
    const moved = elementActions.pasteAfter(page(), null, page()[0])!;

    expect(moved.path).toEqual([4]);
    expect(moved.nodes[4].uid).not.toBe('abc111');
  });

  it('wraps an element in a new box where it stood, keeping its own id', () => {
    const moved = elementActions.wrapInBox(page(), [3])!;

    expect(moved.path).toEqual([3]);
    expect(moved.nodes[3].primitive).toBe('box');
    expect(moved.nodes[3].uid).toMatch(/^[a-z0-9]{6,16}$/);
    expect(moved.nodes[3].children?.[0].uid).toBe('abc333');
  });

  it("unwraps a box: its elements take its place and the selection goes to the first", () => {
    const moved = elementActions.unwrap(page(), [2])!;

    expect(words(moved.nodes)).toEqual(['One', 'Purpose: pinned.', 'Inner one', 'Inner two', 'Three']);
    expect(moved.path).toEqual([2]);
  });

  it('never unwraps words (a paragraph) or a component, and never wraps a word run', () => {
    expect(elementActions.unwrap(page(), [0])).toBeNull();
    expect(elementActions.unwrap([{ primitive: 'box', component: 'hero', children: [p('kid111', 'x')] }] as unknown as PmlNode[], [0])).toBeNull();
    expect(elementActions.wrapInBox(page(), [0, 0])).toBeNull();
  });

  it('moves one step past a comment, and removes with the selection going to the parent', () => {
    expect(words(elementActions.move(page(), [2], -1)!.nodes)).toEqual(['box', 'Purpose: pinned.', 'One', 'Three']);
    expect(elementActions.remove(page(), [2, 1])).toEqual({ nodes: expect.any(Array), path: [2] });
  });

  it('offers only what this element can take', () => {
    const can = availableActions(page(), [0], null);

    expect(can.up).toBeNull();
    expect(can.down).not.toBeNull();
    expect(can.paste).toBeNull();
    expect(can.unwrap).toBeNull();
    expect(can.wrap).not.toBeNull();
  });

  it('a fresh copy keeps comments as they are and gives every element a new id', () => {
    const copy = freshCopy({ primitive: 'box', uid: 'bbb222', children: [p('kid111', 'x'), pin('kid111')] } as unknown as PmlNode);

    expect(copy.uid).not.toBe('bbb222');
    expect(copy.children?.[1]).toEqual(pin('kid111'));
  });
});
