'use client';

import React, { useMemo } from 'react';
import { Check, X } from 'lucide-react';

import { lineDiff, type DiffRow } from '../../pml/diff';
import { Button } from '../ui/controls';
import { cx, useOwnVars } from '../ui/theme';
import { assistantsLabel, useBuilderHost } from './host';

/**
 * A unified red/green line diff with Accept / Discard, shared by both AI edit paths (the whole-page copilot and a
 * selection edit). Every assistant edit is review-then-accept: the author sees exactly what changed before it
 * touches the buffer, so a rewrite can never silently repurpose an element.
 *
 * A self-contained flex column (a pinned header with the counts and Accept / Discard over a scrolling body), so it
 * fills whatever frame it is given and its controls stay reachable on a short screen. The code pane mounts it as an
 * overlay inside the editor frame (`className`: `h-full`, borderless, opaque).
 */
export function PmlDiffView({
  before,
  after,
  onAccept,
  onDiscard,
  title = 'Proposed change',
  className,
}: {
  before: string;
  after: string;
  onAccept: () => void;
  onDiscard: () => void;
  title?: string;
  className?: string;
}): React.JSX.Element {
  const { assistantName } = useBuilderHost();
  const vars = useOwnVars();
  const rows = useMemo(() => lineDiff(before, after), [before, after]);
  const unchanged = before === after;
  const addCount = rows.filter((r) => r.type === 'add').length;
  const delCount = rows.filter((r) => r.type === 'del').length;

  return (
    <div
      style={vars}
      className={cx('flex flex-col overflow-hidden rounded-xl border border-[var(--pb-border)] bg-white/70 text-[var(--pb-text)] shadow-sm backdrop-blur', className)}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--pb-border)] px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{title}</span>
          {unchanged ? (
            <span className="text-xs text-[var(--pb-muted)]">No changes</span>
          ) : (
            <span className="text-xs tabular-nums">
              <span className="text-emerald-600">+{addCount}</span> <span className="text-red-600">-{delCount}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onDiscard}>
            <X className="h-3.5 w-3.5" />
            Discard
          </Button>
          {!unchanged ? (
            <Button size="sm" onClick={onAccept}>
              <Check className="h-3.5 w-3.5" />
              Accept
            </Button>
          ) : null}
        </div>
      </div>

      {unchanged ? (
        <div className="px-3 py-6 text-center text-sm text-[var(--pb-muted)]">
          {assistantsLabel(assistantName, 'version', 'The proposed version')} is identical to your current code. Nothing to apply.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto" data-testid="pml-diff-body">
          <div className="min-w-max font-mono text-xs leading-5">
            {rows.map((row, i) => (
              <DiffLine key={i} row={row} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DiffLine({ row }: { row: DiffRow }): React.JSX.Element {
  const marker = row.type === 'add' ? '+' : row.type === 'del' ? '-' : ' ';

  return (
    <div
      data-diff-type={row.type}
      className={cx(
        'flex',
        row.type === 'add' && 'bg-emerald-500/10 text-emerald-700',
        row.type === 'del' && 'bg-red-500/10 text-red-700',
        row.type === 'same' && 'text-[var(--pb-muted)]',
      )}
    >
      <span className="w-10 shrink-0 select-none px-1 text-right tabular-nums text-[var(--pb-muted)] opacity-50">{row.oldLine ?? ''}</span>
      <span className="w-10 shrink-0 select-none px-1 text-right tabular-nums text-[var(--pb-muted)] opacity-50">{row.newLine ?? ''}</span>
      <span className={cx('w-4 shrink-0 select-none text-center', row.type === 'add' && 'text-emerald-600', row.type === 'del' && 'text-red-500')}>
        {marker}
      </span>
      {/* whitespace-pre keeps leading indentation exact; the outer body scrolls x for long lines. */}
      <span className="whitespace-pre px-2">{row.text === '' ? ' ' : row.text}</span>
    </div>
  );
}
