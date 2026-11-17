'use client';

import React, { useEffect, useRef, useState } from 'react';

import { isConflict, type DocumentField, type DocumentFieldsPort } from '../document';
import { Input, Switch } from '../ui/controls';
import { useOwnVars } from '../ui/theme';
import { useBuilderHost } from './host';

/**
 * The inbox frame around an email being designed (pml-email C1a): the fields a reader meets before the body (the
 * subject line, the preview text after it) and the email's own settings (the standard header and footer), read and
 * written through the host's `fields` port. A text field saves when the author leaves it, and only when it changed; a
 * switch saves at once and goes back if the save fails. The fields keep their own revision (held in a ref, so two quick
 * writes never send a stale one), separate from the design's autosave. `track` hands each write to the editor, which
 * waits for them before drawing the email as sent.
 */
export function EmailInbox({
  id,
  fields,
  session,
  track,
}: {
  id: string;
  fields: DocumentFieldsPort;
  session: string;
  track?: (write: Promise<unknown>) => void;
}): React.JSX.Element {
  const host = useBuilderHost();
  // The host's callbacks may change identity every render; reading them through a ref keeps the load from re-running
  // (which would overwrite what the author is typing).
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
  const [conflict, setConflict] = useState(false);

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
    };
  }, [fields, id]);

  /** Writes run one after another, each on the revision the last one returned. */
  const save = (name: string, value: unknown) => {
    if (Object.is(saved.current[name], value)) return;

    const write = queue.current.then(async () => {
      try {
        const result = await fields.write(id, name, value, revision.current, session);

        if (isConflict(result)) {
          setConflict(true);
          setValues((v) => ({ ...v, [name]: saved.current[name] }));

          return;
        }

        revision.current = result.revision || revision.current;
        saved.current = { ...saved.current, [name]: value };
      } catch (err) {
        setValues((v) => ({ ...v, [name]: saved.current[name] }));
        hostRef.current.onError(err);
      }
    });

    queue.current = write;
    track?.(write);
  };

  const reload = async () => {
    try {
      const read = await fields.read(id);
      setValues(read.values);
      saved.current = read.values;
      revision.current = read.revision;
      setConflict(false);
    } catch (err) {
      hostRef.current.onError(err);
    }
  };

  const text = described.filter((f) => f.kind === 'text');
  const toggles = described.filter((f) => f.kind === 'toggle');

  return (
    <div className="space-y-3 rounded-t-xl border border-b-0 border-[var(--pb-border)] bg-[var(--pb-surface)] px-4 py-3 text-[var(--pb-text)]" style={vars}>
      {text.map((field) => {
        const value = String(values[field.name] ?? '');
        const over = field.max !== undefined && value.length > field.max;

        return (
          <div key={field.name} className="flex items-center gap-3">
            <label htmlFor={`email-field-${field.name}`} className="w-24 shrink-0 text-xs font-medium text-[var(--pb-muted)]">
              {field.label}
            </label>
            <Input
              id={`email-field-${field.name}`}
              name={field.name}
              value={value}
              readOnly={field.readOnly}
              onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
              onBlur={(e) => !field.readOnly && save(field.name, e.target.value)}
              aria-invalid={over || undefined}
            />
            {field.max !== undefined ? (
              <span className={`w-14 shrink-0 text-right text-xs tabular-nums ${over ? 'text-[var(--pb-danger)]' : 'text-[var(--pb-muted)]'}`}>
                {value.length}/{field.max}
              </span>
            ) : null}
          </div>
        );
      })}

      {toggles.map((field) => (
        <label key={field.name} className="flex items-center justify-between gap-3 text-sm">
          <span>{field.label}</span>
          <Switch
            aria-label={field.label}
            checked={values[field.name] === true}
            disabled={field.readOnly}
            onCheckedChange={(on) => {
              setValues((v) => ({ ...v, [field.name]: on }));
              save(field.name, on);
            }}
          />
        </label>
      ))}

      {conflict ? (
        <p role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          These details were changed somewhere else after you opened this email.
          <button type="button" onClick={() => void reload()} className="whitespace-nowrap font-medium underline outline-none">
            Load the latest
          </button>
        </p>
      ) : null}
    </div>
  );
}
