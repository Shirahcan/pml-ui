import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import type { EditableDocumentAdapter } from '../../../src/builder/document';
import { BuilderHostProvider } from '../../../src/builder/editor/host';
import { Studio, type StudioControls } from '../../../src/builder/editor/PageEditor';
import { structuredChild } from '../../../src/builder/studio/AddRelative';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= () => undefined;
Element.prototype.hasPointerCapture ??= () => false;

const heading = (uid: string, text: string, level = 2) => ({ primitive: 'heading', uid, props: { text, level } });
const design = [
  { primitive: 'box', uid: 'box111', children: [heading('abc111', 'Who can apply?'), heading('abc222', 'What does it cost?')] },
  heading('abc333', 'After the box', 2),
] as unknown as PmlNode[];

function open(onError = vi.fn()) {
  let controls: StudioControls | null = null;
  const adapter = {
    load: vi.fn(async () => ({ document: { nodes: design }, revision: 'd1', meta: { title: 'A page', slug: 'a-page', status: 'draft', publishedAt: null, hasUnpublishedChanges: true, publicUrl: null } })),
    saveDraft: vi.fn(async () => ({ revision: 'd2' })),
    preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
    preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
  } as unknown as EditableDocumentAdapter;
  render(
    <BuilderHostProvider onError={onError}>
      <Studio
        adapter={adapter}
        id="p1"
        renderControls={(c) => {
          controls = c;
          return null;
        }}
      />
    </BuilderHostProvider>,
  );

  return { nodes: () => (controls as unknown as StudioControls | null)?.nodes ?? [] };
}

const texts = (nodes: PmlNode[]): string[] => nodes.flatMap((n) => [...(n.props?.text ? [String(n.props.text)] : []), ...texts(n.children ?? [])]);

/** Add an element before / inside / after the selected one (shared PML Studio P3b1, the creator's verb for every profile). */
describe('adding relative to the selected element', () => {
  it("the element's panel adds after it, inside its own box, and selects what was added", async () => {
    const { nodes } = open();

    fireEvent.click(await screen.findByRole('heading', { name: 'Who can apply?' }, { timeout: 3000 }));
    const panel = await screen.findByRole('complementary', { name: 'Heading' }, { timeout: 3000 });
    const add = within(panel).getByRole('button', { name: /Add an element/ });
    fireEvent.pointerDown(add, { button: 0, pointerType: 'mouse' });
    fireEvent.keyDown(add, { key: 'Enter' });
    fireEvent.click(within(await screen.findByRole('menu')).getByRole('menuitem', { name: /After this heading/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Add an element after this heading' });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Paragraph/ }));

    await waitFor(() => expect(nodes()[0].children?.[1].primitive).toBe('p'));
    expect(texts(nodes())).toEqual(['Who can apply?', 'What does it cost?', 'After the box']);
  });

  it('the element menu offers the same spots (a heading holds no elements, so no Inside)', async () => {
    open();

    fireEvent.contextMenu(await screen.findByRole('heading', { name: 'After the box' }, { timeout: 3000 }));
    const items = within(await screen.findByRole('menu', {}, { timeout: 3000 })).getAllByRole('menuitem').map((i) => i.textContent);

    expect(items).toContain('Add before this');
    expect(items).toContain('Add after this');
    expect(items).not.toContain('Add inside this');
  });

  it('a structured container gets its one kind of child at once (a table a row as wide as its rows)', () => {
    const table = { primitive: 'table', children: [{ primitive: 'row', children: [{ primitive: 'cell' }, { primitive: 'cell' }, { primitive: 'cell' }] }] } as unknown as PmlNode;

    expect(structuredChild(table)?.children).toHaveLength(3);
    expect(structuredChild({ primitive: 'row' } as PmlNode)?.primitive).toBe('cell');
    expect(structuredChild({ primitive: 'box' } as PmlNode)).toBeNull();
  });
});

