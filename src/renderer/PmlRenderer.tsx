'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowUp,
  Award,
  Briefcase,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  Globe,
  Heart,
  Info,
  Lightbulb,
  Loader2,
  type LucideIcon,
  MapPin,
  MessageCircle,
  OctagonAlert,
  Phone,
  Send,
  Star,
  Users,
} from 'lucide-react';

import { RichText, RichTextExprContext } from '../richText/RichText';
import { expandRichAtoms, isRichKind, plainWords } from '../pml/richValues';
import { InlineContext, isInlinePrimitive, renderInline, renderRun } from './PmlInline';
import { isBlockElement, renderBlock, SELF_MARKED_PARTS, WORD_PARTS } from './PmlBlocks';
import { NOT_SENT_IN_PREVIEW, PREVIEW_NOT_SENT_NOTE, useSiteInteractions } from './SiteInteractionContext';
import { PmlPackages } from './modules/PmlPackages';
import { PmlTestimonials } from './modules/PmlTestimonials';
import { PmlPostDisclaimer, PmlPostHeader, PmlPostRelated } from './modules/PmlPostParts';
import {
  PmlPostAuthor,
  PmlPostBadges,
  PmlPostBreadcrumbs,
  PmlPostCategory,
  PmlPostCoverPiece,
  PmlPostDate,
  PmlPostDek,
  PmlPostReadTime,
  PmlPostReviewer,
  PmlPostReviewerBadge,
  PmlPostSourcesBadge,
  PmlPostTags,
  PmlPostTitle,
} from './modules/PmlPostPieces';
import { PmlPostCta } from './modules/PmlPostCta';
import {
  EMPTY_BLOCK,
  EMPTY_MARK,
  POST_CAPTION,
  POST_CELL,
  POST_H2,
  POST_HEADER_CELL,
  POST_TABLE,
  POST_TABLE_CARD,
  PostAnswer,
  PostFaqItem,
  PostFlavorContext,
} from './modules/PmlPostFlavor';
import { PmlPostStory } from './modules/PmlPostStory';
import { evaluateIn, handleIn, PmlScopeProvider, PslScript, usePmlScope, usePslRuntime, type PmlScope } from './modules/PslScript';
import { MotionStyles, PmlMotion } from './PmlMotion';
import { SectionFrame } from './SectionFrame';
import { isPmlEvent, type PmlNode, type ReactiveEvent } from '../pml/primitives';
import { fromPslValue, isExpr, valueText, type PmlNativesPayload } from '../pml/expressions';
import { COMPONENT_PROSE, ELEMENTS } from '../pml/elements.generated';
import { isCommentNode } from '../pml/nodeTree';
import { isBracketedExample } from '../pml/examples';
import { ACCENT_BUTTON, bodyScale, gapClass, headingScale, panelGutterClass, resolvePrimitiveStyle, themeCornerClass, withResponsive } from '../pml/primitiveStyle';
import { anchorId, pageOutline, withDerivedAnchors, type OutlineEntry } from '../pml/anchors';
import { PmlCarousel, PmlMarquee } from './PmlCarousel';
import { assertSafeUrl } from '../security/assertSafeUrl';
import { applyMutation, truthy, type PageRuntime, type Value } from '../psl';

// URL-typed props (a button href, an image src, the credentials link) are the one place a value can be
// a `javascript:` / `data:` sink, so every one is routed through assertSafeUrl before it reaches the
// DOM. This is the sink discipline the (later) PSL binding relies on: attribute NAMES are fixed by the
// primitive schema; only URL VALUES need sanitizing. Text props are safe already (React escapes them).

/**
 * Renders a COMPILED PML tree (primitives only - components are already expanded by the
 * backend PmlCompiler). One small renderer per primitive; nothing here produces markup from
 * user input, it emits elements from validated values, exactly like the block renderer it
 * replaces. Reuses the shared theme CSS variables (--site-accent, --site-surface, ...).
 *
 * Optional sub-elements omit themselves when their data is absent (an empty button, a
 * captionless image), which is what lets std-lib templates carry every optional slot.
 */

const ICON_MAP: Record<string, LucideIcon> = {
  'check-circle': CheckCircle2,
  star: Star,
  heart: Heart,
  globe: Globe,
  briefcase: Briefcase,
  clock: Clock,
  'file-text': FileText,
  users: Users,
  award: Award,
  'message-circle': MessageCircle,
  'map-pin': MapPin,
  phone: Phone,
  'clipboard-check': ClipboardCheck,
  send: Send,
};

const GRID_COLS: Record<string, string> = {
  '6': 'md:grid-cols-6',
  '12': 'md:grid-cols-12',
  '1': '',
  '2': 'md:grid-cols-2',
  '3': 'md:grid-cols-3',
  '4': 'md:grid-cols-4',
};

// Spans apply only from `md` up, because the grid is a single column on a phone (grid-cols-1),
// where a span would just make one item oddly tall or wide. Static literals so Tailwind keeps them.
const COL_SPAN: Record<string, string> = {
  '2': 'md:col-span-2', '3': 'md:col-span-3', '4': 'md:col-span-4', '5': 'md:col-span-5', '6': 'md:col-span-6',
  '7': 'md:col-span-7', '8': 'md:col-span-8', '9': 'md:col-span-9', '10': 'md:col-span-10', '11': 'md:col-span-11', '12': 'md:col-span-12',
};
/** A different span from laptops up (`lg:col-span=`, S2-04): written out literally for Tailwind. */
const LG_COL_SPAN: Record<string, string> = {
  '1': 'lg:col-span-1', '2': 'lg:col-span-2', '3': 'lg:col-span-3', '4': 'lg:col-span-4', '5': 'lg:col-span-5', '6': 'lg:col-span-6',
  '7': 'lg:col-span-7', '8': 'lg:col-span-8', '9': 'lg:col-span-9', '10': 'lg:col-span-10', '11': 'lg:col-span-11', '12': 'lg:col-span-12',
};

/** A decorative layer's placement, size and colour (S2-06), written out literally for Tailwind. */
const LAYER_POSITION: Record<string, string> = {
  'top-left': '-left-16 -top-16',
  'top-right': '-right-16 -top-16',
  'bottom-left': '-bottom-16 -left-16',
  'bottom-right': '-bottom-16 -right-16',
  center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
};
const LAYER_SIZE: Record<string, string> = { sm: 'h-40 w-40', md: 'h-72 w-72', lg: 'h-[28rem] w-[28rem]' };
const LAYER_COLOR: Record<string, string> = { accent: 'var(--site-accent)', muted: 'var(--site-muted)', surface: 'var(--site-surface)' };

/** Does a container hold a decorative layer? Then it becomes the layer's positioning context. */
const hasLayer = (node: PmlNode): boolean => (node.children ?? []).some((c) => c.primitive === 'layer');

/**
 * Button looks (S2-07). `soft` is a tinted fill, `ghost` is text that tints on hover; both use the
 * site's own colour through color-mix so they work on any scheme and any brand colour.
 */
const BUTTON_VARIANTS: Record<string, string> = {
  primary: `rounded-[var(--site-button-radius,9999px)] px-6 py-2.5 ${ACCENT_BUTTON}`,
  outline: 'rounded-[var(--site-button-radius,9999px)] border border-current px-6 py-2.5',
  link: 'underline underline-offset-4',
  soft: 'rounded-[var(--site-button-radius,9999px)] bg-[color-mix(in_srgb,var(--site-accent)_16%,transparent)] px-6 py-2.5',
  ghost: 'rounded-[var(--site-button-radius,9999px)] px-6 py-2.5 hover:bg-[color-mix(in_srgb,var(--site-accent)_10%,transparent)]',
};

/** Image framing (S2-05). `ratio=auto` keeps the picture's own shape. */
const IMAGE_RATIO: Record<string, string> = { square: 'aspect-square', '4:3': 'aspect-[4/3]', '3:2': 'aspect-[3/2]', '16:9': 'aspect-video', '3:4': 'aspect-[3/4]' };
const IMAGE_FIT: Record<string, string> = { cover: 'object-cover', contain: 'object-contain' };
/** A picture smaller than its column (2026-11-08): a logo in a row, an icon-sized picture. */
const IMAGE_SIZE: Record<string, string> = { xs: 'max-w-[48px]', sm: 'max-w-[160px]', md: 'max-w-[360px]', lg: 'max-w-[640px]' };
const IMAGE_FOCAL: Record<string, string> = { center: 'object-center', top: 'object-top', bottom: 'object-bottom', left: 'object-left', right: 'object-right' };
const ROW_SPAN: Record<string, string> = { '2': 'md:row-span-2', '3': 'md:row-span-3' };

const SPACER_HEIGHT: Record<string, string> = { sm: 'h-4', md: 'h-8', lg: 'h-16' };
const DIVIDER_SPACE: Record<string, string> = { sm: 'my-4', md: 'my-8', lg: 'my-16' };

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * A numeric token (columns, col_span, row_span). Unquoted PML (`columns=3`, how Porter and the Code
 * view write it) parses to a NUMBER, quoted or builder-set to a STRING: accept both. Reading it
 * through `str` alone silently turned a Porter-written 3-column grid into 2 columns.
 */
function num(value: unknown): number {
  return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
}

/**
 * The base flex classes for a container primitive (box + the semantic landmarks). A row wraps and
 * defaults to vertically-centered children; a column stacks. That default cross-axis centering is
 * DROPPED the moment the node sets `align_items`, so the chosen token (emitted by
 * resolvePrimitiveStyle as an items-* class) wins instead of colliding with a hardcoded items-center.
 * `justify` and `self_align` ride along in the node's resolved style, so nothing else is needed here.
 */
function containerFlex(node: PmlNode, gap: unknown): string {
  const isRow = (node.props ?? {}).direction === 'row';
  const alignItems = str((node.style as Record<string, unknown> | undefined)?.align_items);
  const base = isRow ? 'flex flex-row flex-wrap' : 'flex flex-col';
  const defaultAlign = isRow && alignItems === '' ? 'items-center' : '';

  return `${base} ${defaultAlign} ${gapClass(gap)}`.replace(/\s+/g, ' ').trim();
}

/**
 * The path of the page currently being viewed, provided by the shell when it renders the shared
 * nav region so a button linking to THIS page marks itself active. Undefined everywhere else (page
 * content never highlights), which keeps active-state a render-time prop on the nav - no per-request
 * binding, no dynamic dependency.
 */
const CurrentPathContext = React.createContext<string | undefined>(undefined);

/**
 * A source's "read on" date (S1-07). A calendar DATE, not a moment: formatted in UTC so it is the
 * same day for every reader and the server and browser renders agree.
 */
const SOURCE_DATE = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

/** The page's heading outline (S1-06), for a `toc` anywhere on the page. */
const OutlineContext = React.createContext<OutlineEntry[]>([]);

/** True in the builder canvas: an element that would render nothing yet shows a hint instead. */
const BuilderHintsContext = React.createContext<boolean>(false);

/** The post pieces the renderer draws itself (a host may draw any of them instead). */
const POST_PIECES = {
  post_breadcrumbs: PmlPostBreadcrumbs,
  post_category: PmlPostCategory,
  post_title: PmlPostTitle,
  post_dek: PmlPostDek,
  post_author: PmlPostAuthor,
  post_date: PmlPostDate,
  post_read_time: PmlPostReadTime,
  post_reviewer: PmlPostReviewer,
  post_reviewer_badge: PmlPostReviewerBadge,
  post_sources_badge: PmlPostSourcesBadge,
  post_tags: PmlPostTags,
} as const;

/** The reference's placeholder grey for an empty field on the canvas. */
const EXAMPLE_WORDS = '#A0A8B8';

/** On the canvas, a template's example words read as a placeholder; a live page never draws them differently. */
function exampleLook(inCanvas: boolean, value: unknown): React.CSSProperties | undefined {
  return inCanvas && isBracketedExample(value) ? { color: EXAMPLE_WORDS } : undefined;
}

/** In the builder: the element being drawn as written, before its `{...}` values were read. */
const AuthoredNodeContext = React.createContext<PmlNode | null>(null);

/**
 * Where a node sits, for the admin builder (S4-02). Empty everywhere else, so NodePath adds nothing
 * to a public page or to a consultant's builder.
 */
const NO_PATH: number[] = [];
const PathContext = React.createContext<number[]>(NO_PATH);

/**
 * A table row or cell's own path (2026-11-07). A wrapper <div> is invalid inside <tbody> and <tr>
 * (every table on the canvas logged DOM-nesting errors), so a row or cell carries `data-pml-path`
 * itself, marked `data-pml-self` so the canvas selects the holder rather than its first child.
 */
const SelfPathContext = React.createContext<string | null>(null);

/** The attributes a row or cell puts on itself in the builder; nothing anywhere else. */
function selfPathProps(path: string | null): Record<string, string> {
  return path === null ? {} : { 'data-pml-path': path, 'data-pml-self': '' };
}

/**
 * Marks one child for the builder. `contents` gives it no box, so layout is exactly the live page.
 * `self`: the child is a table row or cell, which takes the mark on its own element instead.
 */
function NodePath({ index, children: child, self = false }: { index: number; children: React.ReactNode; self?: boolean }): React.JSX.Element {
  const parent = React.useContext(PathContext);
  // Inside a paragraph the mark is a <span>: a <div> in a <p> is invalid and the browser would close
  // the paragraph early (PML v3 L4).
  const inWords = React.useContext(InlineContext);

  if (parent.length === 0) return <>{child}</>;

  const path = [...parent, index];
  const Mark = inWords ? 'span' : 'div';

  if (self) {
    return (
      <PathContext.Provider value={path}>
        <SelfPathContext.Provider value={path.join('.')}>{child}</SelfPathContext.Provider>
      </PathContext.Provider>
    );
  }

  return (
    <PathContext.Provider value={path}>
      <SelfPathContext.Provider value={null}>
        <Mark data-pml-path={path.join('.')} className="contents">
          {child}
        </Mark>
      </SelfPathContext.Provider>
    </PathContext.Provider>
  );
}

/** The real sign-up form, handed in by the page that hosts it (S0-10). Absent while designing. */
const GrowthFormContext = React.createContext<React.ReactNode>(null);

/**
 * A callout's tones (S1-04). The panel is a translucent tint with the site's own text colour on top,
 * so it reads on a light AND a dark scheme; only the bar and icon carry the tone colour.
 */
const CALLOUT_TONES: Record<string, { icon: LucideIcon; label: string; className: string; iconClass: string }> = {
  info: { icon: Info, label: 'Note', className: 'border-sky-500 bg-sky-500/10', iconClass: 'text-sky-600' },
  tip: { icon: Lightbulb, label: 'Tip', className: 'border-violet-500 bg-violet-500/10', iconClass: 'text-violet-600' },
  warning: { icon: AlertTriangle, label: 'Warning', className: 'border-amber-500 bg-amber-500/10', iconClass: 'text-amber-600' },
  success: { icon: CheckCircle2, label: 'Good news', className: 'border-emerald-500 bg-emerald-500/10', iconClass: 'text-emerald-600' },
  // An error or a stop the reader must act on (pml-kit 0.12: the email error alert).
  danger: { icon: OctagonAlert, label: 'Important', className: 'border-red-500 bg-red-500/10', iconClass: 'text-red-600' },
};

/** The elements a box may render as (`as=`, S1-01). Mirrors PrimitiveSchema TOKEN_ENUMS['as']. */
export const BOX_ELEMENTS: Record<string, 'div' | 'section' | 'article' | 'aside' | 'main' | 'figure' | 'address' | 'blockquote'> = {
  div: 'div',
  section: 'section',
  article: 'article',
  aside: 'aside',
  main: 'main',
  figure: 'figure',
  address: 'address',
  blockquote: 'blockquote',
};

/**
 * True unless a field is inside a form that is a builder-canvas PREVIEW (no submit capability), in
 * which case the fields render disabled - an honest inert preview. A field outside a form defaults
 * to enabled (harmless: there is nothing to submit).
 */
const FormLiveContext = React.createContext<boolean>(true);

/**
 * How the form being drawn lays out its fields (the form's `layout`, 2026-11-08): `stacked` labelled
 * fields over a full-width button; `inline` one line, like a sign-up; `prompt` one large box the
 * visitor writes into, with a round send button inside it. In the two compact layouts a field's label
 * is kept for screen readers and shown as its placeholder.
 */
type FormLayout = 'stacked' | 'inline' | 'prompt';

const FormLayoutContext = React.createContext<FormLayout>('stacked');

/**
 * True in the builder's "Mobile view" preview. The canvas only narrows its own width (max-w-sm),
 * but the renderer's responsive column classes (`md:grid-cols-*`) track the real VIEWPORT, not the
 * canvas, so a multi-column grid never collapsed in the preview - the "mobile toggle does nothing"
 * bug. When this is true, the column layouts emit their single-column base only (dropping the `md:`
 * expansion), so the preview honestly collapses. The live public page leaves this false, so its
 * layouts stay viewport-responsive exactly as before.
 */
export const ForceMobileContext = React.createContext<boolean>(false);

/**
 * The host product's site record (a consultant's site, a growth landing page...). The renderer never reads it: it
 * only hands it to the host's own elements, which know its shape.
 */
export type PmlSite = object;
type PublicSite = PmlSite;

/**
 * One PML element the HOST draws itself, because what it shows belongs to that product (E1, shared program): a
 * product's own lead form, its own assistant widget, its regulator's badge. The renderer stays product-free.
 */
export type PmlHostElement = (args: {
  props: Record<string, unknown>;
  site: PmlSite;
  className: string;
  style?: React.CSSProperties;
}) => React.ReactNode;

export interface PmlHost {
  /** Elements the product draws itself, by element name (e.g. `contact_form`). Without one, the element draws nothing. */
  elements?: Readonly<Record<string, PmlHostElement>>;
  /** Called with an error the page could not show on its own (a form whose send failed is also said in the form). */
  onError?: (error: unknown) => void;
}

const HostContext = React.createContext<PmlHost>({});

/** Select options are authored one per line OR pipe-separated (Porter); either splits the same. */
function parseFieldOptions(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.trim() === '') return [];

  return raw
    .split(/\r\n|\r|\n|\|/)
    .map((option) => option.trim())
    .filter((option) => option !== '');
}

/** The path part of a nav href (page.url is fully qualified), for a domain-agnostic active match. */
function hrefPath(href: string): string {
  try {
    return new URL(href, 'http://x').pathname.replace(/\/$/, '');
  } catch {
    return href.replace(/\/$/, '');
  }
}

export function PmlRenderer({
  nodes,
  site,
  currentPath,
  forceMobile = false,
  enableScripts = false,
  now,
  outline,
  builderHints = false,
  growthForm = null,
  pathRoot = NO_PATH,
  natives = null,
  host,
  flavor,
}: {
  nodes: PmlNode[];
  site: PublicSite;
  /**
   * What is being read (owner 2026-11-17): `post` draws the blog reading look (a no-tone callout as the short answer,
   * a table as a card, the FAQ and the question headings as the reference does); `page` the plain look. Without one, a
   * nested renderer keeps its parent's. Pages and emails never pass `post`.
   */
  flavor?: 'post' | 'page';
  /**
   * What the host product draws itself and where its errors go (see {@link PmlHost}). Without one, a nested
   * renderer keeps its parent's host.
   */
  host?: PmlHost;
  /**
   * What the page's `{...}` expressions read (PML v3 L3): owner / site / page, sent by the server with
   * every render. The browser adds location and device.
   */
  natives?: PmlNativesPayload | null;
  /**
   * The WHOLE page's heading outline (S1-06), for a caller that renders one section at a time (the
   * builder canvas), so a table of contents lists the page, not just its own section.
   */
  outline?: OutlineEntry[];
  /** The builder canvas: an element that would render nothing yet (an empty TOC) shows a hint. */
  builderHints?: boolean;
  /** Set only by the shell for the nav region: the current page's path, to mark the active link. */
  currentPath?: string;
  /** Set by the builder canvas in "Mobile view" so multi-column layouts collapse in the preview. */
  forceMobile?: boolean;
  /**
   * Makes the page INTERACTIVE: its `<script>`s run, `on-*` handlers fire and `dom.el` edits apply
   * (client-only). The live public page passes the scripts gate; the builder and previews leave it
   * false, so nothing reacts while editing. Expressions are read either way.
   */
  enableScripts?: boolean;
  /** "Today" as YYYY-MM-DD for the script runtime's date helpers (never a wall clock). */
  now?: string;
  /** What a `growth_form` section draws: the host's form. Without one, a labelled placeholder. */
  growthForm?: React.ReactNode;
  /** Set by the admin canvas to this section's position, which turns on element selection. */
  pathRoot?: number[];
}): React.JSX.Element {
  // Every heading gets a stable anchor (S1-02) before render, so links and a table of contents can
  // jump to it; explicit anchors are kept. The outline (S1-06) is read from the same prepared nodes.
  const prepared = withDerivedAnchors(nodes);
  const parentFlavor = React.useContext(PostFlavorContext);

  const body = (
    <PostFlavorContext.Provider value={flavor === undefined ? parentFlavor : flavor === 'post'}>
    <ForceMobileContext.Provider value={forceMobile}>
      <CurrentPathContext.Provider value={currentPath}>
        <OutlineContext.Provider value={outline ?? pageOutline(prepared)}>
          <BuilderHintsContext.Provider value={builderHints}>
            <GrowthFormContext.Provider value={growthForm}>
              <PathContext.Provider value={pathRoot}>
                <MotionStyles />
                <PmlTopLevel nodes={prepared} site={site} />
              </PathContext.Provider>
            </GrowthFormContext.Provider>
          </BuilderHintsContext.Provider>
        </OutlineContext.Provider>
      </CurrentPathContext.Provider>
    </ForceMobileContext.Provider>
    </PostFlavorContext.Provider>
  );

  // ONE page scope wraps the whole tree: every expression reads it, and every <script> executes into it
  // when the page is interactive. In the builder it is there too (expressions draw real data), inert.
  return (
    <PmlScopeProvider now={now} natives={natives} interactive={enableScripts}>
      {host ? <HostContext.Provider value={host}>{body}</HostContext.Provider> : body}
    </PmlScopeProvider>
  );
}

/** A host element, or nothing when the host does not draw one. */
function hostElement(host: PmlHost, name: string, args: Parameters<PmlHostElement>[0]): React.JSX.Element | null {
  const draw = host.elements?.[name];

  return draw ? <>{draw(args)}</> : null;
}

/** The host's form, or what stands in for it while designing and in a preview. */
function PmlGrowthFormSlot(): React.JSX.Element {
  const form = React.useContext(GrowthFormContext);

  return form ? (
    <>{form}</>
  ) : (
    <div className="rounded-[var(--site-radius)] border border-dashed border-current/30 px-6 py-10 text-center text-sm opacity-70">
      The sign-up form appears here on the live page.
    </div>
  );
}

/** The `each` items around an element (PML v3 L3), which its expressions read. */
const LocalsContext = React.createContext<Record<string, Value>>({});

/** The hard cap on an `each`'s copies: a bounded render, as the old repeat had. */
const MAX_EACH = 24;

interface ListEntry {
  node: PmlNode;
  /** The node's position among its siblings in the SOURCE (the builder's selection path). */
  index: number;
  key: string;
  /** The `each` item this copy shows, or null when the node does not repeat. */
  locals: Record<string, Value> | null;
}

/**
 * A list of siblings as the page draws it: `if` / `else-if` / `else` chains decided (the first true
 * branch shows), and an `each={item in list}` drawn once per item (its `if`, if any, read per item).
 */
function visibleEntries(nodes: PmlNode[], scope: PmlScope | null, locals: Record<string, Value>, allBranches = false): ListEntry[] {
  const out: ListEntry[] = [];
  const test = (ast: unknown, scoped: Record<string, Value>): boolean =>
    scope !== null && isExpr(ast) && truthy(evaluateIn(scope, ast.ast, scoped));
  let open = false;
  let taken = false;

  nodes.forEach((node, index) => {
    if (node.each && scope) {
      const list = evaluateIn(scope, node.each.ast, locals);
      let shown = 0;

      if (Array.isArray(list)) {
        list.slice(0, MAX_EACH).forEach((item, j) => {
          const scoped = { ...locals, [node.each!.item]: item };

          if (allBranches || !node.if || test(node.if, scoped)) {
            out.push({ node, index, key: `${index}.${j}`, locals: scoped });
            shown++;
          }
        });
      }

      open = Boolean(node.if);
      taken = shown > 0;

      return;
    }

    // The builder canvas shows every branch, so each one can be seen, selected and edited; the live page
    // (and a preview) decides which one draws.
    if (allBranches) {
      out.push({ node, index, key: String(index), locals: null });

      return;
    }

    if (node.else_if || node.else) {
      if (!open || taken) {
        if (node.else) open = false;

        return;
      }

      if (node.else_if && !test(node.else_if, locals)) return;

      taken = true;
      if (node.else) open = false;
    } else if (node.if) {
      open = true;
      taken = test(node.if, locals);

      if (!taken) return;
    } else {
      open = false;
    }

    out.push({ node, index, key: String(index), locals: null });
  });

  return out;
}

/** An entry drawn with its `each` item in scope. */
function withLocals(entry: ListEntry, view: React.ReactNode): React.ReactNode {
  return entry.locals ? <LocalsContext.Provider value={entry.locals}>{view}</LocalsContext.Provider> : view;
}

/** The page's top-level elements, each in its section band + centred container (S2a-01). */
function PmlTopLevel({ nodes, site }: { nodes: PmlNode[]; site: PublicSite }): React.JSX.Element {
  const scope = usePmlScope();
  const inCanvas = React.useContext(BuilderHintsContext);
  const locals = React.useContext(LocalsContext);

  return (
    <>
      {visibleEntries(nodes, scope, locals, inCanvas).map((entry) => (
        <React.Fragment key={entry.key}>
          {withLocals(entry, <SectionFrame node={entry.node} render={(framed) => <PmlNodeView node={framed} site={site} />} />)}
        </React.Fragment>
      ))}
    </>
  );
}

/** What a list of children is drawn with: the page scope, the `each` items around it, the canvas flag. */
interface ListCtx {
  scope: PmlScope | null;
  locals: Record<string, Value>;
  inCanvas: boolean;
}

/** The list context for a component that draws children (call it before any early return). */
function useListCtx(): ListCtx {
  return { scope: usePmlScope(), locals: React.useContext(LocalsContext), inCanvas: React.useContext(BuilderHintsContext) };
}

/**
 * A node's children as an ARRAY of elements, one per drawn child, so a carousel or a marquee can split
 * them into slides with React.Children (a single wrapper component would arrive as one slide).
 */
function children(node: PmlNode, site: PublicSite, ctx: ListCtx): React.ReactNode[] {
  // A table's rows and a row's cells cannot be wrapped (see SelfPathContext).
  const self = node.primitive === 'table' || node.primitive === 'row';

  // A <summary> or <figcaption> only counts as a DIRECT child of its <details> / <figure>, so it marks
  // itself rather than being wrapped (PML v3 L5).
  return visibleEntries(node.children ?? [], ctx.scope, ctx.locals, ctx.inCanvas).map((entry) => (
    <NodePath key={entry.key} index={entry.index} self={self || SELF_MARKED_PARTS.includes(entry.node.primitive ?? '')}>
      {withLocals(entry, <PmlNodeView node={entry.node} site={site} />)}
    </NodePath>
  ));
}

/**
 * Grid children, each wrapped only when it spans, so the span works for ANY child primitive (a
 * button or an icon do not carry their own container className). col_span is clamped to the grid's
 * real column count, so a hand-edited span of 4 in a 2-column grid renders as full width, not broken.
 */
function gridChildren(node: PmlNode, site: PublicSite, columns: number, ctx: ListCtx): React.ReactNode[] {
  return visibleEntries(node.children ?? [], ctx.scope, ctx.locals, ctx.inCanvas).map((entry) => {
    const child = entry.node;
    const cs = (child.style ?? {}) as Record<string, unknown>;
    // A tablet span (`md:col-span=` overrides the base, which already starts at tablets) and an
    // optional laptop span (S2-04), each clamped to the grid's real column count.
    const clamp = (v: number) => Math.min(Math.max(v || 1, 1), columns);
    const colSpan = clamp(num(cs['md:col_span']) || num(cs.col_span));
    const lgSpan = num(cs['lg:col_span']) ? clamp(num(cs['lg:col_span'])) : 0;
    const rowSpan = Math.max(num(cs.row_span) || 1, 1);
    const span = `${COL_SPAN[String(colSpan)] ?? ''} ${lgSpan ? (LG_COL_SPAN[String(lgSpan)] ?? '') : ''} ${ROW_SPAN[String(rowSpan)] ?? ''}`.replace(/\s+/g, ' ').trim();
    const view = withLocals(entry, <PmlNodeView node={child} site={site} />);

    return span ? (
      <div key={entry.key} className={span}>
        <NodePath index={entry.index}>{view}</NodePath>
      </div>
    ) : (
      <NodePath key={entry.key} index={entry.index}>
        {view}
      </NodePath>
    );
  });
}

/** Whether a prop is words a reader sees (declared prose or plain string, or a section's prose setting). */
function isWordsProp(node: PmlNode, key: string): boolean {
  if (node.primitive) {
    const type = (ELEMENTS as Record<string, { props: Record<string, { type: string }> } | undefined>)[node.primitive]?.props[key]?.type;

    return type === 'prose' || type === 'string';
  }

  return typeof node.component === 'string' && (COMPONENT_PROSE as readonly string[]).includes(key);
}

/**
 * The element with its `{...}` values read (PML v3 L3): every prop and style value that is an
 * expression becomes what it evaluates to in the page scope (and the `each` item around it). A url
 * drawn from one still meets assertSafeUrl in its renderer, as a typed url does; text is escaped by
 * React. A node with no expression comes back untouched.
 */
function withValues(node: PmlNode, scope: PmlScope | null, locals: Record<string, Value>): PmlNode {
  const read = (bag: Record<string, unknown> | undefined, words: (key: string) => boolean): Record<string, unknown> | undefined => {
    if (!bag || !Object.values(bag).some(isExpr)) return bag;

    return Object.fromEntries(
      Object.entries(bag).map(([k, v]) => {
        if (!isExpr(v)) return [k, v];
        if (!scope) return [k, null];

        const value = evaluateIn(scope, v.ast, locals);

        // A value shown as words (a heading, a label, a run) is read as words by the ONE rule, so a
        // number, a yes/no or a list shows; anything else keeps its type (a url, a count of columns). A
        // rich-text setting's value (component props p10) shows its words without the markup.
        return [k, words(k) ? (isRichKind(v) ? plainWords(valueText(value)) : valueText(value)) : fromPslValue(value)];
      }),
    );
  };
  const props = read(node.props, (key) => isWordsProp(node, key));
  const style = read(node.style, () => false);

  return props === node.props && style === node.style ? node : { ...node, props, style };
}

/** React handlers for an element's `on-*` expressions, on an interactive page. */
function expressionHandlers(node: PmlNode, scope: PmlScope | null, locals: Record<string, Value>): Record<string, (e: React.SyntheticEvent) => void> | null {
  if (!scope || !scope.interactive || !node.on) return null;

  const reactKey: Record<ReactiveEvent, string> = { click: 'onClick', change: 'onChange', submit: 'onSubmit', input: 'onInput' };
  const out: Record<string, (e: React.SyntheticEvent) => void> = {};

  for (const [event, handler] of Object.entries(node.on)) {
    if (!isPmlEvent(event) || !isExpr(handler)) continue;

    out[reactKey[event]] = (e: React.SyntheticEvent) => {
      if (event === 'submit') e.preventDefault();
      handleIn(scope, handler.ast, locals);
    };
  }

  return Object.keys(out).length > 0 ? out : null;
}

/** The functions a script's source defines, by the names its author wrote. */
export function scriptFunctionNames(source: string): string[] {
  return [...source.matchAll(/\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map((m) => m[1]);
}

/** A script in the builder: what it is and what it defines, never its code (the panel shows that). */
function ScriptChip({ source }: { source: string }): React.JSX.Element {
  const names = scriptFunctionNames(source);

  return (
    <div className="my-1 inline-flex max-w-full items-center gap-2 rounded-full border border-dashed border-current/30 px-3 py-1 font-mono text-xs opacity-70">
      <span className="font-sans font-medium">Script</span>
      <span className="truncate">{names.length > 0 ? names.map((n) => `${n}()`).join(', ') : 'runs when the page opens'}</span>
    </div>
  );
}

/**
 * Routes a node to the imperative path (if it carries a `key` a PSL handle can target), the reactive
 * path (if it carries `reactive` directives), or the plain static path.
 */
function PmlNodeView({ node, site }: { node: PmlNode; site: PublicSite }): React.JSX.Element | null {
  const scope = usePmlScope();
  const locals = React.useContext(LocalsContext);
  const inWords = React.useContext(InlineContext);
  const inCanvas = React.useContext(BuilderHintsContext);

  // A comment node is a non-rendering note; skip it before the key/static routing. The compiled tree
  // already drops comments, so this is belt-and-braces for any path that renders the stored AST.
  if (isCommentNode(node)) {
    return null;
  }

  const resolved = withValues(node, scope, locals);
  const routed = resolved.key ? <MutableNode node={resolved} site={site} /> : routeResolved(resolved, site);
  // The builder keeps the element as written beside the one with its values read, so a placeholder can
  // name what an empty element is bound to. Nothing extra on a live page.
  const view = inCanvas ? <AuthoredNodeContext.Provider value={node}>{routed}</AuthoredNodeContext.Provider> : routed;
  const handlers = expressionHandlers(node, scope, locals);
  const Wrap = inWords ? 'span' : 'div';

  // events: attach on a display:contents wrapper (no box; the event bubbles to it).
  return handlers ? (
    <Wrap style={{ display: 'contents' }} {...handlers}>
      {view}
    </Wrap>
  ) : (
    view
  );
}

/** Route an already-key-resolved node to the static renderer (never back through the key path). */
function routeResolved(node: PmlNode, site: PublicSite): React.JSX.Element | null {
  return <StaticNodeView node={node} site={site} />;
}

/**
 * A node an imperative PSL handle (`dom.el(key)`) can edit. It subscribes to the page's ELEMENT store
 * and applies that key's recorded mutations - setText / setAttr (through the closed allowlist +
 * assertSafeUrl at the store) / append (a known-primitive child) / remove - then routes the mutated
 * node onward (still honouring any `reactive` directives it also carries). Imperative on(event, fn)
 * handlers attach on a display:contents wrapper and call the runtime at the per-handler event budget.
 *
 * With no runtime (the builder) it renders the node inert. SSR + first paint
 * read version 0 (an empty store), so there is no hydration mismatch; a mutation applies post-mount as
 * an ordinary re-render. No path here yields a real DOM Node - it only ever renders validated PmlNodes.
 */
function MutableNode({ node, site }: { node: PmlNode; site: PublicSite }): React.JSX.Element | null {
  const runtime = usePslRuntime();
  const store = runtime?.elements ?? null;

  React.useSyncExternalStore(
    (onChange) => (store ? store.subscribe(onChange) : () => undefined),
    () => (store ? store.version() : 0),
    () => 0,
  );

  const key = node.key;

  // No runtime (builder/preview): ignore imperative mutations, render the node as-is (inert).
  if (!runtime || !store || !key) {
    return routeResolved(node, site);
  }

  const record = store.record(key);
  const mutated = applyMutation(node, record);
  if (mutated === null) {
    return null; // remove()
  }

  const inner = routeResolved(mutated, site);
  const handlers = imperativeHandlers(record?.handlers, runtime);

  return handlers ? (
    <div style={{ display: 'contents' }} {...handlers}>
      {inner}
    </div>
  ) : (
    inner
  );
}

/**
 * React event props from a node's IMPERATIVE `on(event, fn)` handlers (fn VALUES the script bound at
 * runtime, not global names). Each calls the runtime at the per-handler event budget; a submit is
 * prevented (the runtime owns the behaviour). Returns null when there is nothing to attach.
 */
function imperativeHandlers(
  handlers: Partial<Record<ReactiveEvent, Value>> | undefined,
  runtime: PageRuntime,
): Record<string, (e: React.SyntheticEvent) => void> | null {
  if (!handlers) return null;

  const reactKey: Record<ReactiveEvent, string> = {
    click: 'onClick',
    change: 'onChange',
    submit: 'onSubmit',
    input: 'onInput',
  };
  const out: Record<string, (e: React.SyntheticEvent) => void> = {};

  for (const [event, fn] of Object.entries(handlers)) {
    if (!isPmlEvent(event) || fn == null) continue;

    out[reactKey[event]] = (e: React.SyntheticEvent) => {
      if (event === 'submit') e.preventDefault();
      runtime.callFn(fn);
    };
  }

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * The static render: the node's `motion` token (if any) around the per-primitive renderer. Nodes with
 * no motion render directly - no wrapper, no cost.
 */
function StaticNodeView({ node, site }: { node: PmlNode; site: PublicSite }): React.JSX.Element | null {
  const motion = str((node.style as Record<string, unknown> | undefined)?.motion);
  const inner = <PmlNodeInner node={node} site={site} />;

  if (!motion || motion === 'none') return inner;

  return <PmlMotion motion={motion}>{inner}</PmlMotion>;
}

/**
 * The element, or in the builder canvas a placeholder when it would draw nothing (owner 2026-11-11:
 * "even empty elements should be visible so the user can interact with while building"). A counter's
 * heading with no words yet and its count were invisible, so they could not be clicked, selected or
 * filled in. Any element that comes out empty gets one, from one place, rather than a check per element.
 * A live page draws nothing for it, as before. Words inside a paragraph are left alone (a run is not
 * something to select on its own), and so is a decorative layer.
 */
function PmlNodeInner({ node, site }: { node: PmlNode; site: PublicSite }): React.JSX.Element | null {
  const view = useElementView(node, site);
  const inCanvas = React.useContext(BuilderHintsContext);
  const inWords = React.useContext(InlineContext);
  const authored = React.useContext(AuthoredNodeContext);

  if (view !== null || !inCanvas || inWords || node.primitive === 'layer') return view;

  // Bound to page data (owner 2026-11-11: such an element is not "empty", it reads something that has
  // no value here): it shows what it reads, as the paragraph editor's data chips do.
  const binding = boundExpression(authored ?? node);

  return binding !== null ? <BoundElement source={binding} /> : <EmptyElement name={node.primitive ?? 'element'} />;
}

/** The expression an element's words (or, failing that, any prop) read, as written; null when none. */
function boundExpression(node: PmlNode): string | null {
  const props = Object.entries(node.props ?? {}).filter(([, value]) => isExpr(value));
  const words = props.find(([key]) => isWordsProp(node, key)) ?? props[0];

  return words && isExpr(words[1]) ? words[1].$expr : null;
}

/** The builder's stand-in for an element with nothing to show yet: there to be seen, clicked and filled in. */
function EmptyElement({ name }: { name: string }): React.JSX.Element {
  return (
    <div className="text-sm" style={{ ...EMPTY_BLOCK, color: '#475569' }} data-pml-empty="">
      Empty {EMPTY_NAMES[name] ?? name.replace(/_/g, ' ')}: select it to fill it in
    </div>
  );
}

/** What the empty stand-in calls an element whose own name says nothing to an author. */
const EMPTY_NAMES: Readonly<Record<string, string>> = {
  p: 'paragraph',
  rich_text: 'rich text',
  post_dek: 'line under the title',
  post_cta: 'call to action',
  post_story: 'client story',
  post_badges: 'trust badges',
};

/** Whether an element holds words a reader would see (an empty paragraph or table cell holds none). */
function hasWords(node: PmlNode): boolean {
  return (node.children ?? []).some((child) =>
    child.primitive === 'text' ? str(child.props?.value).trim() !== '' || isExpr(child.props?.value) : !isCommentNode(child),
  );
}

/** The builder's stand-in for an element whose page data has no value here: what it reads, as a chip. */
function BoundElement({ source }: { source: string }): React.JSX.Element {
  return (
    <div className="py-1" data-pml-bound="" title={`Reads {${source}}, which has no value here. It shows whatever that holds on the page.`}>
      <span className="inline-flex max-w-full items-center rounded-md border border-dashed border-current/30 px-2 py-0.5 font-mono text-sm opacity-70">
        <span className="truncate">{`{${source}}`}</span>
      </span>
    </div>
  );
}

function useElementView(node: PmlNode, site: PublicSite): React.JSX.Element | null {
  const ctx = useListCtx();
  const host = React.useContext(HostContext);
  const inWords = React.useContext(InlineContext);
  const p = node.props ?? {};
  const resolved = resolvePrimitiveStyle(node.style);
  // In the builder canvas a fixed bar is drawn sticky, inside the canvas, never over the editor around it.
  const inCanvas = React.useContext(BuilderHintsContext);
  const postFlavor = React.useContext(PostFlavorContext);
  const s = inCanvas && resolved.className.includes('fixed inset-x-0')
    ? { ...resolved, className: resolved.className.replace('fixed inset-x-0', 'sticky') }
    : resolved;
  const size = (node.style ?? {}) as Record<string, unknown>;
  // Provided by the shell for the nav region only; undefined for page content (no active marking).
  const currentPath = React.useContext(CurrentPathContext);
  // A form field renders disabled inside a preview form (builder canvas); enabled otherwise.
  const formLive = React.useContext(FormLiveContext);
  const formLayout = React.useContext(FormLayoutContext);
  // True in the builder's Mobile-view preview: collapse multi-column layouts to one column.
  const forceMobile = React.useContext(ForceMobileContext);
  // A table row or cell in the builder marks itself (no wrapper is valid there).
  const selfPath = React.useContext(SelfPathContext);

  switch (node.primitive) {
    case 'box': {
      // What the box IS (S1-01): a closed set of content elements, a <div> otherwise.
      const Tag = BOX_ELEMENTS[str(p.as)] ?? 'div';

      // A box holding a decorative layer (S2-06) becomes its stacking + clipping context, so the layer
      // sits behind the content and never spills over the page.
      const layered = hasLayer(node) ? 'relative isolate overflow-hidden' : '';
      // A box may take a picture's shape (2026-11-08): a frame waiting for a picture keeps it.
      const shape = IMAGE_RATIO[str(p.ratio)] ?? '';
      // How the box lays itself out (style `display`, 2026-11-08): flex (its direction, the default),
      // block, grid or carousel. The box props `slides` / `auto` written earlier the same day still draw a
      // carousel: they are read as the styles. ⚠ The parser reads numbers as numbers (`slides=2` is 2).
      const st = (node.style ?? {}) as Record<string, unknown>;
      const num = (v: unknown) => Number(typeof v === 'number' ? v : str(v));
      const legacySlides = num(p.slides);
      const display = str(st.display) || (legacySlides >= 1 || str(p.auto) === 'scroll' ? 'carousel' : '');
      const frame = `${layered} ${themeCornerClass(node.style)} ${panelGutterClass(node.style)} ${s.className}`;

      if (display === 'carousel') {
        const motion = str(st.carousel_motion) || (str(p.auto) === 'scroll' ? 'scroll' : str(p.auto) === 'step' ? 'step' : 'none');
        const gap = str(p.gap) || (motion === 'scroll' ? 'xl' : 'md');

        // An endless track (a row of logos): it moves on its own and has no slides to step through.
        if (motion === 'scroll') {
          return (
            <Tag id={anchorId(p.anchor)} className={`block w-full ${frame}`.replace(/\s+/g, ' ').trim()} style={s.style}>
              <PmlMarquee gap={gap} speed={str(st.carousel_speed) || 'normal'}>{children(node, site, ctx)}</PmlMarquee>
            </Tag>
          );
        }

        const clamp = (n: number) => (n >= 1 && n <= 4 ? n : 0);
        const desktop = clamp(num(st['lg:carousel_per_view'])) || clamp(num(st.carousel_per_view)) || clamp(legacySlides) || 1;
        const tablet = clamp(num(st['md:carousel_per_view'])) || clamp(num(st.carousel_per_view)) || clamp(legacySlides) || desktop;

        return (
          <Tag id={anchorId(p.anchor)} className={`block w-full ${frame}`.replace(/\s+/g, ' ').trim()} style={s.style}>
            <PmlCarousel
              perView={desktop}
              perViewMd={tablet}
              gap={gap}
              motion={motion}
              speed={str(st.carousel_speed) || 'normal'}
              controls={str(st.carousel_controls) || 'arrows'}
              loop={str(st.carousel_loop) !== 'off'}
            >
              {children(node, site, ctx)}
            </PmlCarousel>
          </Tag>
        );
      }

      if (display === 'grid') {
        // Equal columns that fit the width (as many as fit at about 14rem each), one on phones.
        return (
          <Tag id={anchorId(p.anchor)} className={`grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] ${gapClass(p.gap)} ${shape} ${frame}`.replace(/\s+/g, ' ').trim()} style={s.style}>
            {children(node, site, ctx)}
          </Tag>
        );
      }

      if (display === 'block') {
        return (
          <Tag id={anchorId(p.anchor)} className={`block ${shape} ${frame}`.replace(/\s+/g, ' ').trim()} style={s.style}>
            {children(node, site, ctx)}
          </Tag>
        );
      }

      return (
        <Tag id={anchorId(p.anchor)} className={`${containerFlex(node, p.gap)} ${layered} ${shape} ${themeCornerClass(node.style)} ${panelGutterClass(node.style)} ${s.className}`.replace(/\s+/g, ' ').trim()} style={s.style}>
          {children(node, site, ctx)}
        </Tag>
      );
    }

    // The semantic page landmarks: box-like containers, but emitted as the matching HTML5 element so
    // the header/nav/footer are real <header>/<nav>/<footer> landmarks (accessibility + SEO), not divs.
    case 'header':
    case 'nav':
    case 'footer': {
      const Tag = node.primitive; // 'header' | 'nav' | 'footer' - an intrinsic element name

      return (
        <Tag className={`${containerFlex(node, p.gap)} ${s.className}`.trim()} style={s.style}>
          {children(node, site, ctx)}
        </Tag>
      );
    }

    case 'grid': {
      // 1-4 as before, or 6 / 12 for asymmetric spans (S2-04).
      const columns = [1, 2, 3, 4, 6, 12].includes(num(p.columns)) ? num(p.columns) : 2;
      // In the Mobile-view preview, drop the md: column expansion so the grid honestly collapses to
      // one column (the canvas's max-w-sm alone cannot do this - md: tracks the viewport).
      const cols = forceMobile ? '' : (GRID_COLS[String(columns)] ?? GRID_COLS['2']);

      return (
        <div id={anchorId(p.anchor)} className={`grid grid-cols-1 ${cols} ${gapClass(p.gap)} ${s.className}`.trim()} style={s.style}>
          {gridChildren(node, site, columns, ctx)}
        </div>
      );
    }

    case 'table': {
      const caption = str(p.caption);

      if (postFlavor) {
        // `.tbl`: the reference's card, scrolling sideways on its own when the table is wide.
        return (
          <div id={anchorId(p.anchor)} className={s.className} style={{ ...POST_TABLE_CARD, ...s.style }}>
            <table style={POST_TABLE}>
              {caption ? <caption style={{ ...POST_CAPTION, ...exampleLook(inCanvas, caption) }}>{caption}</caption> : null}
              <tbody>{children(node, site, ctx)}</tbody>
            </table>
          </div>
        );
      }

      return (
        // Wrapped in an x-scroller so a wide table scrolls itself instead of breaking the page.
        <div id={anchorId(p.anchor)} className={`w-full overflow-x-auto ${s.className}`.trim()} style={s.style}>
          <table className="w-full border-collapse text-left text-sm">
            {caption ? (
              <caption className="mb-2 text-left text-sm opacity-70" style={exampleLook(inCanvas, caption)}>
                {caption}
              </caption>
            ) : null}
            <tbody>{children(node, site, ctx)}</tbody>
          </table>
        </div>
      );
    }

    case 'row':
      // Rendered by its parent <table>; a stray one renders nothing meaningful on its own.
      return (
        <tr className={postFlavor ? undefined : 'border-b border-current/10 last:border-0'} {...selfPathProps(selfPath)}>
          {children(node, site, ctx)}
        </tr>
      );

    case 'cell': {
      const isHeader = p.header === true;
      const Tag = isHeader ? 'th' : 'td';
      // Spans map to the real HTML colSpan/rowSpan attributes (cleaner than CSS for a table).
      const colSpan = Math.max(num(size.col_span) || 1, 1);
      const rowSpan = Math.max(num(size.row_span) || 1, 1);
      // An empty cell is marked on the canvas (a cell cannot be replaced by a stand-in inside its row).
      const empty = inCanvas && !hasWords(node);

      return (
        <Tag
          scope={isHeader ? 'col' : undefined}
          colSpan={colSpan > 1 ? colSpan : undefined}
          rowSpan={rowSpan > 1 ? rowSpan : undefined}
          className={`${postFlavor ? '' : 'px-3 py-2 align-top'} ${isHeader ? 'font-semibold' : ''} ${s.className}`.trim()}
          style={postFlavor ? { ...(isHeader ? POST_HEADER_CELL : POST_CELL), ...s.style } : s.style}
          {...selfPathProps(selfPath)}
        >
          {empty ? (
            <span style={{ ...EMPTY_MARK, display: 'inline-block', padding: '1px 8px', fontSize: 12, color: '#A0A8B8' }}>Empty cell</span>
          ) : (
            children(node, site, ctx)
          )}
        </Tag>
      );
    }

    case 'heading': {
      const text = str(p.text);
      if (!text) return null;

      const level = Math.min(Math.max(Number(p.level ?? 2) || 2, 1), 4);
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4';
      // Semibold unless the heading says its own weight: both classes on one element left the
      // heading's own weight to stylesheet order, and it lost (2026-11-08).
      const weight = typeof size.font_weight === 'string' && size.font_weight !== '' ? '' : 'font-semibold';
      // `.post h2`, unless the author set the heading's own size or weight.
      const postLook = postFlavor && level === 2 && !size.heading_size && !size.font_weight ? POST_H2 : undefined;

      return (
        <Tag
          id={anchorId(p.anchor)}
          className={`scroll-mt-24 ${weight} tracking-tight ${withResponsive(headingScale(size.heading_size, level), size, ['heading_size'])} ${s.className}`.replace(/\s+/g, ' ').trim()}
          style={postLook || exampleLook(inCanvas, text) ? { ...postLook, ...s.style, ...exampleLook(inCanvas, text) } : s.style}
        >
          {text}
        </Tag>
      );
    }

    case 'text': {
      // A run that is WHOLLY a template's bracketed example ("[The direct answer, in under 50 words.]", "[Column]") is
      // an empty field waiting for words: on the canvas it reads as the reference's grey placeholder; a live page
      // never shows it differently (publish refuses a part still holding its example words, pml-kit layout.unfilled).
      const example = inCanvas && isBracketedExample(p.value);
      const look = example ? { className: s.className, style: { ...s.style, color: EXAMPLE_WORDS } } : s;

      // A word run inside a paragraph is just its words (PML v3 L4).
      if (inWords) return renderRun(p.value, look);

      const body = withResponsive(bodyScale(size.body_size), size, ['body_size']);
      const value = str(p.value);
      if (!value) return null;

      return (
        <p className={`${example ? '' : 'opacity-80'} ${body} ${s.className}`.trim()} style={look.style}>
          {value}
        </p>
      );
    }

    case 'button': {
      const label = str(p.label);
      if (!label) return null;
      const href = str(p.href);

      const variant = BUTTON_VARIANTS[str(p.variant)] ?? BUTTON_VARIANTS.primary;

      // A visible keyboard focus ring in the site's own colour (S2-07): these used to carry a bare
      // outline-none, so a keyboard user could not see which button they were on.
      const buttonClass = `inline-flex items-center whitespace-nowrap font-medium outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--site-accent)] focus-visible:ring-offset-2 ${variant}`;

      // A button with NO href is an ACTION button (it triggers a <script> via an on-<event> handler,
      // never navigates), so it renders a real <button> - otherwise a script-trigger button could
      // never appear. Only a button WITH an href is a navigation link (<a>).
      if (!href) {
        return (
          <button type="button" className={`${buttonClass} ${s.className}`.trim()} style={s.style}>
            {label}
          </button>
        );
      }

      // Active-nav: when the shell provides the current page's path (nav region only), the link to
      // THIS page marks itself. A render-time comparison, so the nav stays static and cacheable.
      const active = currentPath !== undefined && hrefPath(href) === hrefPath(currentPath);

      // The node's own style tokens (radius/shadow/colour/weight/self-align/margin) come AFTER the
      // variant so an explicit token wins; a custom colour rides in s.style (inline) and beats both.
      return (
        <a
          href={assertSafeUrl(href)}
          aria-current={active ? 'page' : undefined}
          className={`${buttonClass} ${active ? 'opacity-100 font-semibold' : ''} ${s.className}`.trim()}
          style={s.style}
        >
          {label}
        </a>
      );
    }

    case 'image': {
      const src = str(p.src);
      if (!src) return null;

      const caption = str(p.caption);

      // A brand mark (0.6.3, pml-kit 0.13.0 `image_size: logo`): bounded by HEIGHT at its own width, so a wide
      // wordmark reads at the same size as a square one. A width cap squeezed a wordmark to ~48x16 on a share card.
      if (str(p.size) === 'logo') {
        return (
          <figure className={`w-fit max-w-full ${s.className}`.trim()} style={s.style}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assertSafeUrl(src)} alt={str(p.alt)} className="block h-10 w-auto max-w-[280px] object-contain" />
          </figure>
        );
      }

      return (
        <figure className={`${IMAGE_SIZE[str(p.size)] ? `${IMAGE_SIZE[str(p.size)]} w-full` : ''} ${s.className}`.trim()} style={s.style}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assertSafeUrl(src)}
            alt={str(p.alt)}
            className={`w-full rounded-[var(--site-radius)] ${IMAGE_RATIO[str(p.ratio)] ?? ''} ${IMAGE_FIT[str(p.fit)] ?? 'object-cover'} ${IMAGE_FOCAL[str(p.focal)] ?? ''}`.replace(/\s+/g, ' ').trim()}
          />
          {caption ? <figcaption className="mt-2 text-sm opacity-70">{caption}</figcaption> : null}
        </figure>
      );
    }

    case 'icon': {
      const Icon = ICON_MAP[str(p.name)];
      if (!Icon) return null;

      // Base size + accent colour first, then the node's own tokens (margin / self-align / colour /
      // radius) so an explicit choice overrides the default.
      return <Icon className={`h-6 w-6 text-[var(--site-accent)] ${s.className}`.trim()} style={s.style} aria-hidden />;
    }

    case 'video': {
      // The src is built ONLY from the whitelisted provider + the schema-validated id (never a user
      // URL), rendered as a nocookie, sandboxed iframe in a responsive 16:9 frame. This is the one
      // documented iframe exception; the content host is a trusted provider, so allow-same-origin
      // (needed by the player) is safe here.
      const id = str(p.id);
      // The id interpolates into a fixed provider embed URL, so constrain it to the id charset; a
      // smuggled query/path (or anything else) renders nothing rather than reaching the iframe src.
      if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) return null;

      const provider = str(p.provider);
      const src =
        provider === 'youtube'
          ? `https://www.youtube-nocookie.com/embed/${id}`
          : provider === 'vimeo'
            ? `https://player.vimeo.com/video/${id}?dnt=1`
            : null;

      if (!src) return null;

      return (
        <div
          className={`relative w-full overflow-hidden rounded-[var(--site-radius)] ${s.className}`.trim()}
          style={{ aspectRatio: '16 / 9', ...s.style }}
        >
          <iframe
            src={src}
            title={str(p.title) || 'Embedded video'}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="fullscreen; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      );
    }

    // A custom form: a container of `field` children with a server-owned submit. Interactive on the
    // public page, an honest disabled preview in the builder (no submitForm capability there).
    case 'form':
      return <FormNode node={node} site={site} />;

    case 'field': {
      const kind = str(p.kind) || 'text';
      const label = str(p.label);
      const name = str(p.name);
      const required = p.required === true;
      // The compact layouts hide the label visually (a screen reader still reads it), so it becomes
      // the placeholder when the field has none: the visitor still sees what to write.
      const compact = formLayout !== 'stacked';
      const placeholder = str(p.placeholder) || (compact ? label : '');
      const control =
        formLayout === 'prompt' && kind === 'textarea'
          ? 'w-full resize-none border-0 bg-transparent px-1 py-1 text-base leading-relaxed outline-none disabled:opacity-60'
          : formLayout === 'prompt'
            ? 'w-full rounded-full border border-current/15 bg-transparent px-4 py-2 text-sm outline-none disabled:opacity-60'
            : formLayout === 'inline'
              ? 'w-full rounded-[var(--site-button-radius,9999px)] border border-current/20 bg-transparent px-4 py-3 outline-none disabled:opacity-60'
              : 'w-full rounded-lg border border-current/20 bg-transparent px-3 py-2 outline-none disabled:opacity-60';

      // A checkbox is its own labelled control (a box beside the label), not a labelled input.
      if (kind === 'checkbox') {
        return (
          <label className={`flex items-start gap-2 text-sm ${compact ? 'basis-full' : ''}`.trim()}>
            <input type="checkbox" name={name} required={required} disabled={!formLive} className="mt-1 shrink-0 outline-none" />
            <span>{label}</span>
          </label>
        );
      }

      return (
        <label className={!compact ? 'block' : formLayout === 'prompt' && kind === 'textarea' ? 'block basis-full' : 'block min-w-[12rem] flex-1'}>
          {label ? <span className={compact ? 'sr-only' : 'mb-1 block text-sm font-medium'}>{label}</span> : null}
          {kind === 'textarea' ? (
            <textarea name={name} rows={formLayout === 'prompt' ? 3 : 4} required={required} disabled={!formLive} placeholder={placeholder} className={control} />
          ) : kind === 'select' ? (
            <select name={name} required={required} disabled={!formLive} defaultValue="" className={control}>
              <option value="" disabled>
                Choose one
              </option>
              {parseFieldOptions(p.options).map((option, i) => (
                <option key={i} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={
                kind === 'email' ? 'email' : kind === 'tel' ? 'tel' : kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text'
              }
              name={name}
              required={required}
              disabled={!formLive}
              placeholder={placeholder}
              className={control}
            />
          )}
        </label>
      );
    }

    case 'spacer':
      return <div className={SPACER_HEIGHT[str(p.size) || 'md'] ?? SPACER_HEIGHT.md} aria-hidden />;

    case 'divider': {
      // A hairline rule. For blank vertical space use <spacer> instead (divider no longer
      // carries a kind=space mode - the two were duplicates).
      const space = DIVIDER_SPACE[str(p.size) || 'md'] ?? DIVIDER_SPACE.md;

      return <hr className={`${space} border-current/15`} />;
    }

    case 'callout': {
      // A titled, toned aside (S1-04). role="note" + a label so a screen reader announces what it is;
      // the title is a bold line, not a heading, so it does not break the page's heading outline.
      const tone = CALLOUT_TONES[str(p.tone)] ?? CALLOUT_TONES.info;
      const title = str(p.title);
      const ToneIcon = tone.icon;

      // `.ans`: in a post, a callout with no tone is the short answer.
      if (postFlavor && !str(p.tone)) {
        return (
          <PostAnswer id={anchorId(p.anchor)} title={title} className={s.className} style={s.style}>
            <div className="space-y-2">{children(node, site, ctx)}</div>
          </PostAnswer>
        );
      }

      return (
        <aside
          role="note"
          id={anchorId(p.anchor)}
          aria-label={title || tone.label}
          className={`flex gap-3 rounded-[var(--site-radius)] border-l-4 p-4 sm:p-5 ${tone.className} ${s.className}`.trim()}
          style={s.style}
        >
          <ToneIcon className={`mt-0.5 h-5 w-5 shrink-0 ${tone.iconClass}`} aria-hidden />
          <div className="min-w-0 flex-1 space-y-2">
            {title ? <p className="font-semibold">{title}</p> : null}
            {children(node, site, ctx)}
          </div>
        </aside>
      );
    }

    case 'faq': {
      // An FAQ (S1-08). Each question is a native <details>, so it opens with JS off and is keyboard
      // reachable; FAQPage structured data is built from this same marker (lib/seo/site).
      const heading = str(p.heading);

      return (
        <section id={anchorId(p.anchor)} aria-label={heading || 'Frequently asked questions'} className={s.className} style={s.style}>
          {heading ? (
            <h2 className={postFlavor ? undefined : 'mb-4 text-2xl font-semibold tracking-tight'} style={postFlavor ? POST_H2 : undefined}>
              {heading}
            </h2>
          ) : null}
          <div className={postFlavor ? undefined : 'divide-y divide-current/10 border-y border-current/10'}>{children(node, site, ctx)}</div>
        </section>
      );
    }

    case 'faq_item': {
      const question = str(p.question);
      if (!question) return null;

      // `.faq`: in a post, the reference's question and answer; open on the canvas so the answer can be edited.
      if (postFlavor) {
        return (
          <PostFaqItem question={question} inCanvas={inCanvas} questionStyle={exampleLook(inCanvas, question)}>
            <div className="space-y-2">{children(node, site, ctx)}</div>
          </PostFaqItem>
        );
      }

      return (
        <details className="group py-4">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-medium outline-none [&::-webkit-details-marker]:hidden">
            <span style={exampleLook(inCanvas, question)}>{question}</span>
            <span aria-hidden className="mt-0.5 shrink-0 text-lg leading-none opacity-60 transition group-open:rotate-45">+</span>
          </summary>
          <div className="mt-3 space-y-2 opacity-90">{children(node, site, ctx)}</div>
        </details>
      );
    }

    case 'sources': {
      // Sources (S1-07): an ordered list of citations, numbered in document order.
      const title = str(p.title) || 'Sources';

      return (
        <section id={anchorId(p.anchor)} aria-label={title} className={s.className} style={s.style}>
          <h2 className="mb-3 text-lg font-semibold">{title}</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">{children(node, site, ctx)}</ol>
        </section>
      );
    }

    case 'source': {
      const title = str(p.title);
      if (!title) return null;

      const href = str(p.href);
      const publisher = str(p.publisher);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(str(p.date)) ? str(p.date) : '';

      return (
        <li>
          <cite className="font-medium not-italic">
            {href ? (
              <a href={assertSafeUrl(href)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
                {title}
              </a>
            ) : (
              title
            )}
          </cite>
          {publisher ? <span>, {publisher}</span> : null}
          {date ? (
            <span className="opacity-70">
              {' '}
              (read <time dateTime={date}>{SOURCE_DATE.format(new Date(`${date}T00:00:00Z`))}</time>)
            </span>
          ) : null}
        </li>
      );
    }

    case 'layer': {
      // Decoration only (S2-06): aria-hidden, behind the content, never interactive, never text.
      const shape = str(p.shape) || 'blob';
      const color = LAYER_COLOR[str(p.color)] ?? LAYER_COLOR.accent;
      const pattern = shape === 'dots' || shape === 'grid';
      const place = pattern ? 'inset-0' : `${LAYER_POSITION[str(p.position)] ?? LAYER_POSITION['top-right']} ${LAYER_SIZE[str(p.size)] ?? LAYER_SIZE.md}`;
      const base = `pointer-events-none absolute -z-10 ${place}`;

      if (shape === 'image') {
        const src = str(p.src);
        if (!src) return null;

        // eslint-disable-next-line @next/next/no-img-element -- a decorative, author-chosen remote image; next/image needs a fixed domain list
        return <img src={assertSafeUrl(src)} alt="" aria-hidden className={`${base} rounded-[var(--site-radius)] object-cover opacity-30`} />;
      }

      const look: React.CSSProperties =
        shape === 'dots'
          ? { backgroundImage: `radial-gradient(${color} 1.5px, transparent 1.5px)`, backgroundSize: '22px 22px', opacity: 0.25 }
          : shape === 'grid'
            ? { backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`, backgroundSize: '40px 40px', opacity: 0.12 }
            : shape === 'ring'
              ? { border: `24px solid ${color}`, opacity: 0.18 }
              : { backgroundColor: color, opacity: shape === 'circle' ? 0.18 : 0.35 };

      return <div aria-hidden className={`${base} ${shape === 'blob' ? 'rounded-full blur-3xl' : pattern ? '' : 'rounded-full'}`} style={look} />;
    }

    case 'toc':
      // `depth=3` arrives as a number from unquoted source and as "3" from the builder: accept both. A toc holding
      // toc_item children lists exactly those (T1: "a container with individual children for easy updates"); an empty
      // one lists the page's headings by itself.
      return <PmlToc title={str(p.title)} depth={String(p.depth ?? '') === '3' ? 3 : 2} items={tocItems(node)} className={s.className} style={s.style} />;

    case 'toc_item':
      // Drawn by its toc; a stray one draws nothing.
      return null;

    case 'list':
      return <PmlList node={node} site={site} className={s.className} style={s.style} />;

    case 'list_item':
      // Rendered by its parent <list>; a stray one on its own renders nothing.
      return null;

    case 'packages':
      // Interactive: the real is_public packages are baked into the snapshot at publish, and
      // choosing one starts the intake through the funnel (inert in the builder by design).
      return <PmlPackages props={p} />;

    case 'contact_form':
      // Interactive: owns its consent capture and calls the funnel's submitLead.
      return hostElement(host, 'contact_form', { props: p, site, className: s.className, style: s.style });

    case 'growth_form':
      return <PmlGrowthFormSlot />;

    case 'testimonials':
      // The consultant's ATTESTED + visible client testimonials, baked into the snapshot at
      // publish (CICC s.45). Inert content, so no funnel wiring; empty in the builder by design.
      return <PmlTestimonials props={p} className={s.className} style={s.style} />;

    case 'post_breadcrumbs':
    case 'post_category':
    case 'post_title':
    case 'post_dek':
    case 'post_author':
    case 'post_date':
    case 'post_read_time':
    case 'post_reviewer':
    case 'post_reviewer_badge':
    case 'post_sources_badge':
    case 'post_tags': {
      // The Classic template's post pieces (owner 2026-11-17, T1; the reference header, pml-kit 0.27): one element
      // each, so a template places them one by one. The host's drawing when it has one, else the package's, from the
      // post's own baked details.
      const piece = node.primitive as keyof typeof POST_PIECES;

      if (host.elements?.[piece]) return hostElement(host, piece, { props: p, site, className: s.className, style: s.style });
      const Piece = POST_PIECES[piece];

      return <Piece props={p} className={s.className} style={s.style} inCanvas={inCanvas} />;
    }

    case 'post_meta':
      // The byline row (the reference's .by): its pieces side by side, each its own element to move or drop; 13px slate,
      // the values bold ink (each piece draws its own value).
      return (
        <div className={s.className} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 4, fontSize: 13, color: 'var(--post-slate, #475569)', marginBottom: 10, ...s.style }}>
          {children(node, site, ctx)}
        </div>
      );

    case 'post_badges':
      // The trust row (the reference's .trust): the reviewer and sources badges, each its own element.
      if (host.elements?.post_badges) return hostElement(host, 'post_badges', { props: p, site, className: s.className, style: s.style });

      return (
        <PmlPostBadges className={s.className} style={s.style}>
          {children(node, site, ctx)}
        </PmlPostBadges>
      );

    case 'post_cover':
      // The cover: on the canvas an empty one is the reference's gradient panel and "Add a caption"; a live page
      // draws nothing for a post without a cover (never "the cover shows here" to a reader).
      if (host.elements?.post_cover) return hostElement(host, 'post_cover', { props: p, site, className: s.className, style: s.style });

      return <PmlPostCoverPiece props={p} className={s.className} style={s.style} inCanvas={inCanvas} />;

    case 'post_header':
    case 'post_related':
    case 'post_disclaimer': {
      // A post's own fields (post layouts C2b), baked at publish and preview: the host's drawing when it has one,
      // else the package's, so every product gets a post header without writing one.
      const part = node.primitive as 'post_header' | 'post_related' | 'post_disclaimer';

      if (host.elements?.[part]) return hostElement(host, part, { props: p, site, className: s.className, style: s.style });
      const Part = { post_header: PmlPostHeader, post_related: PmlPostRelated, post_disclaimer: PmlPostDisclaimer }[part];

      return <Part props={p} className={s.className} style={s.style} />;
    }

    case 'post_cta':
      // A call to action from the product's CTA library (post layouts C2d); a subscribe action draws the page's form.
      if (host.elements?.post_cta) return hostElement(host, 'post_cta', { props: p, site, className: s.className, style: s.style });

      return <PmlPostCta props={p} className={s.className} style={s.style} inCanvas={inCanvas} subscribeForm={<PmlGrowthFormSlot />} />;

    case 'post_story':
      // A consented client story from the product's story bank (post layouts C2e).
      if (host.elements?.post_story) return hostElement(host, 'post_story', { props: p, site, className: s.className, style: s.style });

      return <PmlPostStory props={p} className={s.className} style={s.style} inCanvas={inCanvas} />;

    case 'credentials':
      // The licensee badge: the host draws it from the verified register record baked at publish (its words are
      // the regulator's, so they live in the product).
      return hostElement(host, 'credentials', { props: p, site, className: s.className, style: s.style });

    case 'porter_intake':
      // The interactive front desk: a visitor chats, Porter surfaces the right service, and a
      // human presses the button that starts the intake (inert in the builder by design).
      return hostElement(host, 'porter_intake', { props: p, site, className: s.className, style: s.style });

    case 'script':
      // A PSL behaviour leaf: renders nothing, and executes its program into the shared page runtime
      // ONLY when the page enabled scripts (inert in the builder, where no runtime is provided). In the
      // builder it shows as a small chip naming what it defines (2026-11-10: a page's behaviour must
      // never be invisible in the Visual view), so it can be found, selected and asked about.
      if (inCanvas) return <ScriptChip source={str(p.source)} />;

      return <PslScript node={node} />;

    case 'p': {
      // A paragraph of words and inline elements (PML v3 L4), in the body type scale. An empty one draws nothing on the
      // canvas, so the one empty marker stands in for it (it was an invisible <p> nobody could find to fill).
      if (inCanvas && !hasWords(node)) return null;

      const body = withResponsive(bodyScale(size.body_size), size, ['body_size']);

      return (
        <p id={anchorId(p.anchor)} className={`scroll-mt-24 leading-relaxed ${body} ${s.className}`.trim()} style={s.style}>
          <InlineContext.Provider value={true}>{children(node, site, ctx)}</InlineContext.Provider>
        </p>
      );
    }

    case 'rich_text': {
      // Markdown as written, drawn from the document the server compiled from it; a `{...}` in it is
      // read in the page's scope, like any other expression. One the server tagged as a rich-text setting
      // (component props p10) is drawn as the Markdown it reads, wherever it sits.
      const body = withResponsive(bodyScale(size.body_size), size, ['body_size']);
      const evaluate = (attrs: Record<string, unknown>): Value =>
        ctx.scope && attrs.ast && typeof attrs.ast === 'object' ? evaluateIn(ctx.scope, attrs.ast as Parameters<typeof evaluateIn>[1], ctx.locals) : null;
      const read = (attrs: Record<string, unknown>): string => valueText(evaluate(attrs));

      return (
        <div id={anchorId(p.anchor)} className={`scroll-mt-24 ${body} ${s.className}`.trim()} style={s.style}>
          <RichTextExprContext.Provider value={read}>
            <RichText doc={expandRichAtoms(p.doc as Parameters<typeof RichText>[0]['doc'], evaluate)} />
          </RichTextExprContext.Provider>
        </div>
      );
    }

    default:
      // The block elements of PML v3 L5 (code block, quote block, details, definitions, figure).
      if (isBlockElement(node.primitive)) {
        const drawn = children(node, site, ctx);
        const kids = WORD_PARTS.includes(node.primitive ?? '') ? <InlineContext.Provider value={true}>{drawn}</InlineContext.Provider> : drawn;

        return renderBlock(node.primitive as string, p, kids, { className: s.className, style: s.style, id: anchorId(p.anchor), mark: selfPathProps(selfPath) });
      }

      if (isInlinePrimitive(node.primitive)) {
        return renderInline(node.primitive as string, p, <InlineContext.Provider value={true}>{children(node, site, ctx)}</InlineContext.Provider>, s);
      }

      // Unknown primitive renders nothing: one bad node must never white-screen a page.
      return null;
  }
}

/**
 * A custom form primitive: its `field` children rendered inside a real <form>, plus a consent
 * checkbox (when the form declares a consent notice) and a submit button. The submit is server-owned
 * (`submitForm` from the funnel), present on the public page and absent in the builder, so the form
 * is live in one place and an honest disabled preview in the other. On success it shows the form's
 * own success message. A failed send is SAID in the form: the visitor is a guest with no Porter
 * surface. Values are collected natively (FormData), so any named field is captured wherever it sits.
 */
function FormNode({ node, site }: { node: PmlNode; site: PublicSite }): React.JSX.Element {
  const ctx = useListCtx();
  const host = React.useContext(HostContext);
  const { submitForm } = useSiteInteractions();
  const p = node.props ?? {};
  const s = resolvePrimitiveStyle(node.style);
  const formKey = str(p.key);
  const title = str(p.title);
  const intro = str(p.intro);
  const submitLabel = str(p.submit_label) || 'Send';
  const successMessage = str(p.success_message) || 'Thank you. Your message has been sent.';
  const consentNotice = str(p.consent_notice);
  const rawLayout = str(p.layout);
  const layout: FormLayout = rawLayout === 'inline' || rawLayout === 'prompt' ? rawLayout : 'stacked';

  // No capability => inert. The builder never provides submitForm, so the preview cannot submit.
  const live = typeof submitForm === 'function' && formKey !== '';

  const [sending, setSending] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [heldBack, setHeldBack] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!live || !submitForm) return;

    const data: Record<string, unknown> = {};
    new FormData(e.currentTarget).forEach((value, key) => {
      data[key] = value;
    });

    setSending(true);
    setSubmitError(null);
    setHeldBack(false);

    try {
      // A preview sends nothing and says so: the form stays as filled in, with a note, never a thank-you.
      if ((await submitForm(formKey, data)) === NOT_SENT_IN_PREVIEW) {
        setHeldBack(true);
        return;
      }
      setSent(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error && err.message.trim() !== ''
          ? err.message
          : 'This could not be sent. Please try again in a moment.',
      );
      host.onError?.(err);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <section className={s.className} style={s.style}>
        <div className="mx-auto max-w-xl rounded-[var(--site-radius)] bg-[var(--site-surface)] px-6 py-10 text-center">
          <p className="font-medium">{successMessage}</p>
        </div>
      </section>
    );
  }

  return (
    <section className={s.className} style={s.style}>
      {title ? <h2 className="text-2xl font-semibold tracking-tight">{title}</h2> : null}
      {intro ? <p className="mt-2 leading-relaxed opacity-80">{intro}</p> : null}

      <form onSubmit={onSubmit} className={layout === 'stacked' ? 'mt-4 space-y-4' : 'mt-4 space-y-3'} noValidate>
        <FormLayoutContext.Provider value={layout}>
          {layout === 'prompt' ? (
            // One box the visitor writes into; the round send button sits inside it, bottom right. It
            // takes the site's own page colours, text with background, so it reads on a dark band too.
            <div className="flex flex-wrap items-end gap-3 rounded-[var(--site-radius)] border border-current/15 bg-[var(--site-bg,#fff)] p-4 text-[var(--site-text,#0f172a)] shadow-[0_12px_40px_-16px_rgba(15,23,42,0.25)]">
              <FormLiveContext.Provider value={live}>{children(node, site, ctx)}</FormLiveContext.Provider>
              <button
                type="submit"
                aria-label={submitLabel}
                title={submitLabel}
                disabled={!live || sending}
                className={`ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full outline-none transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${ACCENT_BUTTON}`}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <ArrowUp className="h-5 w-5" aria-hidden />}
              </button>
            </div>
          ) : layout === 'inline' ? (
            // The fields and the button on one line (stacked on a phone), like a sign-up.
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <FormLiveContext.Provider value={live}>{children(node, site, ctx)}</FormLiveContext.Provider>
              <button
                type="submit"
                disabled={!live || sending}
                className={`inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--site-button-radius,9999px)] px-6 py-3 font-medium outline-none transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${ACCENT_BUTTON}`}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitLabel}
              </button>
            </div>
          ) : (
            <FormLiveContext.Provider value={live}>{children(node, site, ctx)}</FormLiveContext.Provider>
          )}
        </FormLayoutContext.Provider>

        {consentNotice ? (
          <label className={`flex items-start gap-2 ${layout === 'stacked' ? 'text-sm' : 'text-xs'}`}>
            <input type="checkbox" name="consent" required disabled={!live} className="mt-0.5 shrink-0 outline-none" />
            <span className="opacity-85">{consentNotice}</span>
          </label>
        ) : null}

        {submitError ? (
          <p role="alert" className="rounded-[var(--site-radius)] border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-800">
            {submitError}
          </p>
        ) : null}

        {layout === 'stacked' ? (
          <button
            type="submit"
            disabled={!live || sending}
            className={`inline-flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-[var(--site-button-radius,9999px)] px-6 py-3 font-medium outline-none transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${ACCENT_BUTTON}`}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitLabel}
          </button>
        ) : null}

        {!live ? (
          <p className="text-center text-xs opacity-60">
            This is a preview. Submissions are delivered once the page is published.
          </p>
        ) : null}

        {heldBack ? (
          <p role="status" className="text-center text-sm opacity-80">
            {PREVIEW_NOT_SENT_NOTE}
          </p>
        ) : null}
      </form>
    </section>
  );
}

/**
 * A structured list: one primitive with a `type` axis (bullet | numbered | check | icon) holding
 * list_item children. `icon` draws item cards (icon + title + text); the others draw a marked line
 * from each item's text. Replaces the four near-identical bullet/numbered/checklist/icon sections.
 */
/**
 * A table of contents (S1-06): the page's level-2 headings (and level 3 at depth=3), in order,
 * linking to their anchors. Built at render from the page itself, so it is never out of date.
 * Renders nothing when the page has no headings to list.
 */
/** A toc's own items, in order: `{label, target}` each; an item without a label or a target is left out. */
/** A toc's own items, each with its index among the toc's children (its path, which the canvas selects it by). */
function tocItems(node: PmlNode): { text: string; anchor: string; level: number; index: number }[] {
  return (node.children ?? [])
    .map((child, index) => ({ child, index }))
    .filter(({ child }) => child.primitive === 'toc_item')
    .map(({ child, index }) => ({ text: str(child.props?.label), anchor: str(child.props?.target).replace(/^#/, ''), level: 2, index }))
    .filter((item) => item.text !== '' && item.anchor !== '');
}

function PmlToc({
  title,
  depth,
  items,
  className,
  style,
}: {
  title: string;
  depth: 2 | 3;
  items: { text: string; anchor: string; level: number; index?: number }[];
  className: string;
  style: React.CSSProperties;
}): React.JSX.Element | null {
  const outline = React.useContext(OutlineContext).filter((e) => e.level >= 2 && e.level <= depth);
  const entries: { text: string; anchor: string; level: number; index?: number }[] = items.length > 0 ? items : outline;
  const hints = React.useContext(BuilderHintsContext);
  // The toc's own path in the builder: each item it holds marks its <li> with its own, so a click selects that link,
  // not the whole list (owner 2026-11-17). A list built from the headings has no items of its own to select.
  const own = React.useContext(PathContext);
  const mark = (index: number | undefined): Record<string, string> => (hints && own.length > 0 && index !== undefined ? selfPathProps([...own, index].join('.')) : {});
  const label = title || 'On this page';

  if (entries.length === 0) {
    // On the live page an empty TOC is simply absent; in the builder it says what will fill it.
    return hints ? (
      <p className={`rounded-[var(--site-radius)] border border-dashed border-current/20 p-4 text-sm opacity-70 ${className}`.trim()} style={style}>
        {label}: the page&apos;s level-{depth === 3 ? '2 and 3' : '2'} headings will be listed here.
      </p>
    ) : null;
  }

  return (
    <nav aria-label={label} className={`rounded-[var(--site-radius)] border border-current/10 p-4 sm:p-5 ${className}`.trim()} style={style}>
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <ol className="space-y-1.5 text-sm">
        {entries.map((e) => (
          <li key={e.anchor} className={e.level === 3 ? 'pl-4' : undefined} {...mark(e.index)}>
            <a href={`#${e.anchor}`} className="underline-offset-4 opacity-80 hover:underline hover:opacity-100" style={exampleLook(hints, e.text)}>
              {e.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** A list item's index among ALL its list's children: its path, which the canvas selects and edits by. */
function itemIndex(list: PmlNode, item: PmlNode): number {
  return (list.children ?? []).indexOf(item);
}

/**
 * A list item that holds words (pml-kit 0.25.0): its own runs of words with marks and links, and at most one nested
 * list after them (designer sole surface P3: a written post's linked or nested list items convert without loss). An
 * item WITHOUT children is drawn by its list exactly as before. Its words carry the item's path on their own span, so a
 * double-click edits just the words and the nested list keeps its own path, drawn under them.
 */
function ListItemBody({ item, index, site }: { item: PmlNode; index: number; site: PublicSite }): React.JSX.Element {
  const ctx = useListCtx();
  const all = item.children ?? [];
  const words = all.filter((child) => child.primitive !== 'list');
  const nestedAt = all.findIndex((child) => child.primitive === 'list');
  const ip = item.props ?? {};
  const title = str(ip.title);
  // Words, when the item has any, ARE its words (its `text` is ignored); otherwise its text, as a plain item draws it.
  const said: React.ReactNode =
    words.length > 0 ? <InlineContext.Provider value={true}>{children({ ...item, children: words }, site, ctx)}</InlineContext.Provider> : str(ip.text) || null;

  return (
    <NodePath index={index} self>
      <ListItemWords title={words.length > 0 ? title : str(ip.text) ? '' : title}>{said}</ListItemWords>
      {nestedAt >= 0 ? (
        <NodePath index={nestedAt}>
          <PmlNodeView node={all[nestedAt]} site={site} />
        </NodePath>
      ) : null}
    </NodePath>
  );
}

/** An item's words (its bold opening label first, as the converter keeps it), marked with the item's own path. */
function ListItemWords({ title, children: said }: { title: string; children: React.ReactNode }): React.JSX.Element {
  const selfPath = React.useContext(SelfPathContext);

  return (
    <span {...selfPathProps(selfPath)}>
      {title ? <strong>{title}</strong> : null}
      {title && said ? ' ' : null}
      {said}
    </span>
  );
}

function PmlList({
  node,
  site,
  className,
  style,
}: {
  node: PmlNode;
  site: PublicSite;
  className: string;
  style: React.CSSProperties;
}): React.JSX.Element {
  const p = node.props ?? {};
  const type = str(p.type) || 'bullet';
  const heading = str(p.heading);
  const items = (node.children ?? []).filter((c) => c.primitive === 'list_item');
  const forceMobile = React.useContext(ForceMobileContext);

  const title = heading ? (
    <h2 className="mb-4 text-2xl font-semibold tracking-tight">{heading}</h2>
  ) : null;
  // A titled list is a section of the page; an untitled one is just a group (S1: a <section> with no
  // heading is an unlabelled landmark, which screen readers announce as noise).
  const Wrapper = heading ? 'section' : 'div';
  const id = anchorId(p.anchor);

  if (type === 'icon') {
    return (
      <Wrapper id={id} className={className} style={style}>
        {title}
        <div className={`grid grid-cols-1 gap-6 ${forceMobile ? '' : 'md:grid-cols-3'}`.trim()}>
          {items.map((item, i) => {
            const ip = item.props ?? {};
            const Icon = ICON_MAP[str(ip.icon)];
            const rich = (item.children ?? []).length > 0;

            return (
              <div
                key={i}
                className="rounded-[var(--site-radius)] border border-current/10 bg-[var(--site-surface)] p-5"
              >
                {Icon ? <Icon className="mb-3 h-6 w-6 text-[var(--site-accent)]" aria-hidden /> : null}
                {str(ip.title) ? <h3 className="text-base font-semibold">{str(ip.title)}</h3> : null}
                {rich ? (
                  <div className="mt-1 text-sm opacity-80">
                    <ListItemBody item={{ ...item, props: { ...ip, title: '' } }} index={itemIndex(node, item)} site={site} />
                  </div>
                ) : str(ip.text) ? (
                  <p className="mt-1 text-sm opacity-80">{str(ip.text)}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </Wrapper>
    );
  }

  const Tag = type === 'numbered' ? 'ol' : 'ul';
  const marker = type === 'numbered' ? 'list-decimal pl-5' : type === 'check' ? '' : 'list-disc pl-5';

  return (
    <Wrapper id={id} className={className} style={style}>
      {title}
      <Tag className={`space-y-1.5 ${marker}`.trim()}>
        {items.map((item, i) => {
          const ip = item.props ?? {};
          const text = str(ip.text) || str(ip.title);
          // An item holding words or a nested list (pml-kit 0.25.0); a plain item draws exactly as before.
          const body = (item.children ?? []).length > 0 ? <ListItemBody item={item} index={itemIndex(node, item)} site={site} /> : null;

          if (type === 'check') {
            return (
              <li key={i} className="flex list-none items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--site-accent)]" aria-hidden />
                {body ? <div>{body}</div> : <span>{text}</span>}
              </li>
            );
          }

          return <li key={i}>{body ?? text}</li>;
        })}
      </Tag>
    </Wrapper>
  );
}
