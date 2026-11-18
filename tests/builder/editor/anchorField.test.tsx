import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { FieldControl } from '../../../src/builder/editor/settingsFields';

const field = { key: 'anchor', label: 'Link name (for #links and the table of contents)', kind: 'anchor', optional: true } as const;

/** The link name field (2026-11-18: its example was one heading's slug, shown on every element's panel). */
describe('the link name field', () => {
  it('shows a neutral example and says what an empty name does', () => {
    render(<FieldControl field={field} value={undefined} onChange={() => undefined} />);
    const input = screen.getByLabelText(/Link name/) as HTMLInputElement;

    expect(input.placeholder).toBe('a-short-name');
    expect(screen.getByText(/Left empty, a heading gets one from its own words/)).toBeTruthy();
  });

  it('keeps typed words as the slug and shows the link', () => {
    const onChange = vi.fn();
    const { rerender } = render(<FieldControl field={field} value={undefined} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/Link name/), { target: { value: 'Fees and costs' } });
    expect(onChange).toHaveBeenCalledWith('fees-and-costs');

    rerender(<FieldControl field={field} value="fees-and-costs" onChange={onChange} />);
    expect(screen.getByText('Link to it with #fees-and-costs')).toBeTruthy();
  });
});
