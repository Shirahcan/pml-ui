'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

import type { PmlNode } from '../../language';
import { isConflict, type DocumentField, type DocumentFieldsPort } from '../document';
import { Input, Label, Switch } from '../ui/controls';
import { useOwnVars } from '../ui/theme';
import { useBuilderHost } from './host';
import { MediaField } from './MediaField';
import { ParagraphEditor } from './ParagraphEditor';

/** A media field's value: an address, or a picture with its description and caption (a post's cover). */
type MediaValue = string | { url?: string; alt?: string; caption?: string };

/**
 * A document's own fields, every kind, read and written through the host's `fields` port (blog-on-growth-service S7c):
 * a post's title, slug, dek, category, tags, audience, author, cover, meta title and description. The write discipline
 * is EmailInbox's: the revision lives in a ref and writes run one after another, a field writes only when its value
 * changed, a refused or conflicting write puts the old value back, and a conflict offers "Load the latest". Text saves
 * when the author leaves it, rich words after a short pause, everything else at once.
 */
export function DocumentFieldsPanel({ id, fields, session }: { id: string; fields: DocumentFieldsPort; session: string }): React.JSX.Element | null {
  const host = useBuilderHost();
  const hostRef = useRef(host);
  useEffect(() => {
    hostRef.current = host;
  });
  const vars = useOwnVars();
  const [described, setDescribed] = useState<DocumentField[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const saved = useRef<Record<string, unknown>>({});
  const revision = useRef('');
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const richTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [conflict, setConflict] = useState(false);

  const load = async () => {
    const [list, read] = await Promise.all([fields.describe(id), fields.read(id)]);
    setDescribed(list);
    setValues(read.values);
    saved.current = read.values;
    revision.current = read.revision;
    setConflict(false);
  };

  useEffect(() => {
    let alive = true;

    Promise.all([fields.describe(id), fields.read(id)])
      .then(([list, read]) => {
        if (!alive) return;
        setDescribed(list);
        setValues(read.values);
        saved.current = read.values;
        revision.current = read.revision;
      })
      .catch((err) => hostRef.current.onError(err));

    return () => {
      alive = false;
      Object.values(richTimers.current).forEach(clearTimeout);
    };
  }, [fields, id]);

  const set = (name: string, value: unknown) => setValues((v) => ({ ...v, [name]: value }));

  const save = (name: string, value: unknown) => {
    if (JSON.stringify(saved.current[name]) === JSON.stringify(value)) return;

    queue.current = queue.current.then(async () => {
      try {
        const result = await fields.write(id, name, value, revision.current, session);

        if (isConflict(result)) {
          setConflict(true);
          set(name, saved.current[name]);

          return;
        }

        revision.current = result.revision || revision.current;
        saved.current = { ...saved.current, [name]: value };
      } catch (err) {
        set(name, saved.current[name]);
        hostRef.current.onError(err);
      }
    });
  };

  if (described.length === 0) return null;

  return (
    <section aria-label="Details" className="space-y-4 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4 text-[var(--pb-text)]" style={vars}>
      {described.map((field) => (
        <FieldRow
          key={field.name}
          field={field}
          value={values[field.name]}
          onDraft={(value) => set(field.name, value)}
          onCommit={(value) => {
            set(field.name, value);
            save(field.name, value);
          }}
          onRich={(value) => {
            set(field.name, value);
            clearTimeout(richTimers.current[field.name]);
            richTimers.current[field.name] = setTimeout(() => save(field.name, value), 800);
          }}
        />
      ))}

      {conflict ? (
        <p role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          These details were changed somewhere else after you opened this.
          <button type="button" onClick={() => void load().catch((err) => hostRef.current.onError(err))} className="whitespace-nowrap font-medium underline outline-none">
            Load the latest
          </button>
        </p>
      ) : null}
    </section>
  );
}

/** One field, drawn for its kind. `onDraft` changes what shows; `onCommit` saves; `onRich` saves after a pause. */
function FieldRow({
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
    case 'date':
      return (
        <div className="space-y-1">
          {label}
          <Input id={id} name={field.name} type="date" value={String(value ?? '').slice(0, 10)} readOnly={field.readOnly} onChange={(e) => onCommit(e.target.value || null)} className="px-3 py-2 outline-none" />
        </div>
      );
    case 'media': {
      const media = (value ?? '') as MediaValue;
      const url = typeof media === 'string' ? media : (media.url ?? '');
      const withPicture = (patch: Partial<{ url: string; alt: string; caption: string }>) =>
        typeof media === 'string' && patch.url !== undefined && Object.keys(patch).length === 1 ? patch.url : { ...(typeof media === 'string' ? { url: media } : media), ...patch };

      return (
        <div className="space-y-2">
          <p className="text-sm font-medium">{field.label}</p>
          <MediaField value={url} onChange={(next) => onCommit(withPicture({ url: next }))} />
          {typeof media === 'object' ? (
            <>
              <Input aria-label={`${field.label}: what it shows`} placeholder="What the picture shows" value={media.alt ?? ''} onChange={(e) => onDraft(withPicture({ alt: e.target.value }))} onBlur={(e) => onCommit(withPicture({ alt: e.target.value }))} className="px-3 py-2 outline-none" />
              <Input aria-label={`${field.label}: caption`} placeholder="Caption (optional)" value={media.caption ?? ''} onChange={(e) => onDraft(withPicture({ caption: e.target.value }))} onBlur={(e) => onCommit(withPicture({ caption: e.target.value }))} className="px-3 py-2 outline-none" />
            </>
          ) : null}
        </div>
      );
    }
    case 'record':
      return (
        <div className="space-y-1">
          <p className="text-sm font-medium">{field.label}</p>
          <p className="text-sm text-[var(--pb-muted)]">{recordText(value)}</p>
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
          <Input id={id} name={field.name} value={text} readOnly={field.readOnly} aria-invalid={over || undefined} onChange={(e) => onDraft(e.target.value)} onBlur={(e) => !field.readOnly && onCommit(e.target.value)} className="px-3 py-2 outline-none" />
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

function recordText(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (typeof value !== 'object') return String(value);

  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join('; ');
}
