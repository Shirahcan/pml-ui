'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

import { isCommentNode, isStudioComment, pageOutline, PML_CATALOG_BY_NAME, renderedPathFor, sourcePathFor, withDerivedAnchors } from '../../language';
import type { PmlNativesPayload, PmlNode } from '../../language';
import { selectionCornerClass } from '../../pml/primitiveStyle';
import type { PmlSite } from '../../renderer/PmlRenderer';
import { CommentStrip, FrameButton, SectionPreview, SectionSkeleton } from './canvasParts';
import { useCatalog } from './catalog';
import { useBuilderHost } from './host';
import { pathElement } from './pathElement';
import { useEditorSurface } from './surface';
import { useQuickEdit } from './useQuickEdit';

/** The site's look around the canvas, from the host: its font classes and its theme's CSS variables (`--site-*`). */
export interface CanvasFrame {
  className?: string;
  style?: React.CSSProperties;
}

const SELECTED = 'z-10 outline outline-2 outline-offset-2 outline-[var(--site-accent)]';
const IDLE =
  'hover:outline hover:outline-1 hover:outline-offset-2 hover:outline-[color-mix(in_srgb,var(--site-accent)_45%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--site-accent)]';

/** The same outline for an element inside a section, set on the element itself so it keeps its corners. */
const ELEMENT_STYLES = `
[data-pml-selected] { outline: 2px solid var(--site-accent); outline-offset: 2px; }
[data-pml-hover]:not([data-pml-selected]) { outline: 1px solid color-mix(in srgb, var(--site-accent) 45%, transparent); outline-offset: 2px; }
`;

const HOVER = 'data-pml-hover';
const SELECTED_MARK = 'data-pml-selected';

/**
 * The builder canvas for PML pages.
 *
 * Each top-level component expands to exactly one primitive root, so `compiled[i]` is the
 * rendered form of `nodes[i]` and selection stays a simple top-level index. The canvas draws
 * each component's COMPILED preview (via the same PmlRenderer the public page uses, under the
 * site theme) inside a selectable frame; item-children (FAQ entries, stats) are edited in the
 * rail, not selected here. Until the debounced compile returns, a labelled skeleton stands in
 * so an edit never blanks the page.
 */
export function PmlCanvas({
  natives = null,
  nodes,
  compiled,
  site,
  selectedIndex,
  viewport,
  onSelect,
  onMove,
  onDelete,
  bare = false,
  selectedPath,
  onSelectPath,
  onEditText,
  onEditWords,
  quickEditAll = false,
  onQuickEdit,
  renderElementMenu,
  building = null,
  overlay = null,
  frame,
}: {
  nodes: PmlNode[];
  compiled: PmlNode[] | null;
  /** What the page's `{...}` expressions read (PML v3 L3), from the latest preview. */
  natives?: PmlNativesPayload | null;
  /** The host's site record, handed to its own elements; the canvas never reads it. */
  site: PmlSite;
  selectedIndex: number | null;
  viewport: 'desktop' | 'mobile';
  onSelect: (index: number | null) => void;
  onMove: (from: number, to: number) => void;
  onDelete: (index: number) => void;
  /** No page edge around the design: for a surface that already sits on the site's background. */
  bare?: boolean;
  /** With these, any element inside a section can be selected, not only the section (S4-02). */
  selectedPath?: number[] | null;
  onSelectPath?: (path: number[]) => void;
  /** With this, double-clicking a heading, paragraph or button edits its words in place (S4-05). */
  onEditText?: (path: number[], field: string, value: string) => void;
  /**
   * Quick edits reach text inside components too (post layouts E1, owner 2026-11-16): words that are one of
   * the component's own props edit that prop in place. Off by default, so a host turns it on behind its gate.
   */
  quickEditAll?: boolean;
  /** With this and `quickEditAll`, a paragraph with bold, links or page data edits in place in the rich editor (post layouts E2). */
  onEditWords?: (path: number[], children: PmlNode[]) => void;
  /** Told when a quick edit starts (true) and ends (false), so the host keeps its side panel shut meanwhile. */
  onQuickEdit?: (editing: boolean) => void;
  /**
   * An element's own menu (creator shell, owner 2026-11-07): a three-dot button at the top-right of
   * the element under the pointer, never on the selected one (its panel is already open). A
   * right-click opens it for that element. Given, the section's move and delete buttons are not drawn.
   */
  renderElementMenu?: (path: number[], open: boolean, onOpenChange: (open: boolean) => void) => React.ReactNode;
  /**
   * The assistant is writing the page (C3, owner 2026-11-07): the canvas is look-only, and a flashing
   * skeleton stands where the next section is being written (`at`, before that position); `label` is
   * the phrase for what it is ("the FAQ", "a section").
   */
  building?: { at: number; label: string | null } | null;
  /**
   * Drawn over the page, inside the canvas so it scrolls with it: the studio comments' pins (D2).
   * A studio comment is never drawn in the flow; its pin stands on its element instead.
   */
  overlay?: React.ReactNode;
  /** The site's look (fonts, theme variables), so the design reads as it will live. */
  frame?: CanvasFrame;
}): React.JSX.Element {
  const canvas = useRef<HTMLDivElement>(null);
  const tools = useRef<HTMLDivElement>(null);
  const quick = useQuickEdit({ nodes, canvas, onEditText, onEditWords, quickEditAll, onQuickEdit });
  // The element under the pointer, and the element whose menu is open (it stays while the menu is).
  const [hovered, setHovered] = useState<number[] | null>(null);
  const [menuFor, setMenuFor] = useState<number[] | null>(null);
  const deep = onSelectPath !== undefined;
  const same = (a: number[] | null | undefined, b: number[] | null | undefined) => (a ?? []).join('.') === (b ?? []).join('.') && a != null && b != null;
  const toolsFor = menuFor ?? (hovered && !same(hovered, selectedPath) ? hovered : null);

  /** The source path of the element at an event's target, or null outside every element. */
  const pathAt = (target: EventTarget | null): number[] | null => {
    const element = target as HTMLElement | null;
    const holder = element?.closest?.<HTMLElement>('[data-pml-path]');
    const section = element?.closest?.<HTMLElement>('[data-pml-section]');
    const rendered = holder?.dataset.pmlPath?.split('.').map(Number) ?? (section ? [Number(section.dataset.pmlSection)] : null);

    return rendered ? sourcePathFor(nodes, rendered) : null;
  };

  // Mark the selected element directly, so the outline is its own and follows its own corners.
  useEffect(() => {
    const root = canvas.current;

    if (!root || !deep) return;

    root.querySelectorAll(`[${SELECTED_MARK}]`).forEach((element) => element.removeAttribute(SELECTED_MARK));

    if (selectedPath && selectedPath.length > 1) {
      const key = renderedPathFor(nodes, selectedPath).join('.');

      pathElement(root.querySelector(`[data-pml-path="${key}"]`))?.setAttribute(SELECTED_MARK, 'true');
    }

    const target = !toolsFor
      ? null
      : toolsFor.length > 1
        ? pathElement(root.querySelector(`[data-pml-path="${renderedPathFor(nodes, toolsFor).join('.')}"]`))
        : root.querySelector(`[data-pml-section="${toolsFor[0]}"]`);

    // The menu sits at the element's top-right corner. Set on the node directly: a position is not
    // state, and storing it would re-render the canvas for every measurement.
    if (tools.current && target) {
      const box = target.getBoundingClientRect();
      const frame = root.getBoundingClientRect();
      // The creator's panel floats over the canvas: a menu under it could not be clicked, so it stays
      // just left of the panel when the element runs beneath it.
      // Measured where it COMES TO REST (it is fixed to the right edge and slides in), not mid-slide.
      const panel = document.querySelector<HTMLElement>('[data-creator-panel][aria-hidden="false"]');
      const visibleRight = panel ? Math.min(box.right, document.documentElement.clientWidth - panel.offsetWidth - 8) : box.right;

      tools.current.style.top = `${Math.max(box.top - frame.top + 6, 6)}px`;
      tools.current.style.left = `${Math.max(visibleRight, box.left + 36) - frame.left - 6}px`;
    }
  });

  // A right-click opens that element's menu, where the pointer is.
  const contextMenu = (event: React.MouseEvent) => {
    if (!renderElementMenu) return;

    const path = pathAt(event.target);

    if (!path) return;

    event.preventDefault();
    setMenuFor(path);
  };

  const pick = (event: React.MouseEvent, index: number) => {
    if (!onSelectPath) {
      onSelect(index);

      return;
    }

    // On the canvas a click selects; a link inside the design must not navigate away.
    event.preventDefault();

    const holder = (event.target as HTMLElement).closest<HTMLElement>('[data-pml-path]');
    const rendered = holder?.dataset.pmlPath?.split('.').map(Number) ?? [index];

    onSelectPath(sourcePathFor(nodes, rendered));
  };

  const hover = (event: React.MouseEvent) => {
    if (!deep) return;

    // Moving onto the menu button keeps its element; it must not vanish on the way to a click.
    if (tools.current?.contains(event.target as Node)) return;

    canvas.current?.querySelectorAll(`[${HOVER}]`).forEach((element) => element.removeAttribute(HOVER));
    pathElement((event.target as HTMLElement).closest('[data-pml-path]'))?.setAttribute(HOVER, 'true');

    if (renderElementMenu) {
      const path = pathAt(event.target);

      if (!same(path, hovered) && (path !== null || hovered !== null)) setHovered(path);
    }
  };

  const studioCatalog = useCatalog();
  const { assistantName } = useBuilderHost();
  const assistant = assistantName?.trim();
  const surface = useEditorSurface();
  const width = viewport === 'mobile' ? 'max-w-sm' : 'max-w-5xl';
  // The WHOLE page's headings (S1-06): each section renders alone here, so a table of contents
  // would otherwise list only its own section.
  const rawOutline = pageOutline(withDerivedAnchors(compiled ?? []));
  const outlineKey = JSON.stringify(rawOutline);
  // Stable while the headings are, so a finished section is not redrawn when another one lands.
  const outline = useMemo(() => JSON.parse(outlineKey) as ReturnType<typeof pageOutline>, [outlineKey]);
  const skeletonAt = building ? Math.min(building.at, nodes.length) : -1;

  return (
    <div
      ref={canvas}
      onMouseMove={hover}
      onMouseLeave={() => setHovered(null)}
      onContextMenu={contextMenu}
      aria-busy={building ? true : undefined}
      className={`relative mx-auto ${width} bg-[var(--site-bg)] text-[var(--site-text)] ${bare ? '' : 'border border-black/10 shadow-sm'} ${frame?.className ?? ''} ${building ? 'pointer-events-none select-none' : ''}`}
      style={frame?.style}
    >
      {deep ? <style>{ELEMENT_STYLES}</style> : null}
      {renderElementMenu && toolsFor ? (
        <div ref={tools} data-creator-keep-panel="" className="absolute z-30 -translate-x-full">
          {renderElementMenu(toolsFor, menuFor !== null, (open) => setMenuFor(open ? toolsFor : null))}
        </div>
      ) : null}
      {quick.overlay}
      {nodes.length === 0 && !building ? (
        surface === 'email' ? (
          <div className="px-6 py-20 text-center">
            <p className="text-sm font-medium">This email has no blocks yet</p>
            <p className="mt-1 text-sm opacity-60">Use Add a block below the email to start it.</p>
          </div>
        ) : (
          <div className="px-6 py-20 text-center">
            <p className="text-sm font-medium">This page is empty</p>
            <p className="mt-1 text-sm opacity-60">
              {assistant ? `Use Add a section in the Actions menu, or ask ${assistant}, to start building.` : 'Use Add a section in the Actions menu to start building.'}
            </p>
          </div>
        )
      ) : (
        nodes.map((node, index) => {
          // A studio comment (D1) is drawn as a pin by the overlay, never as a strip in the page.
          if (isStudioComment(node)) return index === skeletonAt ? <SectionSkeleton key={index} label={building?.label ?? null} /> : null;

          const comment = isCommentNode(node);
          const name = node.component ?? node.primitive ?? 'section';
          const label = comment ? 'Comment' : (PML_CATALOG_BY_NAME[name]?.label ?? studioCatalog.find((c) => c.key === name)?.name ?? 'Section');
          // The compiled preview DROPS comments (they never render), so a non-comment node's preview
          // sits at its position AMONG non-comment nodes, not at its raw index. Mapping by that count
          // keeps every block's preview aligned even when comments are interleaved (a top-level comment
          // would otherwise shift every later preview by one - the desync this fixes).
          const compiledIndex = comment ? -1 : nodes.slice(0, index).filter((n) => !isCommentNode(n)).length;
          const preview = comment ? null : (compiled?.[compiledIndex] ?? null);
          const selected = deep ? selectedPath?.length === 1 && selectedPath[0] === index : selectedIndex === index;

          return (
            <React.Fragment key={index}>
            {index === skeletonAt ? <SectionSkeleton label={building?.label ?? null} /> : null}
            <div
              role="button"
              tabIndex={0}
              // A press here selects this section, so the creator's panel must not close on it.
              data-pml-section={index}
              onClick={(event) => pick(event, index)}
              onDoubleClick={(event) => quick.start(event, index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (onSelectPath) onSelectPath([index]);
                  else onSelect(index);
                }
              }}
              className={`group relative cursor-pointer ${selectionCornerClass(node.style)} ${selected ? SELECTED : IDLE}`}
            >
              {comment ? (
                <CommentStrip text={typeof node.comment === 'string' ? node.comment : ''} />
              ) : preview ? (
                <SectionPreview preview={preview} natives={natives} site={site} mobile={viewport === 'mobile'} outline={outline} index={deep ? index : null} />
              ) : (
                <div className="px-6 py-10 text-center text-sm opacity-40">{label}…</div>
              )}

              {selected && !renderElementMenu ? (
                <div className="absolute right-2 top-2 z-10 flex gap-1">
                  <FrameButton
                    label="Move up"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(index, index - 1);
                    }}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </FrameButton>
                  <FrameButton
                    label="Move down"
                    disabled={index === nodes.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMove(index, index + 1);
                    }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </FrameButton>
                  <FrameButton
                    label="Delete section"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(index);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </FrameButton>
                </div>
              ) : null}
            </div>
            </React.Fragment>
          );
        })
      )}
      {building && skeletonAt >= nodes.length ? <SectionSkeleton label={building.label} /> : null}
      {overlay}
    </div>
  );
}
