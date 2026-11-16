import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { Card, CardContent, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../src/builder/ui/select';
import { BuilderThemeProvider } from '../../src/builder/ui/theme';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
// Radix select reads pointer capture and scrollIntoView, which jsdom lacks.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => undefined;
Element.prototype.scrollIntoView ??= () => undefined;

/** The builder's Select and Card (shared program E4a3c). */
describe('builder select and card', () => {
  it('chooses a value from the keyboard and themes its portalled list', async () => {
    function Harness() {
      const [value, setValue] = useState('normal');
      return (
        <BuilderThemeProvider theme={{ accent: '#123456' }}>
          <Select value={value} onValueChange={setValue}>
            <SelectTrigger aria-label="Padding"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="spacious">Spacious</SelectItem>
            </SelectContent>
          </Select>
          <output data-testid="value">{value}</output>
        </BuilderThemeProvider>
      );
    }
    render(<Harness />);

    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Padding' }), { key: 'Enter' });
    await waitFor(() => expect(screen.getByRole('listbox')).toBeTruthy());
    expect(screen.getByRole('listbox').closest('[style]')?.getAttribute('style')).toContain('--pb-accent: #123456');

    fireEvent.click(screen.getByRole('option', { name: 'Spacious' }));
    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('spacious'));
  });

  it('a card is a themed panel', () => {
    render(<Card data-testid="card"><CardContent>Hello</CardContent></Card>);

    expect(screen.getByTestId('card').className).toContain('bg-[var(--pb-surface)]');
    expect(screen.getByText('Hello').className).toContain('p-4');
  });
});
