import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { PaddingField } from '../../../src/builder/editor/PaddingField';

/** One padding axis: one size, or each side; two matching sides fold back to one (shared program E4a4b). */
describe('PaddingField', () => {
  function Harness({ start }: { start: string }) {
    const [value, setValue] = useState(start);
    return (
      <>
        <PaddingField label="Top and bottom" sideLabels={['Top', 'Bottom']} value={value} options={['compact', 'normal', 'spacious']} onChange={setValue} />
        <output data-testid="value">{value}</output>
      </>
    );
  }

  it('starts as one size and opens both sides on request', () => {
    render(<Harness start="normal" />);

    expect(screen.getByRole('combobox', { name: 'Top and bottom' })).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Set each side' }));
    expect(screen.getByRole('combobox', { name: 'Top and bottom: Top' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Top and bottom: Bottom' })).toBeTruthy();
  });

  it('a stored pair shows both sides, and closing keeps the first side for both', () => {
    render(<Harness start="compact spacious" />);

    expect(screen.getByRole('combobox', { name: 'Top and bottom: Top' })).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Set each side' }));
    expect(screen.getByTestId('value').textContent).toBe('compact');
  });
});
