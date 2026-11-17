'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

import type { PmlNode } from '../../language';
import type { DocumentField } from '../document';
import { Button, Input, Label, Switch, Textarea } from '../ui/controls';
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
import { MediaField } from './MediaField';
import { ParagraphEditor } from './ParagraphEditor';

/** A text field allowed more than this many characters is a box of several lines (a summary), not one line. */
const LONG_TEXT = 200;

const SELECT = 'w-full rounded-md border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3 py-2 text-sm text-[var(--pb-text)] outline-none disabled:opacity-60';

/** A media field's value: an address, or a picture with its description and caption (a post's cover). */
type MediaValue = string | { url?: string; alt?: string; caption?: string };

/** One field, drawn for its kind. `onDraft` changes what shows; `onCommit` saves; `onRich` saves after a pause. */
export function FieldRow({
  field,
  value,
  onDraft,
  onCommit,
  onRich,
}: {
  field: DocumentField;
  value: unknown;
  onDraft: (value: unknown) => void;
  onCommit: (value: unknown) => void;
  onRich: (value: unknown) => void;
}): React.JSX.Element {
  const id = `doc-field-${field.name}`;
  const label = <Label htmlFor={id}>{field.label}</Label>;

  switch (field.kind) {
    case 'toggle':
      return (
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>{field.label}</span>
          <Switch aria-label={field.label} checked={value === true} disabled={field.readOnly} onCheckedChange={(on) => onCommit(on)} />
        </label>
      );
    case 'rich':
      return (
        <div className="space-y-1">
          <p id={id} className="text-sm font-medium">{field.label}</p>
          <ParagraphEditor words={Array.isArray(value) ? (value as PmlNode[]) : []} onChange={(children) => onRich(children)} labelledBy={id} />
        </div>
      );
    case 'list':
      return <ListField id={id} field={field} value={Array.isArray(value) ? (value as string[]) : []} onCommit={onCommit} />;
    case 'rows':
      return <RowsField id={id} field={field} value={Array.isArray(value) ? (value as Row[]) : []} onDraft={onDraft} onCommit={onCommit} />;
    case 'date':
      // A date the product sets (when it was published) reads as words, not as an input that cannot be changed.
      if (field.readOnly) {
        return (
          <div className="space-y-1">
            <p className="text-sm font-medium">{field.label}</p>
            <p className="text-sm text-[var(--pb-muted)]">{dateWords(value)}</p>
          </div>
        );
      }

      return (
        <div className="space-y-1">
          {label}
          <Input id={id} name={field.name} type="date" value={String(value ?? '').slice(0, 10)} readOnly={field.readOnly} onChange={(e) => onCommit(e.target.value || null)} className="px-3 py-2 outline-none" />
        </div>
      );
    case 'media': {
      // A field that reads `null` while unset holds the picture WITH its words ({url, alt, caption}: a post's cover); only
      // a field that reads an address string keeps writing a string. Reading `null` as "a string field" wrote a bare
      // address on the first pick and hid "What the picture shows" and the caption until a reload (2026-11-17).
      const withWords = value === null || (typeof value === 'object' && value !== undefined);
      const media = (value ?? '') as MediaValue;
      const url = typeof media === 'string' ? media : (media.url ?? '');
      const picture = typeof media === 'string' ? (media ? { url: media } : {}) : media;
      const withPicture = (patch: Partial<{ url: string; alt: string; caption: string }>) =>
        !withWords && patch.url !== undefined && Object.keys(patch).length === 1 ? patch.url : { ...picture, ...patch };

      return (
        <div className="space-y-2">
          <p className="text-sm font-medium">{field.label}</p>
          <MediaField value={url} onChange={(next) => onCommit(withPicture({ url: next }))} />
          {withWords && url ? (
            <>
              <Input aria-label={`${field.label}: what it shows`} placeholder="What the picture shows" value={picture.alt ?? ''} onChange={(e) => onDraft(withPicture({ alt: e.target.value }))} onBlur={(e) => onCommit(withPicture({ alt: e.target.value }))} className="px-3 py-2 outline-none" />
              <Input aria-label={`${field.label}: caption`} placeholder="Caption (optional)" value={picture.caption ?? ''} onChange={(e) => onDraft(withPicture({ caption: e.target.value }))} onBlur={(e) => onCommit(withPicture({ caption: e.target.value }))} className="px-3 py-2 outline-none" />
            </>
          ) : null}
        </div>
      );
    }
    case 'choice': {
      // The product may hand back a number (a category id); its options are text, so compare as text.
      const chosen = value === null || value === undefined ? '' : String(value);
      const options = field.options ?? [];
      const known = options.some((option) => option.value === chosen);

      return (
        <div className="space-y-1">
          {label}
          <select id={id} name={field.name} value={chosen} disabled={field.readOnly} onChange={(e) => onCommit(e.target.value)} className={SELECT}>
            {/* A value the options no longer offer (a retired category) still shows, so nothing changes until chosen. */}
            {known ? null : <option value={chosen}>{chosen === '' ? 'Choose one' : chosen}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }
    case 'record':
      return (
        <div className="space-y-1">
          <p className="text-sm font-medium">{field.label}</p>
          {typeof value === 'string' && /^https?:\/\//.test(value) ? (
            // An address (where readers find it) opens in a new tab, so the design stays open here.
            <a href={value} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-[var(--pb-accent)] underline outline-none">
              {value}
            </a>
          ) : (
            <p className="text-sm text-[var(--pb-muted)]">{recordText(value)}</p>
          )}
        </div>
      );
    default: {
      const text = String(value ?? '');
      const over = field.max !== undefined && text.length > field.max;

      return (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            {label}
            {field.max !== undefined ? <span className={`text-xs tabular-nums ${over ? 'text-[var(--pb-danger)]' : 'text-[var(--pb-muted)]'}`}>{text.length}/{field.max}</span> : null}
          </div>
          {field.max !== undefined && field.max > LONG_TEXT ? (
            <Textarea id={id} name={field.name} rows={4} value={text} readOnly={field.readOnly} aria-invalid={over || undefined} onChange={(e) => onDraft(e.target.value)} onBlur={(e) => !field.readOnly && onCommit(e.target.value)} className="px-3 py-2 outline-none" />
          ) : (
            <Input id={id} name={field.name} value={text} readOnly={field.readOnly} aria-invalid={over || undefined} onChange={(e) => onDraft(e.target.value)} onBlur={(e) => !field.readOnly && onCommit(e.target.value)} className="px-3 py-2 outline-none" />
          )}
        </div>
      );
    }
  }
}

/** A list (tags): Enter or a comma adds what was typed; each item has its own remove button; `max` caps the count. */
function ListField({ id, field, value, onCommit }: { id: string; field: DocumentField; value: string[]; onCommit: (value: unknown) => void }): React.JSX.Element {
  const [typed, setTyped] = useState('');
  const full = field.max !== undefined && value.length >= field.max;
  const add = () => {
    const item = typed.trim().replace(/,$/, '');
    if (item === '' || value.includes(item) || full) return;
    onCommit([...value, item]);
    setTyped('');
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{field.label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {value.map((item) => (
          <span key={item} className="inline-flex items-center gap-1 rounded-full bg-[var(--pb-accent-soft)] px-2 py-0.5 text-xs">
            {item}
            {field.readOnly ? null : (
              <button type="button" aria-label={`Remove ${item}`} className="outline-none" onClick={() => onCommit(value.filter((v) => v !== item))}>
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      {field.readOnly ? null : (
        <Input
          id={id}
          name={field.name}
          value={typed}
          disabled={full}
          placeholder={full ? `Up to ${field.max}` : 'Type and press Enter'}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          className="px-3 py-2 outline-none"
        />
      )}
    </div>
  );
}

type Row = Record<string, unknown>;

/**
 * A list of small records (a post's facts with their review dates, its reader questions): each row a card of its
 * columns, drawn by FieldRow. A change shows at once and saves the WHOLE list on leaving a box (or at once for a date
 * or a choice). Add starts an empty row that saves once something is written in it; Remove asks first, then saves.
 * A row left blank is never written: it would be refused, and the refusal would undo the author's other edits too.
 */
function RowsField({ id, field, value, onDraft, onCommit }: { id: string; field: DocumentField; value: Row[]; onDraft: (value: unknown) => void; onCommit: (value: unknown) => void }): React.JSX.Element {
  const [removing, setRemoving] = useState<number | null>(null);
  const columns = field.columns ?? [];
  const full = field.max !== undefined && value.length >= field.max;
  const withCell = (index: number, name: string, cell: unknown) => value.map((row, i) => (i === index ? { ...row, [name]: cell } : row));
  const empty = () => Object.fromEntries(columns.map((column) => [column.name, column.kind === 'date' ? null : '']));
  const commit = (rows: Row[]) => onCommit(rows.filter((row) => columns.some((column) => !isBlank(row[column.name]))));

  return (
    <div className="space-y-2">
      <p id={id} className="text-sm font-medium">{field.label}</p>
      {value.length === 0 ? <p className="text-sm text-[var(--pb-muted)]">None yet.</p> : null}
      {value.map((row, index) => (
        <div key={index} role="group" aria-label={`${field.label}, ${index + 1}`} className="space-y-3 rounded-lg border border-[var(--pb-border)] p-3">
          {columns.map((column) => (
            <FieldRow
              key={column.name}
              // A row's boxes need their own ids; the value still lives under the column's name.
              field={{ ...column, name: `${field.name}-${index}-${column.name}`, readOnly: field.readOnly || column.readOnly }}
              value={row[column.name]}
              onDraft={(cell) => onDraft(withCell(index, column.name, cell))}
              onCommit={(cell) => commit(withCell(index, column.name, cell))}
              onRich={(cell) => commit(withCell(index, column.name, cell))}
            />
          ))}
          {field.readOnly ? null : (
            <button type="button" onClick={() => setRemoving(index)} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-[var(--pb-danger)] outline-none hover:underline">
              <X className="h-3 w-3" aria-hidden="true" />
              Remove
            </button>
          )}
        </div>
      ))}
      {field.readOnly ? null : (
        <Button size="sm" variant="outline" disabled={full} onClick={() => onDraft([...value, empty()])} className="whitespace-nowrap outline-none">
          {full ? `Up to ${field.max}` : 'Add one'}
        </Button>
      )}

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this one?</AlertDialogTitle>
            <AlertDialogDescription>It is taken out of {field.label.toLowerCase()} and saved at once.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing !== null) commit(value.filter((_, i) => i !== removing));
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

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);
}

function dateWords(value: unknown): string {
  if (typeof value !== 'string' || value === '') return 'Not yet';
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value;

  return value.length > 10 ? at.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : at.toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
}

function recordText(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value !== 'object') return String(value);

  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('; ');
}
