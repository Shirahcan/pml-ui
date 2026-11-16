'use client';

import React, { useId, useState } from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '../ui/controls';
import { StudioComponentSettings } from './StudioComponentSettings';
import { useCatalogComponent as useStudioComponent } from './catalog';
import { PML_CATALOG_BY_NAME } from '../../language';
import { holdsWords } from '../../language';
import { type PmlNode } from '../../language';
import { StyleModalTrigger } from './StyleModal';
import { StyleSelect } from './styleControls';
import { BindableMarkdown, ShowHideControl } from './studioBindings';
import { ContainerContents } from './settingsContents';
import { PartialSettings, SlotContents } from './settingsContentsSlots';
import { CodeControl, ItemList, MarkdownControl, ProseSlot, ScriptView, TextBodyControl, WordsControl } from './settingsControls';
import { BindableField } from './settingsFields';

/**
 * The settings rail for a selected PML section.
 *
 * A section is edited three ways, driven by its catalog entry:
 *   - its fields (headline, links, ...) edit `props`;
 *   - a prose slot (about, callout, faq answer) edits a single `rich_text` child's Markdown;
 *   - an item slot (faq, stats, team) edits a list of item sub-components (add / edit / remove).
 * Adding a block never means hand-writing a form: the catalog is the single description.
 */
export function PmlSettings({
  node,
  onChange,
  onDelete,
  canAuthorPml,
  deleteLabel = 'Delete section',
  spanContext,
  onDuplicate,
  creatorControls,
}: {
  node: PmlNode;
  onChange: (next: PmlNode) => void;
  onDelete: () => void;
  /** Scale-tier: unlocks the Motion control + the gradient/image backgrounds. */
  canAuthorPml?: boolean;
  /** "Remove element" when this rail is nested inside a layout container's contents. */
  deleteLabel?: string;
  /** A copy right after this element. Omitted, the button is not offered. */
  onDuplicate?: () => void;
  /** Set when this node is a DIRECT child of a grid: offer col/row span, capped at the columns. */
  spanContext?: { columns: number };
  /**
   * The creator's controls for this element: "Add an element" (before / inside / after it) and "Add to
   * Porter". Given, it is the ONE way to add here, so a container's own add-at-the-end button is not
   * shown.
   */
  creatorControls?: React.ReactNode;
}): React.JSX.Element {
  const name = node.component ?? node.primitive ?? '';
  const def = PML_CATALOG_BY_NAME[name];
  const studio = useStudioComponent(node.component);

  // The space a Studio component leaves for each page's own elements. It has nothing to set.
  if (node.component === 'slot') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Each page that uses this component adds its own elements here.</p>
        {creatorControls}
        <Button type="button" variant="outline" onClick={onDelete} className="w-full whitespace-nowrap text-red-600 outline-none">
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteLabel}
        </Button>
      </div>
    );
  }

  if (studio) {
    return (
      <>
      <StudioComponentSettings
        node={node}
        component={studio}
        onChange={onChange}
        onDelete={onDelete}
        deleteLabel={deleteLabel}
        canAuthorPml={canAuthorPml}
        contents={(slots) => <SlotContents node={node} slots={slots} onChange={onChange} canAuthorPml={canAuthorPml} hideAdd={creatorControls !== undefined} />}
      />
      {creatorControls ? <div className="mt-4">{creatorControls}</div> : null}
      </>
    );
  }

  if (!def) {
    // A component with no catalog entry is one of the site's own components (partials). Its layout is
    // edited in the My components library; here a page sets its declared settings and fills its slots.
    if (node.component) {
      return (
        <>
          <PartialSettings node={node} onChange={onChange} onDelete={onDelete} deleteLabel={deleteLabel} canAuthorPml={canAuthorPml} hideAdd={creatorControls !== undefined} />
          {creatorControls ? <div className="mt-4">{creatorControls}</div> : null}
        </>
      );
    }

    return <p className="text-sm text-[var(--pb-muted)]">This section cannot be edited here.</p>;
  }

  const props = (node.props ?? {}) as Record<string, unknown>;

  const setProp = (key: string, value: unknown) => {
    const nextProps = { ...props };
    if (value === '' || value === undefined || value === null) delete nextProps[key];
    else nextProps[key] = value;
    onChange({ ...node, props: nextProps });
  };

  const setChildren = (children: PmlNode[]) => onChange({ ...node, children });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{def.label}</h3>
        <p className="text-xs text-[var(--pb-muted)]">{def.description}</p>
      </div>

      {def.fields.map((field) => (
        <BindableField key={field.key} owner={def.label} field={field} value={props[field.key]} onChange={(v) => setProp(field.key, v)} />
      ))}

      {/* Steer a form field away from regulated PII: a public form is first contact, not documents. */}
      {node.primitive === 'field' ? <FieldPiiWarning props={props} /> : null}

      {/* The three kinds of words (PML v3 L4): plain text, rich text's Markdown, a paragraph's words. */}
      {node.primitive === 'text' ? <TextBodyControl node={node} onChange={onChange} /> : null}
      {node.primitive === 'rich_text' ? (
        <BindableMarkdown
          owner={def.label}
          markdown={typeof props.markdown === 'string' ? props.markdown : ''}
          onChange={(next) => setProp('markdown', next)}
          editor={(value, change) => <MarkdownControl value={value} onChange={change} />}
        />
      ) : null}
      {node.primitive === 'pre' ? <CodeControl value={typeof props.text === 'string' ? props.text : ''} onChange={(next) => setProp('text', next)} /> : null}
      {node.primitive === 'script' ? <ScriptView source={typeof props.source === 'string' ? props.source : ''} /> : null}
      {holdsWords(node) ? <WordsControl node={node} onChange={onChange} /> : null}

      {def.container ? (
        <ContainerContents
          parent={node}
          nodes={node.children ?? []}
          onChange={setChildren}
          canAuthorPml={canAuthorPml}
          hideAdd={creatorControls !== undefined}
        />
      ) : def.hasSlot ? (
        def.itemComponent ? (
          <ItemList def={def} nodes={node.children ?? []} onChange={setChildren} />
        ) : (
          <ProseSlot nodes={node.children ?? []} onChange={setChildren} />
        )
      ) : null}

      {spanContext ? <SpanControls node={node} onChange={onChange} columns={spanContext.columns} /> : null}

      {/* While designing a Studio component: let each page show or hide this element (p06a). */}
      <ShowHideControl node={node} label={def.label} onChange={onChange} />

      <StyleModalTrigger node={node} onChange={onChange} canAuthorPml={canAuthorPml} />

      <div className="space-y-2 border-t border-white/10 pt-4">
        {creatorControls}
        {onDuplicate ? (
          <Button type="button" variant="outline" onClick={onDuplicate} className="w-full whitespace-nowrap outline-none">
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          onClick={onDelete}
          className="w-full whitespace-nowrap text-red-600 outline-none"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteLabel}
        </Button>
      </div>
    </div>
  );
}

/**
 * How many columns/rows this element spans in its parent grid. Column choices are capped at the
 * grid's own column count (item-12: a span can never exceed the columns), and the values are the
 * closed col_span/row_span style tokens the schema validates.
 */
export function SpanControls({
  node,
  onChange,
  columns,
}: {
  node: PmlNode;
  onChange: (next: PmlNode) => void;
  columns: number;
}): React.JSX.Element {
  const style = (node.style ?? {}) as Record<string, unknown>;
  const val = (key: string): string => (typeof style[key] === 'string' ? (style[key] as string) : '');

  const set = (updates: Record<string, unknown>) => {
    const next: Record<string, unknown> = { ...style };

    for (const [key, value] of Object.entries(updates)) {
      if (value === '' || value === undefined || value === null) delete next[key];
      else next[key] = value;
    }

    onChange({ ...node, style: next });
  };

  const colOptions = Array.from({ length: 12 }, (_, i) => String(i + 1)).filter((n) => Number(n) <= columns);

  return (
    <div className="space-y-3 border-t border-white/10 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--pb-muted)]">Size in the grid</p>
      <StyleSelect label="Columns wide" value={val('col_span')} options={colOptions} onChange={(v) => set({ col_span: v })} />
      <StyleSelect label="Rows tall" value={val('row_span')} options={['1', '2', '3']} onChange={(v) => set({ row_span: v })} />
    </div>
  );
}

/**
 * A layout container's contents: arbitrary primitive children, each edited RECURSIVELY through
 * this same rail, so a child gets its own fields, its own appearance, and (if it is itself a
 * container) its own contents. Reordering and removal live HERE because a nested child is not
 * selectable on the canvas: canvas selection is deliberately top-level only.
 *
 * Children collapse into <details> so a deep layout stays readable in a 360px rail, and the
 * picker is restricted to Basic + Layout: a hero or a module primitive does not belong inside a box.
 */
/** Field names/labels that indicate regulated immigration PII a public form must never collect. */
export const REGULATED_PII =
  /passport|\bsin\b|social insurance|\buci\b|\bdob\b|date of birth|immigration (?:number|no\b)|permanent resident card|\bpr card\b|nexus/i;

/**
 * A non-blocking guardrail on a form field: a public form is marketing lead-capture, first contact,
 * NOT a document channel. If a field name/label looks like it collects regulated immigration PII,
 * warn and steer the consultant to the secure case workspace. It warns, never blocks: the consultant
 * knows their practice, and a false positive should not stop them.
 */
export function FieldPiiWarning({ props }: { props: Record<string, unknown> }): React.JSX.Element | null {
  const text = [props.label, props.name, props.placeholder]
    .filter((v): v is string => typeof v === 'string')
    .join(' ');

  if (!REGULATED_PII.test(text)) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      This looks like it collects sensitive immigration details (a passport number, SIN, date of birth,
      or similar). A public form is for first contact, not documents: never collect regulated
      information here. Ask for it inside the client&rsquo;s secure case workspace once they are onboarded.
    </div>
  );
}
