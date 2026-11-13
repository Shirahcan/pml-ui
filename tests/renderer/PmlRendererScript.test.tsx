import React from 'react';
import { render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';
import type { Program } from '../../src/psl';

/**
 * The `<script>` primitive is a behaviour leaf: it renders NOTHING, executes only when the page opts
 * in (enableScripts), and a fault inside it must never take the page down. PML also never emits a raw
 * `<script>` element - the tag compiles to a React component, not markup. These pin all four.
 */
const site = { theme: {} } as unknown as PublicSite;
const at = { line: 1, col: 1 };

/** `function greet() { return 1 }` - a well-formed program that defines a function and shows nothing. */
const VALID: Program = {
  ...at,
  type: 'Program',
  body: [
    {
      ...at,
      type: 'FuncDecl',
      name: 'greet',
      params: [],
      returnType: null,
      body: { ...at, type: 'Block', body: [{ ...at, type: 'Return', value: { ...at, type: 'NumberLit', value: '1' } }] },
    },
  ],
};

/** `return missing()` - calls an undefined name, so the runtime soft-fails (must not throw at the page). */
const FAULTING: Program = {
  ...at,
  type: 'Program',
  body: [
    {
      ...at,
      type: 'Return',
      value: { ...at, type: 'Call', callee: { ...at, type: 'Identifier', name: 'missing' }, args: [] },
    },
  ],
};

const heading = (text: string): PmlNode => ({ primitive: 'heading', props: { text, level: 2 } });
const script = (program: Program): PmlNode => ({ primitive: 'script', props: { program } });

describe('PmlRenderer <script> primitive', () => {
  it('renders nothing for a script but still renders sibling content when scripts are enabled', () => {
    const { container } = render(<PmlRenderer nodes={[script(VALID), heading('Visible')]} site={site} enableScripts />);

    expect(container.querySelector('h2')?.textContent).toBe('Visible');
    // PML never emits a raw <script> element; the tag is a React component that renders nothing.
    expect(container.querySelector('script')).toBeNull();
  });

  it('does not crash the page when a script faults - siblings still render', () => {
    const { container } = render(<PmlRenderer nodes={[script(FAULTING), heading('Still here')]} site={site} enableScripts />);

    expect(container.querySelector('h2')?.textContent).toBe('Still here');
  });

  it('is inert in the builder (no runtime provided): the script renders nothing and siblings render', () => {
    const { container } = render(<PmlRenderer nodes={[script(VALID), heading('Editing')]} site={site} />);

    expect(container.querySelector('h2')?.textContent).toBe('Editing');
    expect(container.querySelector('script')).toBeNull();
  });
});
