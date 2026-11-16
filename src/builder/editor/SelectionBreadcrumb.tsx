'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';

import { elementLabel } from '../../language';
import { getNodeAtPath } from '../../language';
import type { PmlNode } from '../../language';
import { useOwnVars } from '../ui/theme';
import { useCatalog } from './catalog';

/**
 * Where the selected element sits, from its section down. Clicking a step selects it, so an element
 * nested in a card is one click from the card, and the card one click from its section.
 */
export function SelectionBreadcrumb({
  nodes,
  path,
  onSelect,
}: {
  nodes: PmlNode[];
  path: number[];
  onSelect: (path: number[]) => void;
}): React.JSX.Element | null {
  const catalog = useCatalog();
  const vars = useOwnVars();

  if (path.length < 2) return null;

  const steps = path.map((_, i) => {
    const stepPath = path.slice(0, i + 1);
    const node = getNodeAtPath(nodes, stepPath);
    const name = node?.component ?? node?.primitive ?? '';

    return { path: stepPath, label: elementLabel(name, catalog) };
  });

  return (
    <nav aria-label="Selected element" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-slate-500" style={vars}>
      {steps.map((step, i) => (
        <React.Fragment key={step.path.join('.')}>
          {i > 0 ? <ChevronRight aria-hidden="true" className="h-3 w-3 opacity-60" /> : null}
          {i === steps.length - 1 ? (
            <span aria-current="location" className="font-semibold text-slate-900">
              {step.label}
            </span>
          ) : (
            <button type="button" onClick={() => onSelect(step.path)} className="whitespace-nowrap rounded outline-none hover:text-[var(--pb-accent)]">
              {step.label}
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
