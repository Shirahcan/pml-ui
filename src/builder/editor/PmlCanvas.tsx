'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

import { elementLabel, isCommentNode, isStudioComment, pageOutline, PML_CATALOG_BY_NAME, renderedPathFor, sourcePathFor, withDerivedAnchors } from '../../language';
import type { PmlNativesPayload, PmlNode } from '../../language';
import { selectionCornerClass } from '../../pml/primitiveStyle';
import type { PmlSite } from '../../renderer/PmlRenderer';
import { CommentStrip, FrameButton, SectionPreview, SectionSkeleton } from './canvasParts';
import { useCatalog } from './catalog';
import { useBuilderHost } from './host';
import { pathElement } from './pathElement';
import { useEditorNoun, useEditorSurface } from './surface';
import { useQuickEdit, type QuickEditOptions } from './useQuickEdit';

/** The site's look around the canvas, from the host: its font classes and its theme's CSS variables (`--site-*`). */
export interface CanvasFrame {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The selection outline is the EDITOR's colour, not the site's (owner 2026-11-17, the reference studio: 2px #625FFB):
 * a site whose accent is black drew black outlines that read as part of the design. --pml-select overrides it.
 */
/**
 * The element an event's target belongs to: the innermost `data-pml-path` holder that DRAWS a box. A run of words
 * inside a paragraph is marked too, but draws no box of its own (it is text inside the paragraph's box), so the pointer
 * over words means the paragraph (owner 2026-11-17: over text the bar never showed, and moving between words and the
 * paragraph's empty space made it flicker on and off).
 */
function holderAt(target: EventTarget | null): HTMLElement | null {
  let holder = (target as HTMLElement | null)?.closest?.<HTMLElement>('[data-pml-path]') ?? null;

  while (holder && !pathElement(holder)) holder = holder.parentElement?.closest<HTMLElement>('[data-pml-path]') ?? null;

  return holder;
}

/** Whether a click landed on no element's drawn content: the section frame itself or its padding / gutters. */
function isEmptySpot(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;

  return Boolean(element?.matches?.('[data-pml-section], [data-pml-frame]'));
}

const SELECTED = 'z-10 outline outline-2 outline-offset-2 outline-[var(--pml-select,#625FFB)]';
const IDLE =
  'hover:outline hover:outline-1 hover:outline-offset-2 hover:outline-[color-mix(in_srgb,var(--pml-select,#625FFB)_45%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pml-select,#625FFB)]';

/** The same outline for an element inside a section, set on the element itself so it keeps its corners. */
const ELEMENT_STYLES = `
[data-pml-selected] { outline: 2px solid var(--pml-select, #625FFB); outline-offset: 2px; }
[data-pml-hover]:not([data-pml-selected]) { outline: 1px solid color-mix(in srgb, var(--pml-select, #625FFB) 45%, transparent); outline-offset: 2px; }
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
  afterSection,
  canDelete,
  canMove,
  onClearSelection,
  renderSelectionBar,
  selectedPath,
  onSelectPath,
  onEditText,
  onEditWords,
  quickEditAll = false,
  documentText,
  onQuickEdit,
  renderElementMenu,
  onElementContextMenu,
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
  /** Editor-only guides drawn right after a section (its layout part's word count, add or remove another). */
  afterSection?: (index: number) => React.ReactNode;
  /** False for a section the document cannot do without: its frame offers no Delete. Absent, every section can go. */
  canDelete?: (index: number) => boolean;
  /**
   * False for a section whose place the document's layout fixes (a post's header, cover, contents): its frame offers no
   * Move up / Move down. Absent, every section can move.
   */
  canMove?: (index: number) => boolean;
  /**
   * A click on no element's content (a section's padding, the canvas below the last section, the guides under a
   * section) clears the selection. Absent, such a click behaves as before (it selects the section).
   */
  onClearSelection?: () => void;
  /**
   * The selected element's bar, drawn over its top-left corner (above it when there is room): its name, the
   * assistant's asks, a repeat's moves. Absent, nothing is drawn.
   */
  renderSelectionBar?: (path: number[]) => React.ReactNode;
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
  /** The document's own text fields, typed in place on the pieces that draw them (see useQuickEdit). */
  documentText?: QuickEditOptions['documentText'];
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
   * A right-click on an element, when the host draws that element's menu itself (the Studio puts it on the selection
   * bar, shared PML Studio P3a). The browser's own menu does not open. Ignored while `renderElementMenu` is given.
   */
  onElementContextMenu?: (path: number[]) => void;
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
  const bar = useRef<HTMLDivElement>(null);
  const quick = useQuickEdit({ nodes, canvas, onEditText, onEditWords, quickEditAll, onQuickEdit, documentText });
  // The element under the pointer, and the element whose menu is open (it stays while the menu is).
  const [hovered, setHovered] = useState<number[] | null>(null);
  const [menuFor, setMenuFor] = useState<number[] | null>(null);
  const deep = onSelectPath !== undefined;
  const same = (a: number[] | null | undefined, b: number[] | null | undefined) => (a ?? []).join('.') === (b ?? []).join('.') && a != null && b != null;
  const toolsFor = menuFor ?? (hovered && !same(hovered, selectedPath) ? hovered : null);

  // The bar shows for the element under the pointer, else the selected one (owner 2026-11-17: on hover, and never under
  // the slide-in panel, which covers the right side): on that element's top-left corner, above it when there is room.
  // Measured after every render (a compile, a selection, a panel opening all move it); a position is not state.
  const barFor = hovered ?? selectedPath;

  useLayoutEffect(() => {
    const root = canvas.current;
    const element = bar.current;

    if (!root || !element || !barFor) return;

    const target =
      barFor.length > 1
        ? pathElement(root.querySelector(`[data-pml-path="${renderedPathFor(nodes, barFor).join('.')}"]`))
        : root.querySelector(`[data-pml-section="${barFor[0]}"]`);

    if (!target) {
      element.style.visibility = 'hidden';

      return;
    }

    const box = target.getBoundingClientRect();
    const frame = root.getBoundingClientRect();
    const top = box.top - frame.top;

    element.style.top = `${top >= element.offsetHeight + 2 ? top - element.offsetHeight : top}px`;
    element.style.left = `${Math.max(box.left - frame.left, 0)}px`;
    element.style.visibility = 'visible';
  });

  /** The source path of the element at an event's target, or null outside every element. */
  const pathAt = (target: EventTarget | null): number[] | null => {
    const element = target as HTMLElement | null;
    const holder = holderAt(element);
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

  // A right-click opens that element's menu, where the pointer is (or tells the host, which draws the menu itself).
  const contextMenu = (event: React.MouseEvent) => {
    if (!renderElementMenu && !onElementContextMenu) return;

    const path = pathAt(event.target);

    if (!path) return;

    event.preventDefault();

    if (renderElementMenu) {
      setMenuFor(path);
    } else {
      onElementContextMenu?.(path);
    }
  };

  const pick = (event: React.MouseEvent, index: number) => {
    if (!onSelectPath) {
      onSelect(index);

      return;
    }

    // On the canvas a click selects; a link inside the design must not navigate away.
    event.preventDefault();

    const holder = holderAt(event.target);

    // Figma-like (owner 2026-11-18: "clicking outside a selected element doesn't remove the selection"): a click that
    // lands on no element's content (a section's padding or gutters, the frame itself) clears a selection. With nothing
    // selected the same click selects the section, so a section stays reachable by clicking it twice. Only a pointer's
    // click clears (`detail` > 0): the section frame is also a button, and pressing it from the keyboard or a screen
    // reader (a click with `detail` 0) still selects that section.
    if (onClearSelection && !holder && selectedPath && event.detail > 0 && isEmptySpot(event.target)) {
      onClearSelection();

      return;
    }

    const rendered = holder?.dataset.pmlPath?.split('.').map(Number) ?? [index];

    onSelectPath(sourcePathFor(nodes, rendered));
  };

  // A click on the canvas outside every section (below the last one) clears the selection too.
  const clearOnEmpty = (event: React.MouseEvent) => {
    if (onClearSelection && selectedPath && event.target === canvas.current) onClearSelection();
  };

  const hover = (event: React.MouseEvent) => {
    if (!deep) return;

    // Moving onto the menu button or the selection bar keeps its element; neither may vanish on the way to a click.
    if (tools.current?.contains(event.target as Node) || bar.current?.contains(event.target as Node)) return;

    canvas.current?.querySelectorAll(`[${HOVER}]`).forEach((element) => element.removeAttribute(HOVER));
    pathElement(holderAt(event.target))?.setAttribute(HOVER, 'true');

    if (renderElementMenu || renderSelectionBar) {
      const path = pathAt(event.target);

      if (leave.current) clearTimeout(leave.current);
      // Only a different element changes the bar; moving within the same one never re-renders it.
      if (!same(path, hovered) && (path !== null || hovered !== null)) setHovered(path);
    }
  };

  // Leaving the canvas hides the hover bar after a short grace, so the edge of an element never makes it flicker.
  const leave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unhover = () => {
    if (leave.current) clearTimeout(leave.current);
    leave.current = setTimeout(() => setHovered(null), 200);
  };
  useEffect(() => () => {
    if (leave.current) clearTimeout(leave.current);
  }, []);

  const studioCatalog = useCatalog();
  const { assistantName } = useBuilderHost();
  const assistant = assistantName?.trim();
  const surface = useEditorSurface();
  const noun = useEditorNoun();
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
      onMouseLeave={unhover}
      onContextMenu={contextMenu}
      onClick={clearOnEmpty}
      aria-busy={building ? true : undefined}
      // `isolate`: the canvas is its own stacking context, so its bars and tools (z-30) stay inside it and never draw
      // over the host's chrome laid over the design, such as the docked Porter console (also z-30, earlier in the page,
      // so the later canvas won the tie; owner 2026-11-18). Menus and dialogs portal to the body, unaffected.
      className={`relative isolate mx-auto ${width} bg-[var(--site-bg)] text-[var(--site-text)] ${bare ? '' : 'border border-black/10 shadow-sm'} ${frame?.className ?? ''} ${building ? 'pointer-events-none select-none' : ''}`}
      style={frame?.style}
    >
      {deep ? <style>{ELEMENT_STYLES}</style> : null}
      {renderElementMenu && toolsFor ? (
        <div ref={tools} data-creator-keep-panel="" className="absolute z-30 -translate-x-full">
          {renderElementMenu(toolsFor, menuFor !== null, (open) => setMenuFor(open ? toolsFor : null))}
        </div>
      ) : null}
      {renderSelectionBar && deep && barFor ? (
        <div ref={bar} className="absolute z-30" style={{ top: 0, left: 0, visibility: 'hidden' }}>
          {renderSelectionBar(barFor)}
        </div>
      ) : null}
      {quick.overlay}
      {nodes.length === 0 && !building ? (
        surface === 'email' ? (
          <div className="px-6 py-20 text-center">
            <p className="text-sm font-medium">This email has no blocks yet</p>
            <p className="mt-1 text-sm opacity-60">Use Add a block below the email to start it.</p>
          </div>
        ) : noun ? (
          // The shared PageEditor names its document and has its Add button under the canvas, not in a menu.
          <div className="px-6 py-20 text-center">
            <p className="text-sm font-medium">This {noun} is empty</p>
            <p className="mt-1 text-sm opacity-60">Use Add a section below to start it.</p>
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

          // A template's note IS drawn (owner 2026-11-17: "visible PML comments ... Same as the Purpose lines"): a
          // "Purpose: ..." line as a quiet strip, a "VERIFY: ..." check in amber with its own "Checked, remove note".
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
              // Named by what it is and where, so it has a name before its preview draws (and when it draws no words).
              aria-label={`${elementLabel(node.component ?? node.primitive ?? 'section', studioCatalog)}, section ${index + 1}`}
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
                <CommentStrip text={typeof node.comment === 'string' ? node.comment : ''} onRemove={building ? undefined : () => onDelete(index)} />
              ) : preview ? (
                <SectionPreview preview={preview} natives={natives} site={site} mobile={viewport === 'mobile'} outline={outline} index={deep ? index : null} />
              ) : (
                <div className="px-6 py-10 text-center text-sm opacity-40">{label}…</div>
              )}

              {selected && !renderElementMenu && !renderSelectionBar ? (
                <div className="absolute right-2 top-2 z-10 flex gap-1">
                  {canMove?.(index) === false ? null : (
                    <>
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
                    </>
                  )}
                  {canDelete?.(index) === false ? null : (
                    <FrameButton
                      label="Delete section"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(index);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </FrameButton>
                  )}
                </div>
              ) : null}
            </div>
            {(() => {
              // The guides under a section (word counts, Add / Remove) are not elements: a click on their words clears a
              // selection like any empty canvas; their buttons still work.
              const after = afterSection?.(index);

              return after ? (
                <div
                  onClick={(event) => {
                    if (onClearSelection && selectedPath && !(event.target as HTMLElement).closest('button, a, input, select, textarea')) onClearSelection();
                  }}
                >
                  {after}
                </div>
              ) : null;
            })()}
            </React.Fragment>
          );
        })
      )}
      {building && skeletonAt >= nodes.length ? <SectionSkeleton label={building.label} /> : null}
      {overlay}
    </div>
  );
}
