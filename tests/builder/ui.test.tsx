import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import { Button, Input, Label, Switch, Textarea } from '../../src/builder/ui/controls';
import { BuilderThemeProvider, DEFAULT_BUILDER_THEME, useThemeVars } from '../../src/builder/ui/theme';

/** The builder's own primitives (shared program E4a3): roles and keys a person relies on, themed by values. */
describe('builder primitives', () => {
  it('a button never submits a form by accident and is a pill in the theme accent', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button>Save</Button>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('rounded-full');
    expect(screen.getByRole('button', { name: 'Save' }).className).toContain('bg-[var(--pb-accent)]');
  });

  it('a label names its field', () => {
    render(
      <>
        <Label htmlFor="title">Title</Label>
        <Input id="title" defaultValue="Hello" />
        <Label htmlFor="note">Note</Label>
        <Textarea id="note" defaultValue="Hi" />
      </>,
    );

    expect(screen.getByLabelText('Title')).toHaveProperty('value', 'Hello');
    expect(screen.getByLabelText('Note').tagName).toBe('TEXTAREA');
  });

  it('a switch is a switch: its state is announced and a click turns it', () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <Switch aria-label="Show on mobile" checked={on} onCheckedChange={setOn} />;
    }
    render(<Harness />);
    const toggle = screen.getByRole('switch', { name: 'Show on mobile' });

    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('the theme reaches a portalled piece through its variables', () => {
    function Portalled() {
      const vars = useThemeVars();
      return createPortal(<div data-testid="menu" style={vars} />, document.body);
    }
    render(
      <BuilderThemeProvider theme={{ accent: '#123456' }}>
        <Portalled />
      </BuilderThemeProvider>,
    );

    const style = screen.getByTestId('menu').getAttribute('style') ?? '';
    expect(style).toContain('--pb-accent: #123456');
    expect(style).toContain(`--pb-surface: ${DEFAULT_BUILDER_THEME.surface}`);
  });
});
