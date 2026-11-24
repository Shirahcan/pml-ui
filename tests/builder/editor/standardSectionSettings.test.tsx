import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { PmlSettings } from '../../../src/builder/editor/PmlSettings';
import type { PmlNode } from '../../../src/language';
import { elementLabel, PML_CATALOG_BY_NAME, STANDARD_SECTIONS } from '../../../src/language';

/**
 * Shared PML Studio P1a-3d (2026-11-24): a Porter-built post held a process timeline saved as a SECTION, and selecting
 * it read "Reusable component. Its layout is edited under My components." with no fields. A post has no My components,
 * so its heading and each step's title could be changed only in the code.
 */
describe('a standard section saved as a section', () => {
  const timeline = {
    component: 'process_timeline',
    props: { heading: 'The steps' },
    children: [{ component: 'step', props: { title: 'Gather your documents' }, children: [] }],
  } as unknown as PmlNode;

  it('every standard section with no menu entry of its own gets its own panel, from pml-kit\'s list', () => {
    const uncovered = Object.keys(STANDARD_SECTIONS).filter((name) => !PML_CATALOG_BY_NAME[name]);

    expect(uncovered).toEqual(['team', 'member', 'process_timeline', 'step', 'office_map']);
    for (const name of uncovered) {
      expect(elementLabel(name)).not.toBe('Element');
    }
    expect(elementLabel('process_timeline')).toBe('Steps');
    expect(elementLabel('step')).toBe('Step');
  });

  it('shows its words to edit and what it holds, never the site components panel', () => {
    const changes: PmlNode[] = [];
    render(<PmlSettings node={timeline} onChange={(next) => changes.push(next)} onDelete={() => undefined} />);

    expect(screen.getByRole('heading', { name: 'Steps' })).toBeTruthy();
    expect(screen.queryByText(/My components/)).toBeNull();
    expect(screen.queryByText('Reusable component')).toBeNull();

    const heading = screen.getByLabelText('Heading') as HTMLInputElement;
    expect(heading.value).toBe('The steps');

    fireEvent.change(heading, { target: { value: 'How to apply' } });
    expect(changes.at(-1)?.props).toEqual({ heading: 'How to apply' });
    expect(changes.at(-1)?.children).toEqual((timeline as { children: unknown }).children);
  });

  it('a step edits its title, and a section with no contents lists none', () => {
    const changes: PmlNode[] = [];
    const { unmount } = render(
      <PmlSettings node={{ component: 'step', props: { title: 'Apply' }, children: [] } as unknown as PmlNode} onChange={(next) => changes.push(next)} onDelete={() => undefined} />,
    );

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '' } });
    expect(changes.at(-1)?.props).toEqual({});
    unmount();

    render(<PmlSettings node={{ component: 'office_map', props: { heading: 'Visit us' } } as unknown as PmlNode} onChange={() => undefined} onDelete={() => undefined} />);
    expect(screen.getByLabelText('Address')).toBeTruthy();
    expect(screen.getByText('A standard section. Set its words here.')).toBeTruthy();
  });

  it('a website\'s own section still opens the site components panel', () => {
    render(<PmlSettings node={{ component: 'site_band', props: {} } as unknown as PmlNode} onChange={() => undefined} onDelete={() => undefined} />);

    expect(screen.getByText('Reusable component')).toBeTruthy();
  });
});
