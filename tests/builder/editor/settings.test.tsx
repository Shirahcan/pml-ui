import React from 'react';
import { render as rtlRender, screen, fireEvent } from '@testing-library/react';

import type { DocumentMediaPort } from '../../../src/builder/document';
import { MediaSourceProvider } from '../../../src/builder/editor/MediaField';
import { PmlSettings } from '../../../src/builder/editor/PmlSettings';
import type { PmlNode } from '../../../src/language';
import { pathExpr } from '../../../src/language';

// Image fields find the host's media through the provider (E4a4g); a library is present, so they offer the picker.
const media = { list: async () => ({ media: [] }), upload: async () => ({ id: 'm', url: '' }), remove: async () => undefined } as unknown as DocumentMediaPort;
const Wrapper = ({ children }: { children: React.ReactNode }) => <MediaSourceProvider media={media}>{children}</MediaSourceProvider>;
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: Wrapper });

// The visual editors are TipTap surfaces; the unit under test here is which editor the panel picks and what
// it writes back, so stand them in with something inspectable (canEditVisually stays real).
vi.mock('../../../src/builder/editor/MarkdownEditor', () => ({
  MarkdownEditor: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <button type="button" data-testid="markdown-editor" onClick={() => onChange('## Edited visually')}>
      {value}
    </button>
  ),
}));
vi.mock('../../../src/builder/editor/ParagraphEditor', async () => ({
  ...(await vi.importActual<object>('../../../src/builder/editor/ParagraphEditor')),
  ParagraphEditor: ({ words, onChange }: { words: unknown[]; onChange: (w: unknown[]) => void }) => (
    <button type="button" data-testid="paragraph-editor" onClick={() => onChange([{ primitive: 'text', props: { value: 'New words' } }])}>
      {words.length} pieces
    </button>
  ),
}));

/**
 * The rail is catalog-driven, so these cover the raw leaf primitives Part B put in the menu:
 * an image edits through the media LIBRARY picker (not a URL box), and a heading edits its props.
 */
describe('PmlSettings for raw leaf primitives', () => {
  const noop = () => {};

  it('gives an image primitive the media picker plus alt and caption', () => {
    render(
      <PmlSettings node={{ primitive: 'image', props: {} }} onChange={noop} onDelete={noop} />,
    );

    expect(screen.getByRole('button', { name: /choose an image/i })).toBeTruthy();
    expect(screen.getByText(/describe the image/i)).toBeTruthy();
    expect(screen.getByText('Caption')).toBeTruthy();
  });

  it('offers Change/Remove once an image is chosen', () => {
    render(
      <PmlSettings
        node={{ primitive: 'image', props: { src: '/media/photo.png' } }}
        onChange={noop}
        onDelete={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('edits a heading primitive through its catalog fields', () => {
    const onChange = vi.fn();
    render(
      <PmlSettings
        node={{ primitive: 'heading', props: { text: 'Old', level: '2' } }}
        onChange={onChange}
        onDelete={noop}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('Old'), { target: { value: 'New heading' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ primitive: 'heading', props: { text: 'New heading', level: '2' } }),
    );
  });
});

describe('PmlSettings with live page data', () => {
  it('shows an expression as what it reads, not an empty box, and can make it fixed', () => {
    const onChange = vi.fn();
    render(
      <PmlSettings
        node={{ primitive: 'heading', props: { text: pathExpr('owner.name'), level: '2' } }}
        onChange={onChange}
        onDelete={() => {}}
      />,
    );

    expect(screen.getByText('{owner.name}')).toBeTruthy();
    // No text box for the heading's text: a keystroke there would replace the live value.
    expect(document.querySelector('input[name="text"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Use a fixed value' }));

    // An emptied value leaves the prop off (the rail's own rule), so the heading's text box comes back empty.
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ props: { level: '2' } }));
  });
});

describe('PmlSettings layout containers', () => {
  const noop = () => {};

  it('shows an honest empty state for an empty container', () => {
    render(
      <PmlSettings
        node={{ primitive: 'box', props: {}, children: [] }}
        onChange={noop}
        onDelete={noop}
      />,
    );

    expect(screen.getByText('Contents')).toBeTruthy();
    expect(screen.getByText(/empty\. add an element/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /add an element/i })).toBeTruthy();
  });

  it('edits a container child recursively through the nested rail', () => {
    const onChange = vi.fn();
    render(
      <PmlSettings
        node={{
          primitive: 'grid',
          props: { columns: '2', gap: 'md' },
          children: [{ primitive: 'heading', props: { text: 'Inside', level: '3' } }],
        }}
        onChange={onChange}
        onDelete={noop}
      />,
    );

    // A child row is folded until opened, as a person would open it.
    fireEvent.click(screen.getByRole('button', { name: /^1\. / }));

    fireEvent.change(screen.getByDisplayValue('Inside'), { target: { value: 'Changed' } });

    const next = onChange.mock.calls[0][0];
    expect(next.primitive).toBe('grid');
    expect(next.children[0].props.text).toBe('Changed');
  });

  it('removes a child from the container', () => {
    const onChange = vi.fn();
    render(
      <PmlSettings
        node={{
          primitive: 'box',
          props: {},
          children: [{ primitive: 'heading', props: { text: 'Gone', level: '2' } }],
        }}
        onChange={onChange}
        onDelete={noop}
      />,
    );

    // A child row is folded until opened, as a person would open it.
    fireEvent.click(screen.getByRole('button', { name: /^1\. / }));

    fireEvent.click(screen.getByRole('button', { name: 'Remove element' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ children: [] }));
  });

  it('offers a span control for a GRID child but not a BOX child', () => {
    // Annotated so the nested child's `primitive` keeps its literal type (a pre-assigned const
    // otherwise widens 'heading' to string, which no longer satisfies the PmlNode union).
    const gridChild: PmlNode = {
      primitive: 'grid',
      props: { columns: '2' },
      children: [{ primitive: 'heading', props: { text: 'In grid', level: '2' } }],
    };
    const { rerender } = render(
      <PmlSettings node={gridChild} onChange={noop} onDelete={noop} />,
    );

    // A child row is folded until opened, as a person would open it.
    fireEvent.click(screen.getByRole('button', { name: /^1\. / }));
    expect(screen.getByText('Size in the grid')).toBeTruthy();

    rerender(
      <PmlSettings
        node={{
          primitive: 'box',
          props: {},
          children: [{ primitive: 'heading', props: { text: 'In box', level: '2' } }],
        }}
        onChange={noop}
        onDelete={noop}
      />,
    );
    expect(screen.queryByText('Size in the grid')).toBeNull();
  });
});

describe('PmlSettings words (PML v3 L4)', () => {
  const noop = () => {};

  it('edits a text element as plain words', () => {
    const onChange = vi.fn();
    render(<PmlSettings node={{ primitive: 'text', props: { value: 'Hello there' } }} onChange={onChange} onDelete={noop} />);

    fireEvent.change(screen.getByDisplayValue('Hello there'), { target: { value: 'Hello again' } });

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ primitive: 'text', props: { value: 'Hello again' } }));
    expect(screen.queryByRole('button', { name: 'Rich' })).toBeNull();
  });

  it('edits rich text visually, with its Markdown one toggle away', () => {
    const onChange = vi.fn();
    render(<PmlSettings node={{ primitive: 'rich_text', props: { markdown: 'Some **bold** words' } }} onChange={onChange} onDelete={noop} />);

    fireEvent.click(screen.getByTestId('markdown-editor'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ primitive: 'rich_text', props: { markdown: '## Edited visually' } }));

    fireEvent.click(screen.getByRole('button', { name: 'Markdown' }));
    fireEvent.change(screen.getByDisplayValue('Some **bold** words'), { target: { value: '- a list' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ props: { markdown: '- a list' } }));
  });

  it('edits a paragraph with bold words and page data in the visual editor', () => {
    const onChange = vi.fn();
    const node: PmlNode = {
      primitive: 'p',
      children: [
        { primitive: 'text', props: { value: 'Book a call with ' } },
        { primitive: 'strong', children: [{ primitive: 'text', props: { value: pathExpr('owner.name') } }] },
        { primitive: 'text', props: { value: ' today.' } },
      ],
    };
    render(<PmlSettings node={node} onChange={onChange} onDelete={noop} />);

    expect(screen.getByTestId('paragraph-editor').textContent).toContain('3 pieces');
    fireEvent.click(screen.getByTestId('paragraph-editor'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ primitive: 'p', children: [{ primitive: 'text', props: { value: 'New words' } }] }));
  });

  it('sends a paragraph with something the editor cannot show to the Code view', () => {
    const node: PmlNode = {
      primitive: 'p',
      children: [{ primitive: 'text', props: { value: 'A ' } }, { primitive: 'mark', children: [{ primitive: 'text', props: { value: 'highlight' } }] } as PmlNode],
    };
    render(<PmlSettings node={node} onChange={() => {}} onDelete={noop} />);

    expect(screen.getByText('A highlight')).toBeTruthy();
    expect(screen.getByText(/Change them in the Code view/)).toBeTruthy();
    expect(screen.queryByTestId('paragraph-editor')).toBeNull();
  });
});
