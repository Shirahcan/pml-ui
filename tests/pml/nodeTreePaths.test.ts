import { renderedPathFor, sourcePathFor } from '../../src/pml/nodeTree';
import type { PmlNode } from '../../src/pml/primitives';

const heading = { primitive: 'heading', props: { text: 'Title', level: 2 } } as PmlNode;
const note = { comment: 'a note' } as unknown as PmlNode;

const tree: PmlNode[] = [
  {
    primitive: 'box',
    children: [note, heading, { primitive: 'grid', children: [note, note, heading] } as PmlNode],
  } as PmlNode,
  { component: 'pricing_plan', props: {} } as PmlNode,
];

describe('positions on the canvas and in the source', () => {
  it('skips comments, which the compiled tree drops', () => {
    expect(sourcePathFor(tree, [0, 0])).toEqual([0, 1]);
    expect(sourcePathFor(tree, [0, 1, 0])).toEqual([0, 2, 2]);
  });

  it('stops at a component, whose insides belong to its own design', () => {
    expect(sourcePathFor(tree, [1, 0, 2])).toEqual([1]);
  });

  it('converts back the other way', () => {
    expect(renderedPathFor(tree, [0, 1])).toEqual([0, 0]);
    expect(renderedPathFor(tree, [0, 2, 2])).toEqual([0, 1, 0]);
  });

  it('keeps a section as itself', () => {
    expect(sourcePathFor(tree, [1])).toEqual([1]);
    expect(renderedPathFor(tree, [1])).toEqual([1]);
  });
});
