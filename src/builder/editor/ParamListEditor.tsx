'use client';

import React, { useId, useState } from 'react';
import { ArrowDown, ArrowUp, MoreVertical, Plus, Trash2 } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/overlays';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/overlays';
import { Input } from '../ui/controls';
import { Switch } from '../ui/controls';
import { Textarea } from '../ui/controls';
import type { StudioParamField } from '../components';
import type { LiteralValue } from '../../language';

/**
 * A list or a map setting edited on a page (component props p07b, 2026-11-11): one row per item with a control
 * per field, add, move and remove. The value is plain data; the rail writes it as JS-like text
 * (`[{name: "Starter", price: 49}]`) and the server reads it with PSL's own parser.
 */

const FIELD = 'w-full px-3 py-2 text-sm outline-none';
const SELECT = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none';

type Spec = Pick<StudioParamField, 'kind' | 'label' | 'options' | 'of' | 'fields'>;

/** What a list's items are: maps with the list's fields, or plain values of its `of` kind. */
function itemSpec(spec: Spec): Spec {
  return spec.fields ? { kind: 'map', label: 'Item', fields: spec.fields } : { kind: spec.of ?? 'text', label: 'Item' };
}

/** A new item or field: empty words, 0, no, the first choice, an empty list, a map of blanks. */
function blankOf(spec: Spec): LiteralValue {
  switch (spec.kind) {
    case 'number':
      return 0;
    case 'yes_no':
      return false;
    case 'enum':
      return spec.options?.[0] ?? '';
    case 'list':
      return [];
    case 'map':
      return Object.fromEntries((spec.fields ?? []).map((field) => [field.name, blankOf(field)]));
    default:
      return '';
  }
}

/** One value of any kind: a control, or for a list or map, its own editor. */
export function ValueEditor({ spec, value, onChange, labelledBy }: { spec: Spec; value: LiteralValue | undefined; onChange: (next: LiteralValue) => void; labelledBy?: string }): React.JSX.Element {
  switch (spec.kind) {
    case 'list':
    case 'map':
      return <ParamListEditor spec={spec} value={value} onChange={onChange} />;
    case 'number':
      return (
        <Input
          type="number"
          aria-labelledby={labelledBy}
          value={typeof value === 'number' ? String(value) : ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          className={FIELD}
        />
      );
    case 'yes_no':
      return <Switch aria-labelledby={labelledBy} checked={value === true} onCheckedChange={(on) => onChange(on)} className="outline-none" />;
    case 'enum':
      return (
        <select aria-labelledby={labelledBy} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} className={SELECT}>
          {(spec.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case 'long_text':
    case 'rich_text':
      return <Textarea aria-labelledby={labelledBy} rows={3} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} className={FIELD} />;
    default:
      return (
        <Input
          aria-labelledby={labelledBy}
          type={spec.kind === 'url' ? 'url' : 'text'}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          className={FIELD}
        />
      );
  }
}

/** A map's fields, each labelled, each with its control. */
function MapFields({ spec, value, onChange }: { spec: Spec; value: LiteralValue | undefined; onChange: (next: LiteralValue) => void }): React.JSX.Element {
  const id = useId();
  const map = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return (
    <div className="space-y-2">
      {(spec.fields ?? []).map((field) => (
        <div key={field.name}>
          <p id={`${id}-${field.name}`} className="mb-1 text-xs font-medium text-slate-600">
            {field.label}
          </p>
          <ValueEditor spec={field} value={map[field.name]} labelledBy={`${id}-${field.name}`} onChange={(next) => onChange({ ...map, [field.name]: next })} />
        </div>
      ))}
    </div>
  );
}

/** A list's or a map's editor: rows with their actions in one menu, and "Add an item". */
export function ParamListEditor({ spec, value, onChange }: { spec: Spec; value: LiteralValue | undefined; onChange: (next: LiteralValue) => void }): React.JSX.Element {
  const [removing, setRemoving] = useState<number | null>(null);

  if (spec.kind === 'map') return <MapFields spec={spec} value={value} onChange={onChange} />;

  const items = Array.isArray(value) ? value : [];
  const item = itemSpec(spec);
  const move = (from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.map((entry, index) => (
        <div key={index} className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">
              {spec.label}: item {index + 1}
            </p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={`Actions for ${spec.label}, item ${index + 1}`} className="rounded-full p-1 text-slate-500 outline-none hover:bg-slate-100">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem disabled={index === 0} onSelect={() => move(index, index - 1)}>
                  <ArrowUp className="mr-2 h-4 w-4" />
                  Move up
                </DropdownMenuItem>
                <DropdownMenuItem disabled={index === items.length - 1} onSelect={() => move(index, index + 1)}>
                  <ArrowDown className="mr-2 h-4 w-4" />
                  Move down
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setRemoving(index)} className="text-red-600">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <ValueEditor spec={item} value={entry} onChange={(next) => onChange(items.map((current, i) => (i === index ? next : current)))} />
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, blankOf(item)])}
        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 outline-none hover:bg-slate-50"
      >
        <Plus className="h-3.5 w-3.5" />
        Add an item
      </button>

      <AlertDialog open={removing !== null} onOpenChange={(open) => (open ? null : setRemoving(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove item {removing === null ? '' : removing + 1} from {spec.label}?</AlertDialogTitle>
            <AlertDialogDescription>It comes off this section on this page. Undo brings it back.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="outline-none">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 outline-none hover:bg-red-700"
              onClick={() => {
                if (removing !== null) onChange(items.filter((_, i) => i !== removing));
                setRemoving(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
