import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { DraftConflictDialog } from '../../../src/builder/editor/DraftConflictDialog';
import { assistantsLabel, BuilderHostProvider } from '../../../src/builder/editor/host';
import { PlaceholdersLeftNotice } from '../../../src/builder/editor/PlaceholdersLeftNotice';
import { PmlDiffView } from '../../../src/builder/editor/PmlDiffView';
import { PmlProblemsPanel } from '../../../src/builder/editor/PmlProblemsPanel';
import { Button } from '../../../src/builder/ui/controls';
import { BuilderThemeProvider } from '../../../src/builder/ui/theme';
import type { PmlDiagnostic } from '../../../src/pml/diagnostics';

/** The editor's small panels in the package (shared program E4a4b), moved from Portify with their tests. */
describe('PmlDiffView', () => {
  const before = '<hero headline="Old"/>\n<footer/>';
  const after = '<hero headline="New"/>\n<footer/>';

  it('marks the added line add and the removed line del', () => {
    render(<PmlDiffView before={before} after={after} onAccept={vi.fn()} onDiscard={vi.fn()} />);

    expect(screen.getByText('<hero headline="New"/>').closest('[data-diff-type]')?.getAttribute('data-diff-type')).toBe('add');
    expect(screen.getByText('<hero headline="Old"/>').closest('[data-diff-type]')?.getAttribute('data-diff-type')).toBe('del');
  });

  it('fires onAccept and onDiscard', () => {
    const onAccept = vi.fn();
    const onDiscard = vi.fn();
    render(<PmlDiffView before={before} after={after} onAccept={onAccept} onDiscard={onDiscard} />);

    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    fireEvent.click(screen.getByRole('button', { name: /discard/i }));

    expect(onAccept).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('with nothing changed offers Discard only, naming the host assistant when it has one', () => {
    const { rerender } = render(<PmlDiffView before={before} after={before} onAccept={vi.fn()} onDiscard={vi.fn()} />);

    expect(screen.getByText(/no changes/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
    expect(screen.getByText(/The proposed version is identical/)).toBeTruthy();

    rerender(
      <BuilderHostProvider assistantName="Porter">
        <PmlDiffView before={before} after={before} onAccept={vi.fn()} onDiscard={vi.fn()} />
      </BuilderHostProvider>,
    );
    expect(screen.getByText(/Porter's version is identical/)).toBeTruthy();
  });
});

describe('PmlProblemsPanel', () => {
  const diags: PmlDiagnostic[] = [
    { severity: 'warning', message: 'PSL: undefined variable', line: 5, col: 3, source: 'psl' },
    { severity: 'error', message: 'Unknown component "nope".', line: 2, col: 1, source: 'compile' },
  ];

  it('lists errors first and jumps to the clicked line', () => {
    const onJump = vi.fn();
    render(<PmlProblemsPanel diagnostics={diags} onJump={onJump} />);

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Unknown component');

    fireEvent.click(screen.getByText('Unknown component "nope".'));
    expect(onJump).toHaveBeenCalledWith(2, 1);
  });

  it('says so calmly when there is nothing wrong', () => {
    render(<PmlProblemsPanel diagnostics={[]} onJump={vi.fn()} />);

    expect(screen.getByText(/No problems/i)).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('DraftConflictDialog', () => {
  it('lets the author keep their version or load the other one', () => {
    const keep = vi.fn();
    const load = vi.fn();
    render(<DraftConflictDialog open onKeepMine={keep} onLoadLatest={load} noun="email" />);

    expect(screen.getByRole('alertdialog', { name: 'This email was changed somewhere else' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep mine' }));
    expect(keep).toHaveBeenCalledTimes(1);
  });

  it('offers only "Load the latest" when there is nothing of the author to keep', () => {
    const load = vi.fn();
    render(<DraftConflictDialog open onLoadLatest={load} />);

    expect(screen.queryByRole('button', { name: 'Keep mine' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Load the latest' }));
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('PlaceholdersLeftNotice', () => {
  it('counts the placeholders and quotes the notes under the host assistant name', () => {
    render(
      <BuilderHostProvider assistantName="Mira">
        <PlaceholdersLeftNotice message="Replace them, then publish." left={{ total: 2, examples: ['Add a team photo'] }} />
      </BuilderHostProvider>,
    );

    expect(screen.getByRole('status').textContent).toContain('2 placeholders are still showing');
    expect(screen.getByText("Mira's note: Add a team photo")).toBeTruthy();
  });
});

describe('the host and the theme without a provider', () => {
  it('names no one when the host has no assistant', () => {
    expect(assistantsLabel(undefined, 'note', 'Note')).toBe('Note');
    expect(assistantsLabel('  ', 'note', 'Note')).toBe('Note');
    expect(assistantsLabel('Reeve', 'note', 'Note')).toBe("Reeve's note");
  });

  it('a control outside any provider carries the default colours; inside one it leaves them to the provider', () => {
    const { rerender } = render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('style')).toContain('--pb-accent: #4361EE');

    rerender(
      <BuilderThemeProvider theme={{ accent: '#123456' }}>
        <Button>Save</Button>
      </BuilderThemeProvider>,
    );
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('style')).toBeNull();
  });
});
