import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { DocumentFinding, DocumentPreflight } from '../../../src/builder/document';
import { FindingsPanel } from '../../../src/builder/editor/FindingsPanel';
import { BuilderHostProvider } from '../../../src/builder/editor/host';

const finding = (over: Partial<DocumentFinding>): DocumentFinding => ({ source: 'pack', severity: 'warn', rule: 'r', message: 'm', excerpt: null, suggestion: null, ...over });

/** What a preflight found (shared program E4a4c): blockers, warnings and structure advice, in the host's words. */
describe('FindingsPanel', () => {
  it('groups blockers and warnings, hides info, and puts structure advice apart', () => {
    const preflight: DocumentPreflight = {
      mayPublish: false,
      findings: [
        finding({ severity: 'block', message: 'Guarantees are not allowed.', excerpt: 'Guaranteed approval' }),
        finding({ severity: 'warn', message: 'Could read as a promise.' }),
        finding({ severity: 'info', message: 'An info note nobody sees.' }),
        finding({ source: 'structure', severity: 'warn', message: 'Use one main title.' }),
      ],
    };
    render(<FindingsPanel preflight={preflight} />);

    expect(screen.getByText('One thing has to change before this can go public')).toBeTruthy();
    expect(screen.getByText('“Guaranteed approval”')).toBeTruthy();
    expect(screen.getByText('Could read as a promise.')).toBeTruthy();
    expect(screen.queryByText('An info note nobody sees.')).toBeNull();
    expect(screen.getByText('Easier to read and find')).toBeTruthy();
    expect(screen.getByText('Use one main title.')).toBeTruthy();
  });

  it('says publishing waits when a check could not run, and is calm when there is nothing to change', () => {
    const { rerender } = render(<FindingsPanel preflight={{ mayPublish: false, findings: [], incomplete: true }} />);
    expect(screen.getByText(/could not fully check this just now/)).toBeTruthy();

    rerender(<FindingsPanel preflight={{ mayPublish: true, findings: [finding({ severity: 'info' })] }} words={{ clean: 'Nothing breaks the rules.' }} />);
    expect(screen.getByText('Nothing breaks the rules.')).toBeTruthy();
  });

  it('copies a suggested rewrite and confirms through the host, or reports a refused clipboard', async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <BuilderHostProvider onSuccess={onSuccess} onError={onError}>
        <FindingsPanel preflight={{ mayPublish: true, findings: [finding({ suggestion: 'We can help you apply.' })] }} />
      </BuilderHostProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy this' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('Rewrite copied.'));
    expect(writeText).toHaveBeenCalledWith('We can help you apply.');

    fireEvent.click(screen.getByRole('button', { name: 'Copy this' }));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });
});
