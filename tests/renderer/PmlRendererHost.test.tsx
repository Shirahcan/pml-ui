import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';

import { PmlRenderer, type PmlHost, type PmlSite } from '../../src/renderer/PmlRenderer';
import { SiteInteractionProvider } from '../../src/renderer/SiteInteractionContext';
import type { PmlNode } from '../../src/pml/primitives';

/**
 * The host seam (E1, shared program): elements whose content belongs to one product (its lead form, its
 * assistant widget, its regulator's badge) are drawn by the host, never by the shared renderer, and an error the
 * page cannot show itself goes to the host's onError.
 */
const site = { username: 'jane-doe' } as PmlSite;

const host: PmlHost = {
  elements: {
    contact_form: ({ props }) => <p data-testid="contact">form {String(props.title ?? '')}</p>,
    credentials: ({ site: s, className }) => <p data-testid="badge" className={className}>badge for {(s as { username: string }).username}</p>,
    porter_intake: () => <p data-testid="intake">intake</p>,
  },
};

describe('PmlRenderer host elements', () => {
  it('draws the host\'s own elements with their props, the site and the element style', () => {
    const nodes: PmlNode[] = [
      { primitive: 'contact_form', props: { title: 'Ask us' } },
      { primitive: 'credentials', props: {} },
      { primitive: 'porter_intake', props: {} },
    ];
    const { getByTestId } = render(<PmlRenderer nodes={nodes} site={site} host={host} />);

    expect(getByTestId('contact').textContent).toBe('form Ask us');
    expect(getByTestId('badge').textContent).toBe('badge for jane-doe');
    expect(getByTestId('intake')).toBeTruthy();
  });

  it('draws nothing for a host element the host does not supply, and no product words of its own', () => {
    const { container } = render(<PmlRenderer nodes={[{ primitive: 'credentials', props: { resolved: { registered_name: 'Jane' } } }]} site={site} />);

    // (The renderer's motion <style> is always there; no badge content is.)
    expect(container.textContent).not.toContain('Jane');
    expect(container.textContent).not.toContain('Regulated');
  });

  it('hands a failed form send to the host\'s onError and still says it in the form', async () => {
    const onError = vi.fn();
    const nodes: PmlNode[] = [{ primitive: 'form', props: { key: 'ask', submit_label: 'Send' }, children: [{ primitive: 'field', props: { name: 'email', label: 'Email', kind: 'email' } }] }];
    const failing = { submitForm: async () => { throw new Error('The server said no.'); } };

    const { container, findByText } = render(
      <SiteInteractionProvider value={failing}>
        <PmlRenderer nodes={nodes} site={site} host={{ onError }} />
      </SiteInteractionProvider>,
    );
    fireEvent.submit(container.querySelector('form')!);

    expect(await findByText('The server said no.')).toBeTruthy();
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });
});
