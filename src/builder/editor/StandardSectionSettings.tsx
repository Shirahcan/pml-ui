'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../ui/controls';
import type { StudioParam, StudioParamKind } from '../components';
import { STANDARD_SECTIONS, standardSectionName, type PmlNode, type PmlStandardSection } from '../../language';
import { ParamField } from './StudioComponentSettings';
import { SlotContents } from './settingsContentsSlots';

/**
 * A stored STANDARD section (pml-kit's StandardLibrary: a process timeline, a team, an office map...) that has no menu
 * entry of its own, edited in the settings panel: its words, and what it holds.
 *
 * ⚠ WHY (shared PML Studio P1a-3d, 2026-11-24). A new section is added as plain elements, so only a section saved as a
 * section (a Porter-built post's process timeline, an older page) reaches here. With no catalog entry it fell through
 * to the site's own components and read "Reusable component. Its layout is edited under My components." with no
 * fields: a post has no My components, so an admin could not change "The steps" or a step's title anywhere but the
 * code. The settings each section takes come from pml-kit (STANDARD_SECTIONS, generated), never a copy kept here; only
 * the words naming them are this panel's.
 */

/** The words for each setting, and the field it is typed in. */
const SETTINGS: Record<string, { label: string; kind: StudioParamKind; help?: string }> = {
  headline: { label: 'Headline', kind: 'text' },
  subhead: { label: 'Line under the headline', kind: 'long_text' },
  heading: { label: 'Heading', kind: 'text' },
  title: { label: 'Title', kind: 'text' },
  body: { label: 'Text', kind: 'long_text' },
  message: { label: 'Message', kind: 'long_text' },
  note: { label: 'Note', kind: 'long_text' },
  name: { label: 'Name', kind: 'text' },
  role: { label: 'Role', kind: 'text' },
  value: { label: 'Figure', kind: 'text', help: 'The number or amount, as readers should see it (for example 98% or $1,000).' },
  label: { label: 'What the figure is', kind: 'text' },
  address: { label: 'Address', kind: 'long_text' },
  image_url: { label: 'Image', kind: 'image' },
  image_alt: { label: 'Image description', kind: 'text', help: 'What the image shows, for people who cannot see it.' },
  photo_url: { label: 'Photo', kind: 'image' },
  photo_alt: { label: 'Photo description', kind: 'text', help: 'What the photo shows, for people who cannot see it.' },
  cta_label: { label: 'Button words', kind: 'text' },
  cta_href: { label: 'Button link', kind: 'url' },
};

/** The standard section a node is, when it is one (pml-kit's list, not a copy). */
export function standardSectionOf(node: PmlNode): PmlStandardSection | undefined {
  return node.component ? STANDARD_SECTIONS[node.component] : undefined;
}

/** One setting as the settings field takes it. */
export function standardParam(name: string): StudioParam {
  const known = SETTINGS[name];

  return { name, label: known?.label ?? standardSectionName(name), kind: known?.kind ?? 'text', help: known?.help ?? null };
}

export function StandardSectionSettings({
  node,
  section,
  onChange,
  onDelete,
  deleteLabel,
  canAuthorPml,
  hideAdd,
}: {
  node: PmlNode;
  section: PmlStandardSection;
  onChange: (next: PmlNode) => void;
  onDelete: () => void;
  deleteLabel?: string;
  canAuthorPml?: boolean;
  hideAdd?: boolean;
}): React.JSX.Element {
  const props = (node.props ?? {}) as Record<string, unknown>;
  const name = standardSectionName(node.component ?? '');

  const setProp = (key: string, value: unknown) => {
    const next = { ...props };

    if (value === '' || value === undefined || value === null) delete next[key];
    else next[key] = value;

    onChange({ ...node, props: next });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{name}</h3>
        <p className="text-xs text-[var(--pb-muted)]">
          {section.has_slot ? 'A standard section. Set its words here; what it holds is listed below and edited on the canvas.' : 'A standard section. Set its words here.'}
        </p>
      </div>

      {section.params.map((param) => (
        <ParamField key={param} param={standardParam(param)} value={props[param]} onChange={(value) => setProp(param, value)} />
      ))}

      {section.has_slot ? <SlotContents node={node} slots={[{ name: '', label: 'Contents' }]} onChange={onChange} canAuthorPml={canAuthorPml} hideAdd={hideAdd} /> : null}

      <div className="border-t border-white/10 pt-4">
        <Button type="button" variant="outline" onClick={onDelete} className="w-full whitespace-nowrap text-red-600 outline-none">
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteLabel ?? `Delete ${name.toLowerCase()}`}
        </Button>
      </div>
    </div>
  );
}
