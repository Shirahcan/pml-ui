'use client';

import React, { useId, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../ui/controls';
import { ParamField } from './StudioComponentSettings';
import { type StudioSlot } from '../components';
import { useCatalogPartial as useSitePartial } from './catalog';
import { type PmlNode } from '../../language';
import { ContainerContents } from './settingsContents';
import { inSlot } from './settingsFields';
/**
 * The elements a page puts in a component's slots (component props p07c): one list for a single unnamed
 * slot, else one list per named place, each element marked with its slot. Shared by Portify components and
 * the site's own components, so both fill their places the same way.
 */
export function SlotContents({
  node,
  slots,
  onChange,
  canAuthorPml,
  hideAdd,
}: {
  node: PmlNode;
  slots: StudioSlot[];
  onChange: (next: PmlNode) => void;
  canAuthorPml?: boolean;
  hideAdd?: boolean;
}): React.JSX.Element | null {
  const children = node.children ?? [];

  if (slots.length === 0) return null;

  if (slots.length === 1 && slots[0].name === '') {
    return <ContainerContents parent={node} nodes={children} onChange={(next) => onChange({ ...node, children: next })} canAuthorPml={canAuthorPml} hideAdd={hideAdd} />;
  }

  return (
    <div className="space-y-4">
      {slots.map((slot) => (
        <div key={slot.name || 'default'} className="space-y-2">
          <p className="text-xs font-semibold text-slate-700">{slot.label}</p>
          <ContainerContents
            parent={node}
            nodes={children.filter((child) => (child.slot ?? '') === slot.name)}
            onChange={(next) => onChange({ ...node, children: [...children.filter((child) => (child.slot ?? '') !== slot.name), ...next.map((child) => inSlot(child, slot.name))] })}
            canAuthorPml={canAuthorPml}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * The rail for one of the site's own components (partials). Its layout lives in the My components library;
 * on a page we set its declared settings with the same controls a Portify component's take (a number, yes or
 * no, formatted text, a list...), and fill its slots. An emptied setting falls back to its default.
 */
export function PartialSettings({
  node,
  onChange,
  onDelete,
  deleteLabel = 'Delete section',
  canAuthorPml,
  hideAdd,
}: {
  node: PmlNode;
  onChange: (next: PmlNode) => void;
  onDelete: () => void;
  deleteLabel?: string;
  canAuthorPml?: boolean;
  hideAdd?: boolean;
}): React.JSX.Element {
  const partial = useSitePartial(node.component);
  const props = (node.props ?? {}) as Record<string, unknown>;
  const params = partial?.params ?? [];

  const setProp = (name: string, value: unknown) => {
    const next = { ...props };

    if (value === '' || value === undefined || value === null) delete next[name];
    else next[name] = value;

    onChange({ ...node, props: next });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{partial?.name ?? 'Reusable component'}</h3>
        <p className="text-xs text-[var(--pb-muted)]">
          {partial ? 'Its layout is edited under My components. Set it up for this page here.' : 'Its layout is edited under My components.'}
        </p>
      </div>

      {partial && params.length === 0 ? <p className="text-xs text-[var(--pb-muted)]">This component has no settings.</p> : null}

      {params.map((param) => (
        <ParamField key={param.name} param={param} value={props[param.name]} onChange={(value) => setProp(param.name, value)} />
      ))}

      <SlotContents node={node} slots={partial?.slots ?? []} onChange={onChange} canAuthorPml={canAuthorPml} hideAdd={hideAdd} />

      <div className="border-t border-white/10 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onDelete}
          className="w-full whitespace-nowrap text-red-600 outline-none"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteLabel}
        </Button>
      </div>
    </div>
  );
}
