'use client';

import React, { useId, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, Plus } from 'lucide-react';
import { Button } from '../ui/controls';
import { PmlAddSectionDialog } from './PmlAddSectionDialog';
import { useStudioAuthoring } from './authoring';
import { useCatalog as useStudioCatalog } from './catalog';
import { contentsLabel } from '../../language';
import { type PmlNode } from '../../language';
import { PmlSettings } from './PmlSettings';
export function ContainerContents({
  parent,
  nodes,
  onChange,
  canAuthorPml,
  hideAdd = false,
}: {
  parent: PmlNode;
  nodes: PmlNode[];
  onChange: (children: PmlNode[]) => void;
  canAuthorPml?: boolean;
  /** The creator's Add menu handles adding, so this list only shows and orders the contents. */
  hideAdd?: boolean;
}): React.JSX.Element {
  const [addOpen, setAddOpen] = useState(false);
  const studioCatalog = useStudioCatalog();

  // A grid's direct children can span columns/rows; nothing else can. Cap span choices at the
  // grid's real column count (12 is the largest grid, S2-04).
  const gridColumns =
    parent.primitive === 'grid'
      ? Math.min(Math.max(Number((parent.props as Record<string, unknown> | undefined)?.columns) || 2, 1), 12)
      : null;

  // Tables build by structure, not the free element picker: a <table> takes rows (seeded with the
  // current column count so the grid stays rectangular) and a <row> takes cells. A cell's contents,
  // and box/grid children, use the ordinary Basic+Layout picker.
  const addRow = () => {
    const columns = Math.max(2, ...nodes.map((r) => (r.children ?? []).length));
    onChange([
      ...nodes,
      {
        primitive: 'row',
        children: Array.from({ length: columns }, () => ({ primitive: 'cell', children: [] })),
      },
    ]);
  };
  const addCell = () => onChange([...nodes, { primitive: 'cell', children: [] }]);
  const authoring = useStudioAuthoring();

  // A form builds by adding fields (each edited by the recursive rail below), the same way a table
  // builds by rows. Layout inside a form (a box/grid of fields) is an advanced Code-pane/Porter case.
  const addField = () =>
    onChange([
      ...nodes,
      { primitive: 'field', props: { name: `field_${nodes.length + 1}`, label: 'New field', kind: 'text' } },
    ]);

  const structuredAdd =
    parent.primitive === 'table'
      ? { label: 'Add row', run: addRow }
      : parent.primitive === 'row'
        ? { label: 'Add column', run: addCell }
        : parent.primitive === 'form'
          ? { label: 'Add field', run: addField }
          : null;

  const setChild = (index: number, next: PmlNode) =>
    onChange(nodes.map((child, i) => (i === index ? next : child)));

  const move = (index: number, to: number) => {
    if (to < 0 || to >= nodes.length) return;

    const copy = [...nodes];
    [copy[index], copy[to]] = [copy[to], copy[index]];
    onChange(copy);
  };

  return (
    <div className="border-t border-white/10 pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--pb-muted)]">
        Contents
      </p>

      {nodes.length === 0 ? (
        <p className="mb-2 text-xs text-[var(--pb-muted)]">
          Empty. Add an element to start building this layout.
        </p>
      ) : null}

      <div className="space-y-2">
        {nodes.map((child, index) => {
          const childName = child.component ?? child.primitive ?? '';
          const childLabel = childName === 'slot' ? 'Space for page content' : contentsLabel(child, studioCatalog);

          return (
            <ContentRow
              key={index}
              label={`${index + 1}. ${childLabel}`}
              canMoveUp={index > 0}
              canMoveDown={index < nodes.length - 1}
              onMoveUp={() => move(index, index - 1)}
              onMoveDown={() => move(index, index + 1)}
            >
              <PmlSettings
                node={child}
                onChange={(next) => setChild(index, next)}
                onDelete={() => onChange(nodes.filter((_, i) => i !== index))}
                canAuthorPml={canAuthorPml}
                deleteLabel="Remove element"
                spanContext={gridColumns !== null ? { columns: gridColumns } : undefined}
              />
            </ContentRow>
          );
        })}
      </div>

      {hideAdd ? null : (
      <Button
        type="button"
        variant="outline"
        onClick={() => (structuredAdd ? structuredAdd.run() : setAddOpen(true))}
        className="mt-3 w-full whitespace-nowrap border-dashed outline-none"
      >
        <Plus className="mr-2 h-4 w-4" />
        {structuredAdd ? structuredAdd.label : 'Add an element'}
      </Button>
      )}

      {authoring && !authoring.hasSlot && !structuredAdd ? (
        <Button type="button" variant="outline" onClick={() => onChange([...nodes, { component: 'slot' }])} className="mt-2 w-full whitespace-nowrap border-dashed outline-none">
          <Plus className="mr-2 h-4 w-4" />
          Let each page add its own elements here
        </Button>
      ) : null}

      {structuredAdd || hideAdd ? null : (
        <PmlAddSectionDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          existing={[]}
          onAdd={(added) => onChange([...nodes, added])}
          groups={['basic', 'layout', 'portify-components']}
          title="Add an element"
          description="Pick something to place inside this layout."
        />
      )}
    </div>
  );
}

/**
 * One element inside a container, folded until opened. The toggle and the move buttons are siblings in
 * a header row: a button inside a <summary> is invalid, and a screen reader announces it badly.
 */
export function ContentRow({
  label,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  children,
}: {
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const body = `pml-row-${useId()}`;

  return (
    <div className="rounded-xl border border-white/20 bg-white/40">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={body}
          onClick={() => setOpen(!open)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-medium outline-none"
        >
          <ChevronRight aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
          <span className="min-w-0 truncate">{label}</span>
        </button>
        <span className="flex shrink-0 items-center gap-1">
          <button type="button" aria-label={`Move ${label} up`} disabled={!canMoveUp} onClick={onMoveUp} className="rounded p-1 outline-none hover:bg-black/5 disabled:opacity-30">
            <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          <button type="button" aria-label={`Move ${label} down`} disabled={!canMoveDown} onClick={onMoveDown} className="rounded p-1 outline-none hover:bg-black/5 disabled:opacity-30">
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
      {open ? (
        <div id={body} className="border-t border-white/10 p-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
