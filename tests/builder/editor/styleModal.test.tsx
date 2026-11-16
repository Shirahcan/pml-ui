import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { StyleModalTrigger } from '../../../src/builder/editor/StyleModal';
import type { PmlNode } from '../../../src/language';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const noop = () => {};

function open(node: PmlNode, onChange: (next: PmlNode) => void = noop) {
  render(<StyleModalTrigger node={node} onChange={onChange} canAuthorPml />);
  fireEvent.click(screen.getByRole('button', { name: /style/i }));
}

describe('StyleModalTrigger', () => {
  it('opens a grouped styling modal from the rail', () => {
    open({ primitive: 'box', style: {} });

    // The grouped scaffold is present (query the group headings, since a token label may repeat
    // the group name, e.g. the Motion group holds a Motion select), and the footer is reachable.
    for (const group of ['Placement', 'Spacing', 'Typography', 'Colour', 'Border & effects', 'Motion']) {
      expect(screen.getByRole('heading', { name: group })).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  it('shows how many style tokens are applied', () => {
    const node: PmlNode = { primitive: 'heading', props: { text: 'x' }, style: { align: 'center', width: 'wide' } };
    render(<StyleModalTrigger node={node} onChange={noop} />);

    expect(screen.getByText('2 applied')).toBeTruthy();
  });

  it('applies a preset as a merged token bundle', () => {
    const onChange = vi.fn();
    open({ primitive: 'box', style: { motion: 'reveal-up' } }, onChange);

    fireEvent.click(screen.getByRole('button', { name: 'Card' }));

    const next = onChange.mock.calls[0][0] as PmlNode;
    expect(next.style).toMatchObject({ border: 'hairline', radius: 'lg', shadow: 'sm', motion: 'reveal-up' });
  });

  it('sets a palette text colour from a swatch', () => {
    const onChange = vi.fn();
    open({ primitive: 'text', props: { value: 'x' }, style: {} }, onChange);

    fireEvent.click(screen.getByLabelText('Accent'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ style: expect.objectContaining({ text_color: 'accent' }) }),
    );
  });

  it('reveals the border colour picker only once a border is set', () => {
    const { rerender } = render(
      <StyleModalTrigger node={{ primitive: 'box', style: {} }} onChange={noop} canAuthorPml />,
    );
    fireEvent.click(screen.getByRole('button', { name: /style/i }));
    expect(screen.queryByText('Border colour')).toBeNull();

    rerender(
      <StyleModalTrigger node={{ primitive: 'box', style: { border: 'thin' } }} onChange={noop} canAuthorPml />,
    );
    expect(screen.getByText('Border colour')).toBeTruthy();
  });

  it('draws the host bindings first and its plan words where premium styling is locked', () => {
    render(
      <StyleModalTrigger
        node={{ primitive: 'box', style: {} }}
        onChange={noop}
        renderBindings={({ label }) => <p>Each page can choose: {label}</p>}
        lockedNote="Motion is a Scale feature."
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /style/i }));

    expect(screen.getByText('Each page can choose: box')).toBeTruthy();
    expect(screen.getByText('Motion is a Scale feature.')).toBeTruthy();
  });

  it('keeps Done reachable: a bounded dialog whose body scrolls', () => {
    open({ primitive: 'box', style: {} });

    const dialog = screen.getByRole('dialog', { name: 'Style' });
    expect(dialog.className).toContain('max-h-[90vh]');
    expect(dialog.className).toContain('max-w-xl');
    expect(screen.getByRole('heading', { name: 'Placement' }).closest('.overflow-y-auto')).toBeTruthy();
  });
});

describe('the rail trigger', () => {
  it('keeps a gap between its icon and its word', () => {
    render(<StyleModalTrigger node={{ primitive: 'box', style: {} }} onChange={() => {}} />);

    expect(screen.getByRole('button', { name: /style/i }).querySelector('span')?.className).toContain('gap-2');
  });
});
