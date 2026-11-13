import React from 'react';
import { render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';

/**
 * PML v3 L5 through the real renderer: the block elements draw their real tags, a code block is escaped
 * text that never runs, and a disclosure's <summary> stays a DIRECT child of its <details> even in the
 * builder (where every other child is wrapped in a path mark), or the browser would not use it.
 */
const site = { theme: {} } as unknown as PublicSite;
const run = (value: string): PmlNode => ({ primitive: 'text', props: { value } });
const words = (primitive: string, value: string, extra: PmlNode[] = []): PmlNode => ({ primitive, children: [run(value), ...extra] }) as PmlNode;

const page: PmlNode[] = [
  { primitive: 'pre', props: { language: 'html', text: '<script>alert(1)</script>' } },
  { primitive: 'blockquote', props: { cite: 'https://www.canada.ca/en.html' }, children: [words('p', 'Plan early.')] },
  {
    primitive: 'details',
    props: { open: true },
    children: [words('summary', 'What is ', [{ primitive: 'strong', children: [run('biometrics')] }]), words('p', 'Fingerprints and a photo.')],
  },
  { primitive: 'definitions', children: [words('term', 'LMIA'), { primitive: 'definition', children: [words('p', 'A labour market impact assessment.')] }] },
  { primitive: 'figure', children: [{ primitive: 'pre', props: { text: 'npm test' } }, words('caption', 'Run the tests.')] },
];

describe('PmlRenderer block elements (PML v3 L5)', () => {
  it('draws each element with its real tag', () => {
    const { container } = render(<PmlRenderer nodes={page} site={site} />);

    expect(container.querySelector('pre code')?.textContent).toBe('<script>alert(1)</script>');
    expect(container.querySelector('pre script')).toBeNull();
    expect(container.querySelector('blockquote')?.getAttribute('cite')).toBe('https://www.canada.ca/en.html');
    expect(container.querySelector('details')?.hasAttribute('open')).toBe(true);
    expect(container.querySelector('details > summary')?.textContent).toBe('What is biometrics');
    expect(container.querySelector('details > summary strong')?.textContent).toBe('biometrics');
    expect(container.querySelector('dl dt')?.textContent).toBe('LMIA');
    expect(container.querySelector('dl dd p')?.textContent).toBe('A labour market impact assessment.');
    expect(container.querySelector('figure figcaption')?.textContent).toBe('Run the tests.');
  });

  it('keeps the summary and the caption direct children in the builder, still marked', () => {
    const { container } = render(<PmlRenderer nodes={page} site={site} builderHints pathRoot={[0]} />);

    const summary = container.querySelector('details > summary');
    expect(summary).not.toBeNull();
    expect(summary?.getAttribute('data-pml-path')).not.toBeNull();
    expect(container.querySelector('figure > figcaption')?.getAttribute('data-pml-path')).not.toBeNull();
    expect(summary?.querySelector('div')).toBeNull();
  });
});
