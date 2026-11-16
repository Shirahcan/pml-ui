'use client';

import React from 'react';
import { ArrowUpCircle, Trash2 } from 'lucide-react';

import { MediaField } from './MediaField';
import { StyleModalTrigger } from './StyleModal';
import { Button } from '../ui/controls';
import { Input } from '../ui/controls';
import { Textarea } from '../ui/controls';
import { MarkdownEditor } from './MarkdownEditor';
import { ParamListEditor } from './ParamListEditor';
import { Switch } from '../ui/controls';
import { paramDefaultText, type DocumentLibraryComponent as BuilderStudioComponent, type StudioParam, type StudioSlot } from '../components';
import { isExpr } from '../../language';
import { STYLE_HEX_KEYS, STYLE_TOKENS, type PmlNode } from '../../language';
import { literalExpr, literalValue } from '../../language';
import { tokenLabel } from '../../language';

const SELECT = 'w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none';

/** A style setting's choices: its style's tokens (no "custom"), or none for a #rrggbb colour. */
function styleChoices(styleKey: string | undefined): readonly string[] {
  if (!styleKey || (STYLE_HEX_KEYS as readonly string[]).includes(styleKey)) return [];

  return ((STYLE_TOKENS as Record<string, readonly string[]>)[styleKey] ?? []).filter((t) => t !== 'custom');
}

/**
 * One setting of a component on a page, with the control its kind needs (component props p07a/p07b): words,
 * a number, yes or no, formatted text, a style, a list or a map. A value fed by page data shows what it reads.
 */
export function ParamField({ param, value: stored, onChange }: { param: StudioParam; value: unknown; onChange: (next: unknown) => void }): React.JSX.Element {
  const id = `studio-param-${param.name}`;
  const fallback = paramDefaultText(param);
  // A JS-like literal written in code (`{false}`, `{49}`, `{[...]}`) is a fixed value, not page data.
  const literal = isExpr(stored) ? literalValue(stored) : undefined;
  const value = literal !== undefined && typeof literal !== 'object' ? literal : stored;
  const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  const collection = param.kind === 'list' || param.kind === 'map';
  const rows = collection ? (literalValue(stored) ?? literalValue(param.default) ?? (param.kind === 'list' ? [] : {})) : undefined;
  // Page data (owner.packages, state.x) rather than a value typed here.
  const reads = isExpr(stored) && literal === undefined ? stored.$expr : null;

  return (
    <div>
      <label htmlFor={id} id={`${id}-label`} className="mb-1 block text-sm font-medium">
        {param.label}
      </label>

      {reads !== null ? (
        <div className="space-y-1.5">
          <p className="rounded-md border border-dashed border-slate-300 px-3 py-2 font-mono text-xs text-slate-600">Reads {`{${reads}}`}</p>
          <button type="button" onClick={() => onChange(undefined)} className="whitespace-nowrap rounded-full border border-slate-200 px-3 py-1 text-xs outline-none hover:bg-slate-50">
            Use a fixed value
          </button>
        </div>
      ) : collection ? (
        <ParamListEditor spec={param} value={rows} onChange={(next) => onChange(literalExpr(next))} />
      ) : param.kind === 'long_text' ? (
        <Textarea id={id} value={text} rows={3} placeholder={fallback} onChange={(e) => onChange(e.target.value)} className="px-3 py-2 outline-none" />
      ) : param.kind === 'rich_text' ? (
        <MarkdownEditor value={typeof value === 'string' ? value : fallback} onChange={(next) => onChange(next)} labelledBy={`${id}-label`} />
      ) : param.kind === 'image' ? (
        <MediaField value={text} onChange={onChange} />
      ) : param.kind === 'number' ? (
        <Input id={id} type="number" value={text} placeholder={fallback} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} className="px-3 py-2 outline-none" />
      ) : param.kind === 'yes_no' ? (
        <Switch id={id} checked={typeof value === 'boolean' ? value : fallback === 'true'} onCheckedChange={(on) => onChange(on)} className="outline-none" />
      ) : param.kind === 'enum' || (param.kind === 'style' && styleChoices(param.style_key).length > 0) ? (
        <select id={id} value={text || fallback} onChange={(e) => onChange(e.target.value)} className={SELECT}>
          {(param.kind === 'enum' ? (param.options ?? []) : styleChoices(param.style_key)).map((option) => (
            <option key={option} value={option}>
              {param.kind === 'style' ? tokenLabel(option) : option}
            </option>
          ))}
        </select>
      ) : (
        <Input id={id} type={param.kind === 'url' ? 'url' : 'text'} value={text} placeholder={fallback} onChange={(e) => onChange(e.target.value)} className="px-3 py-2 outline-none" />
      )}

      {param.help ? <p className="mt-1 text-xs text-slate-500">{param.help}</p> : null}
    </div>
  );
}

/**
 * The rail for a Portify component on a page. It edits only what the component offers (its settings,
 * its looks, the elements in its slot). The design itself belongs to the Studio, so a page can never
 * drift from it. A page stays on the version it was built with until someone chooses to update it.
 */
export function StudioComponentSettings({
  node,
  component,
  onChange,
  onDelete,
  deleteLabel = 'Delete section',
  canAuthorPml,
  contents,
}: {
  node: PmlNode;
  component: BuilderStudioComponent;
  onChange: (next: PmlNode) => void;
  onDelete: () => void;
  deleteLabel?: string;
  canAuthorPml?: boolean;
  /** The rail's own contents lists, one per slot, handed in so this file does not import the rail back. */
  contents: (slots: StudioSlot[]) => React.ReactNode;
}): React.JSX.Element {
  const props = (node.props ?? {}) as Record<string, unknown>;
  const current = component.current_version ?? 0;
  const pinned = Number(props.version) || current;
  const version = component.versions[String(pinned)] ?? component.versions[String(current)];
  const params = version?.params ?? [];
  const looks = version?.looks ?? [];

  const setProp = (name: string, value: unknown) => {
    const next = { ...props };

    // An emptied setting falls back to the component's default.
    if (value === '' || value === undefined || value === null) delete next[name];
    else next[name] = value;

    onChange({ ...node, props: next });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{component.name}</h3>
        {component.description ? <p className="text-xs text-slate-500">{component.description}</p> : null}
      </div>

      {component.offered ? null : (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">This component is being retired. It keeps working here, and it is no longer offered for new sections.</p>
      )}

      {pinned < current ? (
        <div className="rounded-lg border border-[color-mix(in_srgb,var(--pb-accent)_30%,transparent)] bg-[color-mix(in_srgb,var(--pb-accent)_5%,transparent)] px-3 py-2">
          <p className="text-xs text-slate-700">
            This section uses version {pinned}. Version {current} is available.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange({ ...node, props: { ...props, version: current } })} className="mt-2 whitespace-nowrap rounded-full outline-none">
            <ArrowUpCircle className="mr-1.5 h-4 w-4" />
            Update to version {current}
          </Button>
        </div>
      ) : null}

      {params.map((param) => (
        <ParamField key={param.name} param={param} value={props[param.name]} onChange={(value) => setProp(param.name, value)} />
      ))}

      {looks.length > 0 ? (
        <div>
          <label htmlFor="studio-look" className="mb-1 block text-sm font-medium">
            Look
          </label>
          <select id="studio-look" value={typeof props.look === 'string' ? props.look : ''} onChange={(e) => setProp('look', e.target.value)} className={SELECT}>
            <option value="">Default</option>
            {looks.map((look) => (
              <option key={look.name} value={look.name}>
                {look.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {contents(version?.slots ?? (version?.has_slot === true ? [{ name: '', label: 'Content' }] : []))}

      <StyleModalTrigger node={node} onChange={onChange} canAuthorPml={canAuthorPml} />

      <div className="border-t border-white/10 pt-4">
        <Button type="button" variant="outline" onClick={onDelete} className="w-full whitespace-nowrap text-red-600 outline-none">
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteLabel}
        </Button>
      </div>
    </div>
  );
}
