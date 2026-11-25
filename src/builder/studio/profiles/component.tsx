'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

import { paramDefaultText, type StudioParam, type StudioParamKind } from '../../components';
import type { ComponentSettingRefusal, ComponentSettingsPort, SaveDraftResult } from '../../document';
import { Input } from '../../ui/controls';

/**
 * The component profile's chrome (shared PML Studio P3c-6, 2026-11-25): a reusable component's settings ("props") in a
 * slide-in Settings panel, beside the one element on the canvas. The kit's `Component\ParamSchema` is the authority on
 * what a setting may be; this panel edits the list, saves it through the host's `settings` port in the SAME draft as
 * the design, and shows a refusal on the row it is about.
 */

export const COMPONENT_KIND_LABELS: Record<StudioParamKind, string> = {
  text: 'Short text',
  long_text: 'Long text',
  rich_text: 'Formatted text',
  url: 'Link',
  image: 'Picture',
  enum: 'Choice',
  number: 'Number',
  yes_no: 'Yes or no',
  style: 'Style',
  list: 'List',
  map: 'Group of fields',
};

const KINDS = Object.keys(COMPONENT_KIND_LABELS) as StudioParamKind[];
const SELECT = 'w-full rounded-md border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3 py-2 text-sm text-[var(--pb-text)] outline-none';
const ADD = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--pb-border)] px-3 py-1.5 text-xs font-semibold outline-none hover:text-[var(--pb-accent)]';
const REMOVE = 'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--pb-muted)] outline-none hover:bg-red-50 hover:text-red-600';
/** How long the panel waits after the last keystroke before it saves, like the canvas's autosave. */
const SAVE_AFTER_MS = 700;

/** PML names are lowercase with underscores; typing a space or a capital should just work. */
export const asSettingName = (value: string): string => value.toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');

/** The row a refusal is about: `params.<i>.<...>` names row i; anything else belongs to the list as a whole. */
export function refusalRow(refusal: ComponentSettingRefusal | null): number | null {
  const match = refusal ? /^params\.(\d+)/.exec(refusal.field) : null;
  return match ? Number(match[1]) : null;
}

/** What the panel needs from the editor it sits in: the draft's revision, and a way to hand it a new one. */
export interface ComponentSettingsEditor {
  session: string;
  revisionNow(): string | null;
  adoptRevision(revision: string): void;
}

type Status = 'loading' | 'saved' | 'saving' | 'waiting' | 'refused' | 'conflict' | 'failed';

const STATUS_WORDS: Record<Status, string> = {
  loading: 'Reading the settings...',
  saved: 'Saved',
  saving: 'Saving...',
  waiting: 'Not saved yet',
  refused: 'Not saved: fix the setting marked below',
  conflict: 'Not saved: someone else changed this component. Reload to see their version.',
  failed: 'Not saved: the settings could not be sent. Change anything to try again.',
};

const isRefusal = (result: SaveDraftResult | { refused: ComponentSettingRefusal }): result is { refused: ComponentSettingRefusal } =>
  typeof result === 'object' && result !== null && 'refused' in result;

export function ComponentSettingsPanel({ id, port, editor }: { id: string; port: ComponentSettingsPort; editor: ComponentSettingsEditor }): React.JSX.Element {
  const [settings, setSettings] = useState<StudioParam[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [refusal, setRefusal] = useState<ComponentSettingRefusal | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<StudioParam[]>([]);
  /** A change from outside arrived while the first read was in flight: it is newer, so the read does not replace it. */
  const outside = useRef(false);

  useEffect(() => {
    let live = true;
    port
      .read(id)
      .then(({ settings: read }) => {
        if (!live) return;
        if (!outside.current) {
          latest.current = read;
          setSettings(read);
        }
        setStatus('saved');
      })
      .catch(() => live && setStatus('failed'));

    return () => {
      live = false;
    };
  }, [id, port]);

  // A change made outside the panel (the code, an assistant's run, a rewind) shows at once. Typing still waiting to
  // save wins: the person's own change is what goes out next, and it is never replaced under their cursor.
  useEffect(() => {
    if (!port.subscribe) return undefined;

    return port.subscribe(id, (next) => {
      if (timer.current) return;
      outside.current = true;
      latest.current = next;
      setSettings(next);
      // A refusal was about the list this replaces; the design's own save carries the new list.
      setRefusal(null);
      setStatus((now) => (now === 'refused' || now === 'loading' ? 'saved' : now));
    });
  }, [id, port]);

  const save = useCallback(async () => {
    timer.current = null;
    const revision = editor.revisionNow();
    if (revision === null) return;
    setStatus('saving');

    try {
      const result = await port.write(id, latest.current, revision, editor.session);
      if (isRefusal(result)) {
        setRefusal(result.refused);
        setStatus('refused');
      } else if ('conflict' in result) {
        setStatus('conflict');
      } else {
        setRefusal(null);
        editor.adoptRevision(result.revision);
        setStatus('saved');
      }
    } catch {
      setStatus('failed');
    }
  }, [editor, id, port]);

  // A pending save goes out when the panel closes, so a setting typed just before closing is not lost.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void save();
      }
    },
    [save],
  );

  const change = (next: StudioParam[]) => {
    latest.current = next;
    setSettings(next);
    setStatus('waiting');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), SAVE_AFTER_MS);
  };

  const edit = (index: number, patch: Partial<StudioParam>) => change(settings.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const badRow = refusalRow(refusal);

  if (status === 'loading') {
    return <p className="text-sm text-[var(--pb-muted)]">{STATUS_WORDS.loading}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--pb-muted)]">
        What a page fills in when it uses this component. The design reads each one as <code className="font-mono">{'{props.name}'}</code>.
      </p>
      <p role="status" className={`text-xs ${status === 'refused' || status === 'conflict' || status === 'failed' ? 'text-red-600' : 'text-[var(--pb-muted)]'}`}>
        {STATUS_WORDS[status]}
      </p>
      {refusal && badRow === null ? (
        <p role="alert" className="text-sm text-red-600">
          {refusal.text}
        </p>
      ) : null}

      {settings.length === 0 ? <p className="text-sm text-[var(--pb-muted)]">No settings yet. A component with none always looks the same.</p> : null}

      {settings.map((setting, index) => (
        <div key={index} className={`rounded-2xl border p-3 ${badRow === index ? 'border-red-300' : 'border-[var(--pb-border)]'}`}>
          <div className="grid gap-2">
            <Input aria-label="Label" placeholder="Label, such as Plan name" value={setting.label} onChange={(e) => edit(index, { label: e.target.value })} className="px-3 py-2 outline-none" />
            <Input aria-label="Name in the design" placeholder="Name, such as plan" value={setting.name} onChange={(e) => edit(index, { name: asSettingName(e.target.value) })} className="px-3 py-2 font-mono outline-none" />
            <select aria-label="Kind" value={setting.kind} onChange={(e) => edit(index, { kind: e.target.value as StudioParamKind })} className={SELECT}>
              {KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {COMPONENT_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
            <Input aria-label="Default value" placeholder="Default value" value={paramDefaultText(setting)} onChange={(e) => edit(index, { default: e.target.value })} className="px-3 py-2 outline-none" />
            {setting.kind === 'enum' ? (
              <Input
                aria-label="Choices"
                placeholder="Choices, separated by commas"
                value={(setting.options ?? []).join(', ')}
                onChange={(e) => edit(index, { options: e.target.value.split(/,\s*/) })}
                className="px-3 py-2 outline-none"
              />
            ) : null}
          </div>

          {badRow === index && refusal ? (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {refusal.text}
            </p>
          ) : null}

          <div className="mt-2 flex items-center justify-between gap-2">
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" checked={setting.required === true} onChange={(e) => edit(index, { required: e.target.checked })} className="outline-none" />
              Required (needs a default)
            </label>
            <button type="button" aria-label={`Remove ${setting.label || 'this setting'}`} onClick={() => change(settings.filter((_, i) => i !== index))} className={REMOVE}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}

      <button type="button" onClick={() => change([...settings, { name: '', label: '', kind: 'text', required: false, default: '', options: [] }])} className={ADD}>
        <Plus className="h-3.5 w-3.5" />
        Add a setting
      </button>
    </div>
  );
}
