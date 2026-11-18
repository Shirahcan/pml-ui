'use client';

import React, { useEffect, useRef, useState } from 'react';

import { isConflict, type DocumentField, type DocumentFieldsPort } from '../document';
import { useOwnVars } from '../ui/theme';
import { FieldRow } from './FieldRow';
import { mergeFreshRead, useFieldsEpoch } from './fieldsEpoch';
import { useBuilderHost } from './host';

/**
 * A document's own fields, every kind, read and written through the host's `fields` port (blog-on-growth-service S7c):
 * a post's title, slug, dek, summary, author, category, audience, ending, tags, cover, meta title and description. The write discipline
 * is EmailInbox's: the revision lives in a ref and writes run one after another, a field writes only when its value
 * changed, a refused or conflicting write puts the old value back, and a conflict offers "Load the latest". Text saves
 * when the author leaves it, rich words after a short pause, everything else at once.
 */
export function DocumentFieldsPanel({
  id,
  fields,
  session,
  group,
  label = 'Details',
  only,
  onSaved,
}: {
  id: string;
  fields: DocumentFieldsPort;
  session: string;
  group?: string;
  label?: string;
  /** Only these fields, in the port's order: one element's own panel (a post's title, its cover). */
  only?: readonly string[];
  /** A field was saved: the canvas compiles again, so what the design draws from it is current. */
  onSaved?: (name: string) => void;
}): React.JSX.Element | null {
  const host = useBuilderHost();
  const hostRef = useRef(host);
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    hostRef.current = host;
    onSavedRef.current = onSaved;
  });
  const vars = useOwnVars();
  const [described, setDescribed] = useState<DocumentField[]>([]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const saved = useRef<Record<string, unknown>>({});
  const revision = useRef('');
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const richTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [conflict, setConflict] = useState(false);
  // The details could not be read: said in the panel with a retry, never an empty panel (2026-11-17: a piece's panel
  // with no field row and a double-click that did nothing looked like a broken editor, with nothing saying why).
  const [unread, setUnread] = useState(false);

  const load = async () => {
    const [list, read] = await Promise.all([fields.describe(id), fields.read(id)]);
    setDescribed(list);
    setValues(read.values);
    saved.current = read.values;
    revision.current = read.revision;
    setConflict(false);
    setUnread(false);
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
      .catch((err) => {
        if (!alive) return;
        setUnread(true);
        hostRef.current.onError(err);
      });

    return () => {
      alive = false;
      Object.values(richTimers.current).forEach(clearTimeout);
    };
  }, [fields, id]);

  // The editor's refreshFields(): read the fields again, after any write still on its way, keeping what is being typed.
  const epoch = useFieldsEpoch();
  const firstEpoch = useRef(epoch);
  useEffect(() => {
    if (epoch === firstEpoch.current) return undefined;

    let alive = true;

    queue.current = queue.current
      .then(() => fields.read(id))
      .then((read) => {
        if (!alive) return;
        setValues((current) => mergeFreshRead(current, saved.current, read.values));
        saved.current = read.values;
        revision.current = read.revision;
        setConflict(false);
      })
      .catch((err) => hostRef.current.onError(err));

    return () => {
      alive = false;
    };
    // Only a new epoch re-reads; a new document or port is the load above.
  }, [epoch]);

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
        onSavedRef.current?.(name);
      } catch (err) {
        set(name, saved.current[name]);
        hostRef.current.onError(err);
      }
    });
  };

  // One group's panel draws only that group's fields (designer sole surface P2a); without a group, every field.
  const inGroup = group === undefined ? described : described.filter((field) => field.group?.key === group);
  const shown = only === undefined ? inGroup : inGroup.filter((field) => only.includes(field.name));

  if (unread) {
    return (
      <p role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900" style={vars}>
        These details could not be loaded.
        <button type="button" onClick={() => void load().catch((err) => hostRef.current.onError(err))} className="whitespace-nowrap font-medium underline outline-none">
          Try again
        </button>
      </p>
    );
  }

  if (shown.length === 0) return null;

  return (
    <section aria-label={label} className="space-y-4 rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-4 text-[var(--pb-text)]" style={vars}>
      {shown.map((field) => (
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
