'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  ClipboardList,
  Code2,
  FileText,
  Heading,
  HelpCircle,
  Image as ImageIcon,
  Info,
  LayoutGrid,
  List,
  ListCollapse,
  ListTree,
  type LucideIcon,
  Mail,
  Megaphone,
  Minus,
  MousePointerClick,
  MoveVertical,
  Navigation,
  Package,
  PanelBottom,
  PanelTop,
  Pilcrow,
  Puzzle,
  Blocks,
  Quote,
  Search,
  Sparkles,
  Square,
  Star,
  Table,
  Type,
  User,
  Video,
} from 'lucide-react';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/overlays';
import { useEditorSurface } from './surface';
import { Input } from '../ui/controls';
import type { DocumentPartial as SitePartial } from '../components';
import type { DocumentLibraryComponent as BuilderStudioComponent } from '../components';
import { useCatalog as useStudioCatalog } from './catalog';
import {
  groupOf,
  PML_GROUP_LABELS,
  PML_GROUP_ORDER,
  PML_SECTIONS,
  type PmlGroup,
} from '../../language';
import type { PmlNode } from '../../language';

/**
 * The "Add a section" modal. Building blocks are grouped Basic / Layout / Components /
 * My components (see catalog `group`), with a search box across all of them. Selecting an
 * entry inserts its starter node and closes. Singletons already on the page are disabled.
 *
 * The dialog is bounded (`max-h-[90vh]`) with its header and search pinned; the groups scroll in a DialogBody
 * (`flex-1 min-h-0 overflow-y-auto`), so the last entry is reachable on a short screen (pml-email Loop 1 found
 * the list clipped with no scroll at 600px).
 */

const ICONS: Record<string, LucideIcon> = {
  Blocks,
  Code2,
  FileText,
  ListCollapse,
  Pilcrow,
  Sparkles,
  User,
  Type,
  Heading,
  Image: ImageIcon,
  HelpCircle,
  BarChart3,
  Megaphone,
  Package,
  BadgeCheck,
  Mail,
  Info,
  List,
  ClipboardList,
  Minus,
  MousePointerClick,
  MoveVertical,
  Square,
  LayoutGrid,
  Star,
  Table,
  Video,
  Quote,
  Puzzle,
  Navigation,
  PanelTop,
  PanelBottom,
  ListTree,
  BookOpen,
};

/**
 * A starter node's `defaults` are plain JSON (PML nodes serialise to/from JSON), so a JSON
 * clone is a safe deep copy, and unlike structuredClone it works outside a browser too.
 */
const cloneNode = (node: PmlNode): PmlNode => JSON.parse(JSON.stringify(node)) as PmlNode;

type MenuItem = {
  key: string;
  label: string;
  description: string;
  icon: string;
  disabled: boolean;
  add: () => void;
};

/** A Portify component starts on the version published now, so a later version never moves it. */
function addStudioComponent(component: BuilderStudioComponent): PmlNode {
  return { component: component.key, props: { version: component.current_version ?? 1 } };
}

/**
 * Insert a partial ("My component") as a component node. The tag scanner normalises a kebab handle
 * to snake, so the node's component name must be the snake form. It starts with no values: each setting
 * shows its default until the page sets one, exactly like a Portify component.
 */
function addPartial(partial: SitePartial): PmlNode {
  return { component: partial.handle.replace(/-/g, '_'), props: {} };
}

/** A stable empty list, so the default never changes identity between renders. */
const NONE: string[] = [];

export function PmlAddSectionDialog({
  open,
  onOpenChange,
  existing,
  onAdd,
  partials = [],
  groups: allowedGroups = PML_GROUP_ORDER,
  variant = 'standard',
  title = 'Add a section',
  description = 'Pick a building block. Basic pieces and layouts, ready-made sections, or one of your own saved components.',
  unavailable = NONE,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: PmlNode[];
  onAdd: (node: PmlNode) => void;
  /** The site's reusable components (partials), offered under "My components". */
  partials?: SitePartial[];
  /** Restrict which groups are offered. A layout container only takes Basic + Layout children. */
  groups?: PmlGroup[];
  /**
   * 'standard' (the default) shows the free building blocks and hides premium components + the
   * consultant's own saved components. 'premium' shows ONLY those: the Scale-plan components and
   * My components. So the two are split across two modals without duplicating the picker.
   */
  variant?: 'standard' | 'premium';
  title?: string;
  description?: string;
  /**
   * Sections this site cannot have (the site payload's `unavailable_sections`, from its owner): on
   * Portify's own site, the licensee modules and the licensee-identity header/nav/footer. Hidden,
   * because the server would refuse them anyway.
   */
  unavailable?: string[];
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const surface = useEditorSurface();
  const studio = useStudioCatalog();
  const refused = useMemo(() => new Set(unavailable), [unavailable]);
  const used = useMemo(
    () => new Set(existing.map((node) => node.component ?? node.primitive)),
    [existing],
  );

  const close = useCallback(
    (node?: PmlNode) => {
      if (node) onAdd(node);
      setQuery('');
      onOpenChange(false);
    },
    [onAdd, onOpenChange],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (label: string, description: string) =>
      q === '' || label.toLowerCase().includes(q) || description.toLowerCase().includes(q);

    return allowedGroups.map((group: PmlGroup) => {
      let items: MenuItem[];

      if (group === 'portify-components') {
        items =
          variant === 'premium'
            ? []
            : studio
                .filter((component) => component.offered)
                .map((component) => ({
                  key: component.key,
                  label: component.name,
                  description: component.description ?? `<${component.tag}/>`,
                  icon: 'Blocks',
                  disabled: false,
                  add: () => close(addStudioComponent(component)),
                }));
      } else if (group === 'my-components') {
        // The consultant's own saved components are a Scale feature, shown only in the premium modal.
        items =
          variant === 'premium'
            ? partials.map((partial) => ({
                key: partial.id,
                label: partial.name,
                description: `<${partial.handle}/>`,
                icon: 'Puzzle',
                disabled: false,
                add: () => close(addPartial(partial)),
              }))
            : [];
      } else {
        items = PML_SECTIONS.filter((def) => groupOf(def) === group)
          // The premium modal shows ONLY premium components; the standard modal shows the rest.
          .filter((def) => (variant === 'premium' ? def.premium === true : !def.premium))
          // Never offer what this site's owner cannot have.
          .filter((def) => !refused.has(def.name) && !refused.has(def.defaults.primitive ?? ''))
          .map((def) => ({
            key: def.name,
            label: def.label,
            description: def.description,
            icon: def.icon,
            disabled: Boolean(def.singleton && used.has(def.name)),
            add: () => close(cloneNode(def.defaults)),
          }));
      }

      return {
        group,
        label: PML_GROUP_LABELS[group],
        items: items.filter((item) => match(item.label, item.description)),
      };
    }).filter((section) => section.items.length > 0);
  }, [allowedGroups, close, partials, query, refused, studio, used, variant]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery('');
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0 px-5">
          <Search className="pointer-events-none absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
          <Input
            id="pml-add-search"
            name="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={surface === 'email' ? 'Search blocks' : 'Search sections'}
            className="pl-9 pr-3 py-2 outline-none"
            autoComplete="off"
            aria-label={surface === 'email' ? 'Search blocks' : 'Search sections'}
          />
        </div>

        {/* The list scrolls inside the bounded dialog (the header and search stay pinned), so the last item is
            reachable on a short screen. */}
        <DialogBody className="space-y-5 pb-5">
          {groups.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--pb-muted)]">
              Nothing matches &ldquo;{query}&rdquo;.
            </p>
          ) : (
            groups.map((section) => (
              <div key={section.group}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--pb-muted)]">
                  {section.label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {section.items.map((item) => {
                    const Icon = ICONS[item.icon] ?? Sparkles;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        disabled={item.disabled}
                        title={item.disabled ? (surface === 'email' ? 'Already in this email' : 'Already on this page') : item.description}
                        onClick={item.add}
                        className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-left text-sm outline-none hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-70" />
                        <span className="min-w-0 truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
