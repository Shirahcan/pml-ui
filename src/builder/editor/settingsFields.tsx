'use client';

import React, { useId, useState } from 'react';
import { Button } from '../ui/controls';
import { Input } from '../ui/controls';
import { Switch } from '../ui/controls';
import { Textarea } from '../ui/controls';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { MediaField } from './MediaField';
import { paramDefaultText, type StudioParam } from '../components';
import { bindingName, useStudioAuthoring } from './authoring';
import { type PmlFieldDef } from '../../language';
import { isBracketedExample } from '../../pml/examples';
import { isExpr, pathExpr } from '../../language';
import { type PmlNode } from '../../language';
import { tokenLabel } from '../../language';
import { useEditorSurface } from './surface';
/**
 * The field kinds a Studio component can hand to each page, and the setting kind each becomes (component
 * props p06a: every field but an anchor, which is the element's identity, not its content).
 */
export const EXPOSABLE_KINDS: Partial<Record<PmlFieldDef['kind'], StudioParam['kind']>> = {
  text: 'text',
  textarea: 'long_text',
  url: 'url',
  media: 'image',
  select: 'enum',
  boolean: 'yes_no',
};

/** An element placed in a component's slot: marked with the slot's name, unmarked for the unnamed slot. */
export function inSlot(child: PmlNode, slot: string): PmlNode {
  if (slot !== '') return { ...child, slot };

  const rest = { ...child };
  delete rest.slot;

  return rest;
}

/** A setting's default as the value its field control holds (yes/no as true or false). */
export function defaultForField(field: PmlFieldDef, param: StudioParam): unknown {
  const text = paramDefaultText(param);

  return field.kind === 'boolean' ? text === 'true' : text;
}

/**
 * A field, plus (only while designing a Studio component) the switch that hands it to each page.
 * This is the no-code form of `{name}`: the author never sees a binding, and the field then edits the
 * value a new page starts with.
 */
export function BindableField({
  owner,
  field,
  value,
  onChange,
}: {
  owner: string;
  field: PmlFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}): React.JSX.Element {
  const authoring = useStudioAuthoring();
  const kind = EXPOSABLE_KINDS[field.kind];

  if (!authoring || !kind) {
    return <FieldControl field={field} value={value} onChange={onChange} />;
  }

  const bound = bindingName(value);
  const param = bound ? authoring.params.find((p) => p.name === bound) : undefined;
  const label = field.label.toLowerCase() === owner.toLowerCase() ? field.label : `${owner}: ${field.label}`;

  return (
    <div className="space-y-1.5">
      {param ? (
        <FieldControl
          field={{ ...field, label: `${field.label} (starts as)` }}
          value={defaultForField(field, param)}
          onChange={(v) => authoring.setDefault(param.name, typeof v === 'boolean' ? String(v) : String(v ?? ''))}
        />
      ) : (
        <FieldControl field={field} value={value} onChange={onChange} />
      )}
      <label className="flex items-center justify-between gap-3 text-xs text-slate-600">
        Each page can change this
        <Switch
          aria-label={`Each page can change ${field.label}`}
          checked={param !== undefined}
          onCheckedChange={(on) => {
            if (on) {
              // What it holds now becomes what each page starts with: a choice keeps its options.
              const start = typeof value === 'boolean' || typeof value === 'number' ? String(value) : typeof value === 'string' && value !== '' ? value : kind === 'enum' ? (field.options?.[0] ?? '') : kind === 'yes_no' ? 'false' : '';
              onChange(pathExpr(`props.${authoring.expose(label, kind, start, kind === 'enum' ? { options: field.options ?? [] } : {})}`));
            } else if (param) {
              authoring.unexpose(param.name);
            }
          }}
          className="outline-none"
        />
      </label>
    </div>
  );
}

export function FieldControl({
  field,
  value,
  onChange,
}: {
  field: PmlFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
}): React.JSX.Element {
  // Every control has an id its label points at, and a name (Chrome flags a field with neither, and a
  // screen reader reads an unlabelled one as just "edit text").
  const id = `pml-field-${useId()}`;
  const surface = useEditorSurface();
  // The template's example this field opened with: emptying the field puts it back (see `words` below). The panel is
  // keyed by the selected element, so it is always this element's.
  const [original] = useState(() => (isBracketedExample(value) ? String(value).trim() : null));
  const label = (
    <label htmlFor={id} className="mb-1 block text-sm font-medium">
      {field.label}
      {field.optional ? <span className="ml-1 font-normal text-[var(--pb-muted)]">(optional)</span> : null}
    </label>
  );

  // A `{...}` value is live page data (PML v3): shown as what it reads, never as an empty box that a
  // keystroke would silently replace. Changing what it reads belongs in the Code view.
  if (isExpr(value)) {
    const fixed = field.kind === 'boolean' ? false : field.kind === 'select' ? (field.options?.[0] ?? '') : '';

    return (
      <div role="group" aria-labelledby={id}>
        <p id={id} className="mb-1 block text-sm font-medium">
          {field.label}
        </p>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[color-mix(in_srgb,var(--pb-accent)_25%,transparent)] bg-[color-mix(in_srgb,var(--pb-accent)_5%,transparent)] px-3 py-2">
          <code className="min-w-0 truncate text-xs text-[var(--pb-accent)]" title={value.$expr}>{`{${value.$expr}}`}</code>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(fixed)} className="h-7 shrink-0 whitespace-nowrap rounded-full px-3 text-xs outline-none">
            Use a fixed value
          </Button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Live page data, read each time the page is shown. Change what it reads in the Code view.</p>
      </div>
    );
  }

  // Unquoted PML numbers arrive as numbers (`level=3`), so a select must still show them.
  const str = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  // A template's example words are the field's placeholder, never text to delete by hand (owner 2026-11-17). What is
  // typed replaces them; emptying the field puts the example back, so the slot stays visibly unfilled.
  const example = isBracketedExample(str) ? str.trim() : null;
  const words = (next: string) => onChange(next === '' && original ? original : next);

  if (field.kind === 'boolean') {
    return (
      <div className="flex items-center justify-between gap-4 rounded-xl border border-white/20 bg-white/40 px-3 py-2">
        <label htmlFor={id} className="text-sm font-medium">
          {field.label}
        </label>
        <Switch id={id} name={field.key} checked={value === true} onCheckedChange={onChange} className="outline-none" />
      </div>
    );
  }

  if (field.kind === 'media') {
    // The library picker, not a URL box: it re-encodes (stripping phone location data), refuses
    // an SVG, and enforces the quota. Clearing it removes the prop via the caller's setProp.
    return (
      <div role="group" aria-labelledby={id}>
        <p id={id} className="mb-1 block text-sm font-medium">
          {field.label}
          {field.optional ? <span className="ml-1 font-normal text-[var(--pb-muted)]">(optional)</span> : null}
        </p>
        <MediaField value={str} onChange={onChange} />
      </div>
    );
  }

  if (field.kind === 'select') {
    return (
      <div>
        {label}
        {/* An unset value shows as the choice it means (`unsetAs`, 0.7.89): a design saved before the field reads
            "Follow the theme", never an empty "Choose one". */}
        <Select value={str !== '' ? str : (field.unsetAs ?? '')} onValueChange={onChange}>
          <SelectTrigger id={id} className="px-3 py-2 outline-none">
            <SelectValue placeholder="Choose one" />
          </SelectTrigger>
          <SelectContent>
            {/* Catalog field selects carry config tokens (variant, columns, gap, ...), so the same
                humanizer that labels the appearance selects reads well here too, unless the field names its own. */}
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {field.labels?.[option] ?? tokenLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.kind === 'textarea') {
    return (
      <div>
        {label}
        <Textarea id={id} name={field.key} rows={3} value={example ? '' : str} placeholder={example ?? undefined} onChange={(e) => words(e.target.value)} className="px-3 py-2 outline-none" />
      </div>
    );
  }

  // An email has no #links or table of contents: its anchors would be names nothing can reach.
  if (field.kind === 'anchor' && surface === 'email') return <></>;

  if (field.kind === 'anchor') {
    // A link name (S1-02): typed as words, kept as the slug the server accepts ("Who can apply" ->
    // "who-can-apply"), so nobody has to know the rule to get a working #link.
    return (
      <div>
        {label}
        <Input
          id={id}
          name={field.key}
          type="text"
          // Neutral (2026-11-18: one heading's slug, "who-can-apply", showed on every element's panel and read as its own).
          placeholder="a-short-name"
          value={str}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^[^a-z]+/, '').slice(0, 64))}
          className="px-3 py-2 outline-none"
        />
        <p className="mt-1 text-xs text-[var(--pb-muted)]">
          {str ? `Link to it with #${str}` : 'Type a few words; they become the name. Left empty, a heading gets one from its own words.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {label}
      <Input
        id={id}
        name={field.key}
        type="text"
        autoComplete="off"
        inputMode={field.kind === 'url' ? 'url' : undefined}
        placeholder={example ?? (field.kind === 'url' ? 'https://' : undefined)}
        value={example ? '' : str}
        onChange={(e) => words(e.target.value)}
        className="px-3 py-2 outline-none"
      />
    </div>
  );
}
