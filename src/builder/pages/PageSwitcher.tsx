'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Copy, Eye, EyeOff, Home, MoreVertical, Navigation, Pencil, Plus, Trash2 } from 'lucide-react';

import { Button, Input, Label } from '../ui/controls';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  DialogFooter,
  DialogHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/overlays';
import { useBuilderHost } from '../editor/host';

/**
 * A document that is a SET of pages (shared program E4h): a growth landing page with Home, Benefits, FAQ; later a
 * consultant site. Every page is its own document, opened by its `id` through the host's ordinary `DocumentAdapter`, so
 * switching pages re-opens the editor (and its console subject) on that page: a Build on one page never edits another.
 */
export type SetPageState = 'draft' | 'ready' | 'hidden';

export interface SetPage {
  /** The id the host's DocumentAdapter opens this page by. */
  id: string;
  slug: string;
  /** The set's first page: its address is the set's own, so it cannot be deleted or hidden. */
  root: boolean;
  title: string;
  navLabel: string | null;
  showInNav: boolean;
  state: SetPageState;
  publicUrl: string | null;
}

export interface DocumentSetPort {
  pages(): Promise<SetPage[]>;
  addPage(page: { title: string; slug: string }): Promise<SetPage>;
  updatePage(id: string, change: Partial<{ title: string; slug: string; navLabel: string | null; showInNav: boolean; state: SetPageState }>): Promise<SetPage>;
  /** The non-root pages' ids in their new order (the root always stays first). */
  reorderPages(ids: string[]): Promise<SetPage[]>;
  deletePage(id: string): Promise<void>;
}

export interface PageSwitcherLabels {
  addPage: string;
  /** What a deleted page's address does now, said in the confirm dialog. */
  deleteConsequence: string;
}

const DEFAULT_LABELS: PageSwitcherLabels = {
  addPage: 'Add a page',
  deleteConsequence: 'Its address sends visitors to the first page instead.',
};

const STATE_WORDS: Record<SetPageState, string> = { draft: 'Draft', ready: 'Ready', hidden: 'Hidden' };

/** Lowercase letters, numbers and hyphens, from a title ("Why us?" becomes "why-us"). */
export function slugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

type Editing = { mode: 'add' } | { mode: 'rename'; page: SetPage } | null;

/**
 * The set's pages in order, for a slide-in panel beside the canvas: open one, add, rename, show in the navigation,
 * move up or down, hide and delete (last, red, confirmed). The root is marked and cannot be deleted or hidden.
 */
export function PageSwitcher({
  port,
  currentId,
  onOpen,
  onChanged,
  labels,
}: {
  port: DocumentSetPort;
  currentId: string;
  /** Open this page in the editor (the host re-opens the editor on its id). */
  onOpen: (page: SetPage) => void;
  /** After any change, so the host can refresh what it shows (a navigation preview, a title). */
  onChanged?: (pages: SetPage[]) => void;
  labels?: Partial<PageSwitcherLabels>;
}): React.JSX.Element {
  const words = { ...DEFAULT_LABELS, ...labels };
  const host = useBuilderHost();
  const [pages, setPages] = useState<SetPage[] | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<SetPage | null>(null);
  const [busy, setBusy] = useState(false);

  const settle = useCallback(
    (next: SetPage[]) => {
      setPages(next);
      onChanged?.(next);
    },
    [onChanged],
  );

  useEffect(() => {
    let alive = true;
    port
      .pages()
      .then((list) => alive && setPages(list))
      .catch(host.onError);

    return () => {
      alive = false;
    };
  }, [port, host.onError]);

  const run = useCallback(
    async (work: () => Promise<SetPage[]>) => {
      setBusy(true);
      try {
        settle(await work());

        return true;
      } catch (error) {
        host.onError(error);

        return false;
      } finally {
        setBusy(false);
      }
    },
    [host, settle],
  );

  const change = (page: SetPage, patch: Parameters<DocumentSetPort['updatePage']>[1]) =>
    run(async () => {
      await port.updatePage(page.id, patch);

      return port.pages();
    });

  const move = (page: SetPage, by: -1 | 1) => {
    const children = (pages ?? []).filter((p) => !p.root).map((p) => p.id);
    const at = children.indexOf(page.id);
    const to = at + by;
    if (at < 0 || to < 0 || to >= children.length) return;
    [children[at], children[to]] = [children[to], children[at]];
    void run(() => port.reorderPages(children));
  };

  const copy = async (page: SetPage) => {
    if (!page.publicUrl) return;
    try {
      await navigator.clipboard.writeText(page.publicUrl);
      host.onSuccess('Address copied.');
    } catch (error) {
      host.onError(error);
    }
  };

  if (pages === null) {
    return <p className="px-1 py-2 text-sm text-[var(--pb-muted)]">Loading the pages...</p>;
  }
  const children = pages.filter((p) => !p.root);

  return (
    <div className="space-y-3">
      <ul className="space-y-1" aria-label="Pages">
        {pages.map((page) => {
          const current = page.id === currentId;
          const index = children.findIndex((p) => p.id === page.id);

          return (
            <li key={page.id} className={`flex items-center gap-2 rounded-[var(--pb-radius)] border px-3 py-2 ${current ? 'border-[var(--pb-accent)] bg-[var(--pb-subtle)]' : 'border-[var(--pb-border)]'}`}>
              <button
                type="button"
                className="min-w-0 flex-1 text-left outline-none"
                aria-current={current ? 'page' : undefined}
                onClick={() => !current && onOpen(page)}
              >
                <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--pb-text)]">
                  {page.root ? <Home className="h-3.5 w-3.5 shrink-0" aria-label="First page" /> : null}
                  <span className="truncate">{page.title}</span>
                </span>
                <span className="block truncate text-xs text-[var(--pb-muted)]">
                  {page.root ? '/' : `/${page.slug}`} {'·'} {STATE_WORDS[page.state]}
                  {!page.showInNav ? ', not in the navigation' : ''}
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Actions for ${page.title}`} disabled={busy}>
                    <MoreVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing({ mode: 'rename', page })}>
                    <Pencil /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => void change(page, { showInNav: !page.showInNav })}>
                    <Navigation /> {page.showInNav ? 'Leave out of the navigation' : 'Show in the navigation'}
                  </DropdownMenuItem>
                  {!page.root && index > 0 ? (
                    <DropdownMenuItem onSelect={() => move(page, -1)}>
                      <ArrowUp /> Move up
                    </DropdownMenuItem>
                  ) : null}
                  {!page.root && index < children.length - 1 ? (
                    <DropdownMenuItem onSelect={() => move(page, 1)}>
                      <ArrowDown /> Move down
                    </DropdownMenuItem>
                  ) : null}
                  {!page.root && page.state !== 'hidden' ? (
                    // A set goes live only when every page that is not hidden is marked ready (the server says which is not).
                    <DropdownMenuItem onSelect={() => void change(page, { state: page.state === 'ready' ? 'draft' : 'ready' })}>
                      <Check /> {page.state === 'ready' ? 'Back to draft' : 'Mark ready'}
                    </DropdownMenuItem>
                  ) : null}
                  {!page.root ? (
                    <DropdownMenuItem onSelect={() => void change(page, { state: page.state === 'hidden' ? 'draft' : 'hidden' })}>
                      {page.state === 'hidden' ? <Eye /> : <EyeOff />} {page.state === 'hidden' ? 'Show again' : 'Hide'}
                    </DropdownMenuItem>
                  ) : null}
                  {page.publicUrl ? (
                    <DropdownMenuItem onSelect={() => void copy(page)}>
                      <Copy /> Copy address
                    </DropdownMenuItem>
                  ) : null}
                  {!page.root ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem destructive onSelect={() => setDeleting(page)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>

      {editing ? (
        <PageForm
          key={editing.mode === 'rename' ? editing.page.id : 'add'}
          page={editing.mode === 'rename' ? editing.page : null}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSave={async (values) => {
            const ok = await run(async () => {
              if (editing.mode === 'add') {
                const added = await port.addPage({ title: values.title, slug: values.slug });
                const next = await port.pages();
                onOpen(added);

                return next;
              }
              await port.updatePage(editing.page.id, editing.page.root ? { title: values.title, navLabel: values.navLabel } : values);

              return port.pages();
            });
            if (ok) setEditing(null);
          }}
        />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setEditing({ mode: 'add' })} disabled={busy}>
          <Plus /> {words.addPage}
        </Button>
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <DialogHeader>
            <AlertDialogTitle>Delete {deleting?.title}?</AlertDialogTitle>
            <AlertDialogDescription>The page and its design are removed for good. {words.deleteConsequence}</AlertDialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const page = deleting;
                if (!page) return;
                void run(async () => {
                  await port.deletePage(page.id);
                  const next = await port.pages();
                  if (page.id === currentId && next[0]) onOpen(next[0]);

                  return next;
                });
              }}
            >
              Delete the page
            </AlertDialogAction>
          </DialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PageForm({
  page,
  busy,
  onCancel,
  onSave,
}: {
  page: SetPage | null;
  busy: boolean;
  onCancel: () => void;
  onSave: (values: { title: string; slug: string; navLabel: string | null }) => void;
}): React.JSX.Element {
  const [title, setTitle] = useState(page?.title ?? '');
  const [slug, setSlug] = useState(page?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(page !== null);
  const [navLabel, setNavLabel] = useState(page?.navLabel ?? '');
  const shownSlug = slugTouched ? slug : slugFromTitle(title);

  return (
    <form
      className="space-y-2 rounded-[var(--pb-radius)] border border-[var(--pb-border)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ title: title.trim(), slug: shownSlug, navLabel: navLabel.trim() || null });
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="pml-set-page-title">Page title</Label>
        <Input id="pml-set-page-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required />
      </div>
      {page?.root ? null : (
        <div className="space-y-1">
          <Label htmlFor="pml-set-page-slug">Address</Label>
          <Input
            id="pml-set-page-slug"
            value={shownSlug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            maxLength={60}
            required
          />
          {page ? <p className="text-xs text-[var(--pb-muted)]">A changed address keeps the old one working for 90 days.</p> : null}
        </div>
      )}
      {page ? (
        <div className="space-y-1">
          <Label htmlFor="pml-set-page-nav">Name in the navigation</Label>
          <Input id="pml-set-page-nav" value={navLabel} onChange={(e) => setNavLabel(e.target.value)} maxLength={60} placeholder={title} />
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={busy || title.trim() === '' || shownSlug === ''}>
          {page ? 'Save' : 'Add the page'}
        </Button>
      </div>
    </form>
  );
}
