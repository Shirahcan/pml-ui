'use client';

import React from 'react';

import { Switch } from '../ui/controls';
import { paramDefaultText } from '../components';
import { pathExpr } from '../../language';
import { STYLE_HEX_KEYS, STYLE_TOKENS, type PmlNode } from '../../language';
import { tokenLabel } from '../../language';
import { bindingName, useStudioAuthoring } from './authoring';

import { richTextSetting } from './studioTree';

/**
 * The switches that hand more than a field to each page while a Studio component is designed (component props
 * p06a, 2026-11-11; owner: "a proper props system ... capable of being used to bind to any attribute"). On a
 * normal page there is no authoring context, so neither shows.
 */

const ROW = 'flex items-center justify-between gap-3 text-xs text-slate-600';

/**
 * "Each page can show or hide this", on any element: a yes/no setting, and the element's
 * `if={props.show_x}`. An element with a condition of its own (state, page data) keeps it: the switch is not
 * offered there, so a page setting never silently replaces behaviour someone wrote.
 */
export function ShowHideControl({ node, label, onChange }: { node: PmlNode; label: string; onChange: (next: PmlNode) => void }): React.JSX.Element | null {
  const authoring = useStudioAuthoring();

  if (!authoring) return null;

  const bound = bindingName(node.if);
  const param = bound ? authoring.params.find((p) => p.name === bound && p.kind === 'yes_no') : undefined;

  if (node.if && !param) return null;

  return (
    <div className="space-y-1.5">
      <label className={ROW}>
        Each page can show or hide this
        <Switch
          aria-label={`Each page can show or hide ${label}`}
          checked={param !== undefined}
          onCheckedChange={(on) => {
            if (on) {
              onChange({ ...node, if: pathExpr(`props.${authoring.expose(`Show ${label.toLowerCase()}`, 'yes_no', 'true')}`) });
            } else if (param) {
              // Taking the setting back removes the condition too, so the element simply shows.
              authoring.unexpose(param.name);
            }
          }}
          className="outline-none"
        />
      </label>
      {param ? (
        <label className={ROW}>
          Shown at first
          <Switch
            aria-label={`${label} is shown at first`}
            checked={paramDefaultText(param) !== 'false'}
            onCheckedChange={(shown) => authoring.setDefault(param.name, String(shown))}
            className="outline-none"
          />
        </label>
      ) : null}
    </div>
  );
}

/** A style key in words ("background_color" -> "Background color"). */
const styleWords = (key: string): string => key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');

/** The style keys a page may choose (component props p06b): token styles and the #rrggbb colours. */
function choosable(key: string): readonly string[] | null {
  if ((STYLE_HEX_KEYS as readonly string[]).includes(key)) return [];
  const tokens = (STYLE_TOKENS as Record<string, readonly string[]>)[key];

  return tokens ? tokens.filter((t) => t !== 'custom') : null;
}

const SELECT = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none';

/**
 * "Let each page choose" in the Style window while a Studio component is designed (component props p06b): a
 * style setting (`style_key` = the style, starting as the current value) bound as `background={props.x}`.
 * One place for every style, listed with what each page starts with, rather than a switch on thirty rows.
 */
export function StyleBindings({ label, style, onChange }: { label: string; style: Record<string, unknown>; onChange: (updates: Record<string, unknown>) => void }): React.JSX.Element | null {
  const authoring = useStudioAuthoring();

  if (!authoring) return null;

  const bound = Object.entries(style)
    .map(([key, value]) => ({ key, param: authoring.params.find((p) => p.name === bindingName(value) && p.kind === 'style') }))
    .filter((entry): entry is { key: string; param: NonNullable<typeof entry.param> } => entry.param !== undefined);
  const free = [...Object.keys(STYLE_TOKENS), ...STYLE_HEX_KEYS].filter((key) => choosable(key) !== null && !bound.some((b) => b.key === key));

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <p className="text-xs font-semibold text-slate-700">Each page can choose</p>
      {bound.map(({ key, param }) => {
        const tokens = choosable(key) ?? [];

        return (
          <div key={key} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-xs text-slate-600">{styleWords(key)}, starts as</span>
            {tokens.length > 0 ? (
              <select aria-label={`${styleWords(key)} starts as`} value={paramDefaultText(param)} onChange={(e) => authoring.setDefault(param.name, e.target.value)} className={SELECT}>
                {tokens.map((token) => (
                  <option key={token} value={token}>
                    {tokenLabel(token)}
                  </option>
                ))}
              </select>
            ) : (
              <input aria-label={`${styleWords(key)} starts as`} value={paramDefaultText(param)} onChange={(e) => authoring.setDefault(param.name, e.target.value)} placeholder="#1a73e8" className={SELECT} />
            )}
            <button
              type="button"
              aria-label={`Stop letting pages choose ${styleWords(key)}`}
              onClick={() => authoring.unexpose(param.name)}
              className="whitespace-nowrap rounded-full px-2 py-1 text-xs text-slate-500 outline-none hover:bg-slate-100"
            >
              Stop
            </button>
          </div>
        );
      })}
      <select
        aria-label="Let each page choose a style"
        value=""
        onChange={(e) => {
          const key = e.target.value;
          if (key === '') return;
          const tokens = choosable(key) ?? [];
          const current = typeof style[key] === 'string' ? (style[key] as string) : tokens[0] ?? '#1a73e8';
          const name = authoring.expose(styleWords(`${label} ${key}`.toLowerCase()), 'style', current, { style_key: key });

          onChange({ [key]: pathExpr(`props.${name}`) });
        }}
        className={SELECT}
      >
        <option value="">Let each page choose…</option>
        {free.map((key) => (
          <option key={key} value={key}>
            {styleWords(key)}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * A rich text's Markdown, with "Each page can change this": its whole Markdown becomes a rich-text setting
 * (`{props.intro}`), so bold, links and lists reach each page. `editor` draws the Markdown editor the panel
 * already uses.
 */
export function BindableMarkdown({
  owner,
  markdown,
  onChange,
  editor,
}: {
  owner: string;
  markdown: string;
  onChange: (next: string) => void;
  editor: (value: string, change: (next: string) => void) => React.ReactNode;
}): React.JSX.Element {
  const authoring = useStudioAuthoring();

  if (!authoring) return <>{editor(markdown, onChange)}</>;

  const bound = richTextSetting(markdown);
  const param = bound ? authoring.params.find((p) => p.name === bound) : undefined;

  return (
    <div className="space-y-1.5">
      {param ? (
        <>
          <p className="text-xs font-medium text-slate-600">Starts as</p>
          {editor(paramDefaultText(param), (next) => authoring.setDefault(param.name, next))}
        </>
      ) : (
        editor(markdown, onChange)
      )}
      <label className={ROW}>
        Each page can change this
        <Switch
          aria-label={`Each page can change ${owner}`}
          checked={param !== undefined}
          onCheckedChange={(on) => {
            if (on) {
              onChange(`{props.${authoring.expose(owner, 'rich_text', markdown)}}`);
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
