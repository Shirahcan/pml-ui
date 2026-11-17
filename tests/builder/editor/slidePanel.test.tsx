import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { SlidePanel } from '../../../src/builder/editor/SlidePanel';

function Harness() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <div data-pml-section="0">A section on the canvas</div>
      <p>Somewhere else</p>
      <SlidePanel open={open} title="Details" onClose={() => setOpen(false)}>
        <p>Inside the panel</p>
      </SlidePanel>
    </div>
  );
}

/** The editor's options panel slides in over the canvas (owner 2026-11-17: the design area is never shrunk). */
describe('SlidePanel', () => {
  it('is closed by default and inert, opens when asked, and closes on Escape', async () => {
    render(<Harness />);
    expect(screen.queryByRole('complementary', { name: 'Details' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(await screen.findByRole('complementary', { name: 'Details' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Details' })).toBeNull());
  });

  it('stays open on a press on the canvas, and closes on a press anywhere else', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await screen.findByRole('complementary', { name: 'Details' });

    fireEvent.pointerDown(screen.getByText('A section on the canvas'));
    expect(screen.getByRole('complementary', { name: 'Details' })).toBeTruthy();

    fireEvent.pointerDown(screen.getByText('Somewhere else'));
    await waitFor(() => expect(screen.queryByRole('complementary', { name: 'Details' })).toBeNull());
  });
});
