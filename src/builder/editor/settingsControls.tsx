'use client';

import React, { useId, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/controls';
import { Textarea } from '../ui/controls';
import { useStudioAuthoring } from './authoring';
import { PML_CATALOG_BY_NAME, type PmlComponentDef, type PmlFieldDef } from '../../language';
import { MarkdownEditor } from './MarkdownEditor';
import { canEditVisually, ParagraphEditor } from './ParagraphEditor';
import { type PmlNode } from '../../language';
import { BindableField, FieldControl } from './settingsFields';
import { useBuilderHost } from './host';
/** A `text` element's words (PML v3 L4): plain words, or live page data shown as a chip. */
export function TextBodyControl({ node, onChange }: { node: PmlNode; onChange: (next: PmlNode) => void }): React.JSX.Element {
  const authoring = useStudioAuthoring();
  const props = (node.props ?? {}) as Record<string, unknown>;
  const field: PmlFieldDef = { key: 'value', label: 'Words', kind: 'textarea' };
  const setValue = (next: unknown) => onChange({ ...node, props: { ...props, value: next } });

  return authoring ? (
    <BindableField owner="Text" field={field} value={props.value} onChange={setValue} />
  ) : (
    <FieldControl field={field} value={props.value} onChange={setValue} />
  );
}

/**
 * Rich text's Markdown, as written (PML v3 L4, owner decision 4A: rich text stores the Markdown). The
 * page draws it formatted; a `{...}` in it shows live page data.
 */
export function MarkdownControl({ value, onChange }: { value: string; onChange: (next: string) => void }): React.JSX.Element {
  const id = `pml-markdown-${useId()}`;
  // Visual by default (no-code first); the Markdown it saves is one toggle away (PML v3 L6).
  const [source, setSource] = useState(false);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p id={id} className="text-sm font-medium">
          Content
        </p>
        <button type="button" aria-pressed={source} onClick={() => setSource(!source)} className="whitespace-nowrap rounded-full px-2 py-0.5 text-xs text-slate-600 outline-none hover:bg-black/5">
          {source ? 'Visual' : 'Markdown'}
        </button>
      </div>
      {source ? (
        <>
          <Textarea aria-labelledby={id} name="markdown" rows={8} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Write in your own voice." className="px-3 py-2 font-mono text-sm outline-none" />
          <p className="mt-1 text-xs text-slate-500">
            Markdown: **bold**, *italic*, [a link](https://...), - a list, ## a heading. {'{owner.name}'} shows page data.
          </p>
        </>
      ) : (
        <MarkdownEditor value={value} onChange={onChange} labelledBy={id} />
      )}
    </div>
  );
}

/** A code block's code (PML v3 L5): shown exactly as written, so the box is monospace and keeps tabs. */
export function CodeControl({ value, onChange }: { value: string; onChange: (next: string) => void }): React.JSX.Element {
  const id = `pml-code-${useId()}`;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        Code
      </label>
      <Textarea id={id} name="code" rows={8} spellCheck={false} value={value} onChange={(e) => onChange(e.target.value)} className="px-3 py-2 font-mono text-sm outline-none" />
      <p className="mt-1 text-xs text-slate-500">Shown exactly as written. Nothing in it runs.</p>
    </div>
  );
}

/**
 * A script, read-only (2026-11-10). Its compiled program must always be made from its source, so it changes
 * in the Code view (or by asking the host's assistant), never in a box here that could leave the two apart.
 */
export function ScriptView({ source }: { source: string }): React.JSX.Element {
  const id = `pml-script-${useId()}`;
  const assistant = useBuilderHost().assistantName?.trim();

  return (
    <div role="group" aria-labelledby={id}>
      <p id={id} className="mb-1 block text-sm font-medium">
        What it does
      </p>
      <pre className="max-h-64 overflow-auto rounded-xl bg-slate-950 px-3 py-2 text-xs leading-relaxed text-slate-100">
        <code>{source}</code>
      </pre>
      <p className="mt-1 text-xs text-slate-500">
        {assistant ? `Change it in the Code view, or ask ${assistant} in the console to explain or change it.` : 'Change it in the Code view.'}
      </p>
    </div>
  );
}

/** What a paragraph says, its inline elements and page data included, for showing it read-only. */
export function wordsOf(nodes: PmlNode[]): string {
  return nodes
    .map((n) => {
      const value = n.props?.value;

      if (n.primitive === 'br') return ' ';
      if (n.primitive === 'code') return String(n.props?.text ?? '');
      if (typeof value === 'string') return value;
      if (value && typeof value === 'object' && '$expr' in value) return `{${String((value as { $expr: unknown }).$expr)}}`;

      return wordsOf(n.children ?? []);
    })
    .join('');
}

/**
 * The words of a paragraph or an inline element (PML v3 L4). Plain words edit here; words with bold,
 * links or page data inside them are shown as they read and edited in the Code view, where every piece
 * has its tag.
 */
export function WordsControl({ node, onChange }: { node: PmlNode; onChange: (next: PmlNode) => void }): React.JSX.Element {
  const id = `pml-words-${useId()}`;
  const kids = node.children ?? [];

  // Every piece has an editor form (runs, bold, italic, code, links, line breaks, page data): edit it here.
  if (!canEditVisually(kids)) {
    return (
      <div role="group" aria-labelledby={id}>
        <p id={id} className="mb-1 block text-sm font-medium">
          Words
        </p>
        <p className="rounded-xl border border-white/30 bg-white/40 px-3 py-2 text-sm text-slate-700">{wordsOf(kids)}</p>
        <p className="mt-1 text-xs text-slate-500">These words hold something the editor cannot show (a highlight, a key, a styled word...). Change them in the Code view.</p>
      </div>
    );
  }

  return (
    <div>
      <p id={id} className="mb-1 block text-sm font-medium">
        Words
      </p>
      <ParagraphEditor words={kids} onChange={(children) => onChange({ ...node, children })} labelledBy={id} />
    </div>
  );
}

/** A prose slot: one rich text child holding the section's Markdown (PML v3 L4). */
export function ProseSlot({
  nodes,
  onChange,
}: {
  nodes: PmlNode[];
  onChange: (children: PmlNode[]) => void;
}): React.JSX.Element {
  const prose = nodes.find((c) => c.primitive === 'rich_text');
  const markdown = typeof prose?.props?.markdown === 'string' ? prose.props.markdown : '';

  return <MarkdownControl value={markdown} onChange={(next) => onChange(next === '' ? [] : [{ ...(prose ?? {}), primitive: 'rich_text', props: { markdown: next } }])} />;
}

/** An item slot: a list of item sub-components (faq_item, stat, ...). */
export function ItemList({
  def,
  nodes,
  onChange,
}: {
  def: PmlComponentDef;
  nodes: PmlNode[];
  onChange: (children: PmlNode[]) => void;
}): React.JSX.Element {
  const itemDef = def.itemComponent ? PML_CATALOG_BY_NAME[def.itemComponent] : undefined;

  const setItem = (index: number, next: PmlNode) => {
    const copy = [...nodes];
    copy[index] = next;
    onChange(copy);
  };

  return (
    <div>
      <p className="mb-2 text-sm font-medium">{itemDef?.label ?? 'Items'}</p>

      <div className="space-y-3">
        {nodes.map((child, index) => (
          <div key={index} className="rounded-xl border border-white/20 bg-white/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--pb-muted)]">{index + 1}</span>
              <button
                type="button"
                aria-label={`Remove item ${index + 1}`}
                onClick={() => onChange(nodes.filter((_, i) => i !== index))}
                className="rounded p-1 text-red-600 outline-none hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {(itemDef?.fields ?? []).map((field) => (
              <div key={field.key} className="mb-2">
                <FieldControl
                  field={field}
                  value={(child.props ?? {})[field.key]}
                  onChange={(v) => {
                    const nextProps = { ...(child.props ?? {}) };
                    if (v === '' || v === undefined) delete nextProps[field.key];
                    else nextProps[field.key] = v;
                    setItem(index, { ...child, props: nextProps });
                  }}
                />
              </div>
            ))}

            {itemDef?.hasSlot ? (
              <ProseSlot
                nodes={child.children ?? []}
                onChange={(nextChildren) => setItem(index, { ...child, children: nextChildren })}
              />
            ) : null}
          </div>
        ))}
      </div>

      {itemDef ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => onChange([...nodes, structuredClone(itemDef.defaults)])}
          className="mt-3 w-full whitespace-nowrap border-dashed outline-none"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add {itemDef.label.toLowerCase()}
        </Button>
      ) : null}
    </div>
  );
}
