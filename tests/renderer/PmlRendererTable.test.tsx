import React from 'react';
import { render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';

const site = { theme: {} } as unknown as PublicSite;

const table: PmlNode = {
  primitive: 'table',
  props: { caption: 'Fees' },
  children: [
    {
      primitive: 'row',
      children: [
        { primitive: 'cell', props: { header: true }, children: [{ primitive: 'text', props: { value: 'Service' } }] },
        { primitive: 'cell', props: { header: true }, style: { col_span: '2' }, children: [{ primitive: 'text', props: { value: 'Detail' } }] },
      ],
    },
    {
      primitive: 'row',
      children: [
        { primitive: 'cell', children: [{ primitive: 'text', props: { value: 'Study permit' } }] },
        { primitive: 'cell', children: [{ primitive: 'text', props: { value: '$2,500' } }] },
      ],
    },
  ],
};

describe('table renderer', () => {
  it('renders a real table with a caption, header cells, and data cells', () => {
    const { container } = render(<PmlRenderer nodes={[table]} site={site} />);

    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelector('caption')?.textContent).toBe('Fees');
    // Header cells render <th>, data cells render <td>.
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('td')).toHaveLength(2);
    expect(container.querySelectorAll('tr')).toHaveLength(2);
  });

  it('maps a cell col_span to the real colSpan attribute', () => {
    const { container } = render(<PmlRenderer nodes={[table]} site={site} />);

    const spanned = Array.from(container.querySelectorAll('th')).find((th) => th.getAttribute('colspan'));
    expect(spanned?.getAttribute('colspan')).toBe('2');
  });

  it('wraps the table in an x-scroller so a wide table never breaks the page', () => {
    const { container } = render(<PmlRenderer nodes={[table]} site={site} />);
    expect(container.querySelector('.overflow-x-auto table')).not.toBeNull();
  });
});
