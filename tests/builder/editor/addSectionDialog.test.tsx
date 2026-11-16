import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

import { PmlAddSectionDialog } from '../../../src/builder/editor/PmlAddSectionDialog';

describe('PmlAddSectionDialog', () => {
  const noop = () => {};

  it('renders the Components group with a curated section', () => {
    render(
      <PmlAddSectionDialog open onOpenChange={noop} existing={[]} onAdd={noop} partials={[]} />,
    );
    expect(screen.getByText('Components')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hero' })).toBeTruthy();
  });

  it('adds the chosen section node (uses its starter defaults)', () => {
    const onAdd = vi.fn();
    render(
      <PmlAddSectionDialog open onOpenChange={noop} existing={[]} onAdd={onAdd} partials={[]} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hero' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    // The hero now inserts an editable primitive tree (a box), not a {component:'hero'}, so every
    // piece - including the CTA button - is individually selectable and styleable.
    const inserted = onAdd.mock.calls[0][0];
    expect(inserted).toMatchObject({ primitive: 'box' });
    expect((inserted.children ?? []).some((c: { primitive?: string }) => c.primitive === 'button')).toBe(true);
  });

  it('disables a singleton that is already on the page', () => {
    render(
      <PmlAddSectionDialog
        open
        onOpenChange={noop}
        existing={[{ primitive: 'packages' }]}
        onAdd={noop}
        partials={[]}
      />,
    );
    expect((screen.getByRole('button', { name: 'Packages' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers a saved partial under My components and inserts it as a component node', () => {
    const onAdd = vi.fn();
    render(
      <PmlAddSectionDialog
        open
        onOpenChange={noop}
        existing={[]}
        onAdd={onAdd}
        // Saved components are a Scale feature shown in the premium modal, not the standard one.
        variant="premium"
        partials={[
          {
            id: 'p1',
            name: 'My saved band',
            handle: 'my-band',
            params: [{ name: 'heading', label: 'Heading', kind: 'text', default: 'Ready?' }],
            slots: [],
            pml: '',
            updated_at: null,
          },
        ]}
      />,
    );
    expect(screen.getByText('My components')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'My saved band' }));
    // No values yet: each setting shows its default until the page sets one.
    expect(onAdd).toHaveBeenCalledWith({ component: 'my_band', props: {} });
  });

  it('filters by the search query', () => {
    render(
      <PmlAddSectionDialog open onOpenChange={noop} existing={[]} onAdd={noop} partials={[]} />,
    );
    fireEvent.change(screen.getByLabelText('Search sections'), { target: { value: 'hero' } });
    expect(screen.getByRole('button', { name: 'Hero' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Packages' })).toBeNull();
  });
});
