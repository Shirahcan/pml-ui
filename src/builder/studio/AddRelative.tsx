'use client';

import React, { useState, type ReactNode } from 'react';
import { ArrowDownToLine, ArrowUpToLine, ChevronDown, CornerDownRight, Plus, type LucideIcon } from 'lucide-react';

import { elementLabel, getNodeAtPath, insertRelative, placementsFor, type Placement, type PmlGroup, type PmlNode } from '../../language';
import { useCatalog } from '../editor/catalog';
import { useBuilderHost } from '../editor/host';
import { PmlAddSectionDialog } from '../editor/PmlAddSectionDialog';
import { Button } from '../ui/controls';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/overlays';

/**
 * Adding an element relative to the selected one: before it, inside it, or after it (shared PML Studio P3b1, the
 * site creator's "Add an element" for every profile). Only the spots the containment rules allow are offered, so the
 * save never refuses an add.
 */

export const PLACEMENT_WORDS: Record<Placement, { label: string; icon: LucideIcon }> = {
  before: { label: 'Before this', icon: ArrowUpToLine },
  inside: { label: 'Inside this', icon: CornerDownRight },
  after: { label: 'After this', icon: ArrowDownToLine },
};

/** What a nested spot offers: a container takes the basic pieces and layouts, never a whole section. */
const NESTED_GROUPS: PmlGroup[] = ['basic', 'layout', 'portify-components'];

/**
 * A container built by structure rather than from the picker gets its one kind of child directly: a table a row (as
 * wide as its widest row), a row a cell, a form a field.
 */
export function structuredChild(parent: PmlNode | null): PmlNode | null {
  const children = parent?.children ?? [];

  switch (parent?.primitive) {
    case 'table':
      return {
        primitive: 'row',
        children: Array.from({ length: Math.max(2, ...children.map((row) => (row.children ?? []).length)) }, () => ({ primitive: 'cell', children: [] })),
      } as PmlNode;
    case 'row':
      return { primitive: 'cell', children: [] } as PmlNode;
    case 'form':
      return { primitive: 'field', props: { name: `field_${children.length + 1}`, label: 'New field', kind: 'text' } } as PmlNode;
    default:
      return null;
  }
}

export interface AddRelative {
  /** The spots the element at `path` offers (none for a comment). */
  placements: (path: number[]) => Placement[];
  /** Add at that spot: a structured child goes in at once, anything else opens the picker for that spot. */
  open: (path: number[], placement: Placement) => void;
  /** The picker, mounted once by the editor. */
  dialog: ReactNode;
  /** The element's name as a person says it ("heading"). */
  nameOf: (path: number[]) => string;
}

export function useAddRelative({
  nodes,
  change,
  select,
  unavailable,
  oneRoot = false,
}: {
  nodes: PmlNode[];
  change: (next: PmlNode[]) => void;
  select: (path: number[] | null) => void;
  /** What this document may not hold (the profile's), never offered. */
  unavailable: readonly string[];
  /**
   * The document is ONE outer element (a reusable component, P3c-6): nothing is offered before or after it, so an
   * addition always lands inside the element a page writes as one tag.
   */
  oneRoot?: boolean;
}): AddRelative {
  const studio = useCatalog();
  const { onError } = useBuilderHost();
  const [picking, setPicking] = useState<{ path: number[]; placement: Placement } | null>(null);

  const nameOf = (path: number[]): string => {
    const node = getNodeAtPath(nodes, path);

    return elementLabel(node?.component ?? node?.primitive ?? '', studio).toLowerCase();
  };

  const place = (path: number[], placement: Placement, added: PmlNode) => {
    const placed = insertRelative(nodes, path, added, placement);

    if (!placed) {
      onError(new Error(`That element cannot go ${placement === 'inside' ? 'inside' : placement} this ${nameOf(path)}. Pick another spot, or another element.`));

      return;
    }

    change(placed.nodes);
    select(placed.path);
  };

  const open = (path: number[], placement: Placement) => {
    const node = getNodeAtPath(nodes, path);

    if (!node) return;

    const parent = placement === 'inside' ? node : path.length > 1 ? getNodeAtPath(nodes, path.slice(0, -1)) : null;
    const ready = structuredChild(parent);

    if (ready) place(path, placement, ready);
    else setPicking({ path, placement });
  };

  const topLevel = picking !== null && picking.placement !== 'inside' && picking.path.length === 1;

  return {
    placements: (path) => placementsFor(nodes, path).filter((p) => !(oneRoot && path.length === 1 && p !== 'inside')),
    open,
    nameOf,
    dialog: (
      <PmlAddSectionDialog
        open={picking !== null}
        onOpenChange={(isOpen) => !isOpen && setPicking(null)}
        existing={topLevel ? nodes : []}
        unavailable={[...unavailable]}
        groups={topLevel ? undefined : NESTED_GROUPS}
        title={picking ? `Add an element ${PLACEMENT_WORDS[picking.placement].label.toLowerCase()} ${nameOf(picking.path)}` : 'Add an element'}
        description={topLevel ? 'A section, a layout, or a single piece.' : 'Pick something to place there.'}
        onAdd={(added) => {
          if (picking) place(picking.path, picking.placement, added);
          setPicking(null);
        }}
      />
    ),
  };
}

/** The selected element's "Add an element": one spot is a button; several are a menu of Before / Inside / After. */
export function AddRelativeButton({ placements, name, onChoose }: { placements: Placement[]; name: string; onChoose: (placement: Placement) => void }): React.JSX.Element | null {
  if (placements.length === 0) return null;

  if (placements.length === 1) {
    const only = placements[0];

    return (
      <Button type="button" variant="outline" className="w-full whitespace-nowrap border-dashed outline-none" onClick={() => onChoose(only)}>
        <Plus className="h-4 w-4" aria-hidden />
        Add an element {PLACEMENT_WORDS[only].label.toLowerCase()} {name}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="w-full whitespace-nowrap border-dashed outline-none">
          <Plus className="h-4 w-4" aria-hidden />
          Add an element
          <ChevronDown className="ml-auto h-4 w-4 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" data-builder-keep-panel="">
        {placements.map((placement) => {
          const Icon = PLACEMENT_WORDS[placement].icon;

          return (
            <DropdownMenuItem key={placement} onSelect={() => onChoose(placement)}>
              <Icon aria-hidden />
              {PLACEMENT_WORDS[placement].label} {name}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
