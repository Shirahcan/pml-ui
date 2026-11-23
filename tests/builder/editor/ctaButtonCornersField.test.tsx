import React from 'react';
import { render, screen } from '@testing-library/react';

import { FieldControl } from '../../../src/builder/editor/settingsFields';
import { PML_CATALOG } from '../../../src/pml/catalog';

/**
 * A call to action's "Button corners" (owner 2026-11-23: blog buttons "obey the theme but they should also be able to be
 * modified in the studio"): its own option words, and a design saved before the field reads "Follow the theme".
 */
describe('a call to action\'s button corners', () => {
  const field = PML_CATALOG.find((c) => c.name === 'post_cta')?.fields.find((f) => f.key === 'button_corners');

  it('is a setting of the call to action block, theme first', () => {
    expect(field?.label).toBe('Button corners');
    expect(field?.options).toEqual(['theme', 'pill', 'rounded', 'square']);
    expect(field?.unsetAs).toBe('theme');
  });

  it('shows an unset value as "Follow the theme", never "Choose one"', () => {
    render(<FieldControl field={field!} value={undefined} onChange={() => undefined} />);

    const trigger = screen.getByLabelText('Button corners');
    expect(trigger.textContent).toContain('Follow the theme');
    expect(trigger.textContent).not.toContain('Choose one');
  });

  it('shows a chosen value by its own word', () => {
    render(<FieldControl field={field!} value="square" onChange={() => undefined} />);

    expect(screen.getByLabelText('Button corners').textContent).toContain('Square');
  });
});
