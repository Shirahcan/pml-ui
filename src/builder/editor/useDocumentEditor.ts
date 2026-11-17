'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ensureUids, type PmlNode } from '../../language';
import type { DocumentLibraryComponent, DocumentPartial } from '../components';
import { isConflict, isPlaceholders, isRefused, type EditableDocumentAdapter, type DocumentPlaceholders, type DocumentPreflight } from '../document';
import { useBuilderHost } from './host';
import { useCompiledPreview } from './useCompiledPreview';
import { useEditHistory } from './useEditHistory';

/** The assistant's PENDING proposal: in memory only until the author accepts it. */
export interface PendingProposal {
  nodes: PmlNode[];
  instruction: string;
  kind: 'pml';
}

/** A loaded document: its tree, the revision the editor saw, and the host's own object for it (a page, an email). */
export interface LoadedDocument<H> {
  nodes: PmlNode[];
  revision: string;
  host: H | null;
}

export interface DocumentEditorOptions<H> {
  /** Load the document with the host's own object in ONE call (Portify: the page and its site). Default: adapter.load. */
  load?: (id: string) => Promise<LoadedDocument<H>>;
  /** The host's object as the host now holds it, after a publish or a rollback (status, dates). */
  refreshHost?: (id: string) => Promise<H>;
  /** Called after a publish with the host's object as refreshed by `refreshHost` (the one now live). */
  onPublished?: (host: H | null) => void;
  /** Override the host context's messages (a hook used outside the editor's BuilderHostProvider). */
  onSuccess?: (message: string) => void;
  onWarning?: (message: string) => void;
  onError?: (error: unknown) => void;
  /** What the document is called in messages ("page", "email"), and what a successful publish says. */
  noun?: string;
  publishedMessage?: string;
  /** What a publish that went through with a warning says (the change may take a while to show everywhere). */
  publishedWarning?: string;
  /** What a rollback says once it lands (a post's is "The draft was thrown away."); defaults to the page's words. */
  rolledBackMessage?: string;
}

/**
 * The visual editor's state and actions for any document kind (shared program E4a4i, from Portify's page editor).
 * Drafts autosave (an editor that needs a Save button is one people lose work in); the canvas shows the host's
 * COMPILED preview and keeps the last good one while an edit is transiently invalid; publishing is a separate act and
 * the only moment a check can refuse. No silent overwrite: a save from a revision someone else replaced is a conflict
 * the author decides. Pass a STABLE adapter (memoised): a new one each render reloads the document each render.
 *
 * Saves run one after another, each from the revision the last one returned, and a save only counts as "nothing
 * waiting" when what it stored is still what is on screen. A document that could not be loaded is never saved: with
 * no revision there is nothing to protect a newer version with. Switching `id` starts the next document clean.
 */
export function useDocumentEditor<H = unknown>(adapter: EditableDocumentAdapter, id: string, options: DocumentEditorOptions<H> = {}) {
  const ctx = useBuilderHost();
  const noun = options.noun ?? 'page';
  const say = { success: options.onSuccess ?? ctx.onSuccess, warning: options.onWarning ?? options.onSuccess ?? ctx.onSuccess, error: options.onError ?? ctx.onError };
  const sayRef = useRef(say);
  sayRef.current = say;
  const loadRef = useRef(options.load);
  loadRef.current = options.load;

  const [host, setHost] = useState<H | null>(null);
  const [nodes, setNodes] = useState<PmlNode[]>([]);
  const [partials, setPartials] = useState<DocumentPartial[]>([]);
  const [studioComponents, setStudioComponents] = useState<DocumentLibraryComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scan, setScan] = useState<DocumentPreflight | null>(null);
  const [placeholdersLeft, setPlaceholdersLeft] = useState<{ message: string; left: Omit<DocumentPlaceholders, 'message'> } | null>(null);
  const [pending, setPending] = useState<PendingProposal | null>(null);
  const [pendingCompiled, setPendingCompiled] = useState<{ for: PendingProposal; tree: PmlNode[] } | null>(null);
  const [conflict, setConflict] = useState<{ revision: string } | null>(null);

  const history = useEditHistory();
  const clearHistory = history.clear;
  const latestNodes = useRef<PmlNode[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editorSession] = useState(() => crypto.randomUUID());
  // The revision this editor last saw, PER DOCUMENT, so a save answered after the editor moved on still records its own.
  const revisions = useRef(new Map<string, string>());
  // Bumped whenever the tree on screen is replaced from elsewhere (a load, Load the latest, another document): a save
  // begun before it no longer describes the screen, so it must not mark the screen saved or raise a conflict on it.
  const generation = useRef(0);
  const saveChain = useRef<Promise<unknown>>(Promise.resolve());
  const dirtyRef = useRef(false);
  const loadedId = useRef<string | null>(null);

  const preview = useCompiledPreview(adapter, id, nodes, !loading && loadError === null, (err) => sayRef.current.error(err));
  const resetPreview = preview.reset;

  const markDirty = useCallback((value: boolean) => {
    dirtyRef.current = value;
    setDirty(value);
  }, []);

  /** Stop a save that has not been sent: the tree it would send is no longer the one the author wants. */
  const cancelWaitingSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
  }, []);

  const loadDocument = useCallback(async (): Promise<LoadedDocument<H>> => {
    if (loadRef.current) return loadRef.current(id);
    const loaded = await adapter.load(id);

    return { nodes: loaded.document.nodes, revision: loaded.revision, host: null };
  }, [adapter, id]);

  const take = useCallback(
    (loaded: LoadedDocument<H>) => {
      setHost(loaded.host);
      revisions.current.set(id, loaded.revision);
      // Every element gets its permanent id on first load; autosave then keeps them.
      latestNodes.current = ensureUids(loaded.nodes ?? []);
      setNodes(latestNodes.current);
      setLoadError(null);
    },
    [id],
  );

  useEffect(() => {
    let alive = true;
    const gen = ++generation.current;

    // Another document in the same editor: nothing of the last one carries over (its tree, undo steps, verdicts).
    if (loadedId.current !== null && loadedId.current !== id) {
      latestNodes.current = [];
      setNodes([]);
      setHost(null);
      setLoading(true);
      setLoadError(null);
      markDirty(false);
      setConflict(null);
      setScan(null);
      setPlaceholdersLeft(null);
      setPending(null);
      clearHistory();
      resetPreview();
    }
    loadedId.current = id;

    loadDocument()
      .then((loaded) => alive && gen === generation.current && take(loaded))
      .catch((err) => {
        if (!alive) return;
        setLoadError(err);
        sayRef.current.error(err);
      })
      .finally(() => alive && setLoading(false));
    // The components menu loads independently: the editor works whether or not the host has any.
    adapter.components?.partials().then((p) => alive && setPartials(p)).catch((err) => sayRef.current.error(err));
    adapter.components?.library().then((c) => alive && setStudioComponents(c)).catch((err) => sayRef.current.error(err));

    return () => {
      alive = false;
    };
  }, [adapter, id, loadDocument, take, markDirty, clearHistory, resetPreview]);

  const persist = useCallback(
    (forId: string, next: PmlNode[]): Promise<boolean> => {
      const gen = generation.current;
      const run = saveChain.current.then(async () => {
        const revision = revisions.current.get(forId);

        // Never save a document this editor could not load, nor a tree the author has since replaced.
        if (revision === undefined || gen !== generation.current) return false;
        setSaving(true);

        try {
          const saved = await adapter.saveDraft(forId, { nodes: next }, revision, editorSession);
          const current = gen === generation.current;

          // Someone else saved since: ask, never overwrite silently. The work is still here, unsaved.
          if (isConflict(saved)) {
            if (current) {
              setConflict({ revision: saved.conflict.revision ?? revision });
              markDirty(true);
            }

            return false;
          }

          revisions.current.set(forId, saved.revision || revision);

          if (current) {
            setConflict(null);
            // Nothing is waiting only when what was stored is still what is on screen.
            markDirty(latestNodes.current !== next);
            // A publish verdict is about words that no longer exist once the draft changes.
            setScan(null);
            setPlaceholdersLeft(null);
          }

          return true;
        } catch (err) {
          if (gen === generation.current) markDirty(true);
          sayRef.current.error(err);

          return false;
        } finally {
          setSaving(false);
        }
      });

      saveChain.current = run.catch(() => undefined);

      return run;
    },
    [adapter, editorSession, markDirty],
  );

  /** "Keep mine": save this editor's draft over the newer one, now that the author has chosen to. */
  const keepMine = useCallback(() => {
    if (!conflict) return;
    revisions.current.set(id, conflict.revision);
    void persist(id, latestNodes.current);
  }, [conflict, persist, id]);

  /** Replace the tree on screen with the saved one: nothing waiting is sent, and undo cannot bring the old one back. */
  const replaceFromSaved = useCallback(
    async (gen: number): Promise<void> => {
      const loaded = await loadDocument();
      if (gen !== generation.current) return;
      take(loaded);
      clearHistory();
      setConflict(null);
      markDirty(false);
    },
    [loadDocument, take, clearHistory, markDirty],
  );

  /** "Load the latest": drop this editor's unsaved draft and show what was saved elsewhere. */
  const loadLatest = useCallback(async () => {
    cancelWaitingSave();

    try {
      await replaceFromSaved(++generation.current);
    } catch (err) {
      sayRef.current.error(err);
    }
  }, [cancelWaitingSave, replaceFromSaved]);

  /** Try the load again after it failed (the host shows `loadError` with a Retry). */
  const reload = useCallback(() => {
    cancelWaitingSave();
    const gen = ++generation.current;
    setLoading(true);
    setLoadError(null);

    replaceFromSaved(gen)
      .catch((err) => {
        if (gen !== generation.current) return;
        setLoadError(err);
        sayRef.current.error(err);
      })
      .finally(() => gen === generation.current && setLoading(false));
  }, [cancelWaitingSave, replaceFromSaved]);

  /** Show a tree and save it shortly after: the one way every change, undo and redo lands. */
  const show = useCallback(
    (incoming: PmlNode[]) => {
      const next = ensureUids(incoming);

      latestNodes.current = next;
      setNodes(next);
      markDirty(true);

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void persist(id, next);
      }, 900);
    },
    [persist, id, markDirty],
  );

  const change = useCallback(
    (next: PmlNode[]) => {
      history.record(latestNodes.current);
      show(next);
    },
    [history, show],
  );

  const undoEdit = useCallback(() => {
    const previous = history.undo(latestNodes.current);
    if (previous) show(previous);
  }, [history, show]);

  const redoEdit = useCallback(() => {
    const next = history.redo(latestNodes.current);
    if (next) show(next);
  }, [history, show]);

  useEffect(() => {
    return () => {
      // Leaving (or switching documents) with a save still waiting SENDS it, after any save already on its way, from
      // the revision that one returns. The editor is gone, so a conflict cannot be offered: say what happened instead.
      if (!saveTimer.current) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
      const leaving = latestNodes.current;

      saveChain.current = saveChain.current.then(async () => {
        const revision = revisions.current.get(id);
        if (revision === undefined) return;

        try {
          const saved = await adapter.saveDraft(id, { nodes: leaving }, revision, editorSession);

          if (isConflict(saved)) {
            sayRef.current.error(`Your last change to this ${noun} was not saved: it was changed somewhere else just before you left. Open it again to see the newer version and redo the change.`);
          } else {
            revisions.current.set(id, saved.revision || revision);
          }
        } catch (err) {
          sayRef.current.error(err);
        }
      });
    };
  }, [adapter, id, editorSession, noun]);

  // Closing or reloading the tab runs no React cleanup, so a change not yet stored would vanish: the browser asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warn);

    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // The pending proposal's own compile, stored WITH the proposal so a discarded one never shows a stale render.
  useEffect(() => {
    if (!pending) return;
    let alive = true;

    adapter
      .preview(id, pending.nodes)
      .then((result) => {
        if (alive && !result.error) setPendingCompiled({ for: pending, tree: result.tree });
      })
      .catch((err) => sayRef.current.error(err));

    return () => {
      alive = false;
    };
  }, [adapter, pending, id]);

  /** Send a waiting save now. False when it was refused (a conflict, the host's gate, no loaded revision): not stored. */
  // Reads refs, not this render's state: a caller that changed the design a moment ago holds a flush from before it.
  const flush = async (): Promise<boolean> => {
    const waiting = saveTimer.current !== null;
    cancelWaitingSave();

    return waiting || dirtyRef.current ? persist(id, latestNodes.current) : true;
  };

  /** The host's object as it now is; without `refreshHost`, the one already held. */
  const refresh = async (): Promise<H | null> => {
    if (!options.refreshHost) return host;
    const next = await options.refreshHost(id);
    setHost(next);

    return next;
  };

  const check = async () => {
    await flush();

    try {
      setScan(await adapter.preflight(id));
    } catch (err) {
      say.error(err);
    }
  };

  const publish = async () => {
    // A document with no publish step has nothing to do here; its editor never offers the action.
    if (!adapter.publish) return;
    // Never publish past a refused save, and send the revision on screen so a newer draft is refused, not published.
    if (!(await flush())) return;
    const revision = revisions.current.get(id);
    if (revision === undefined) return;
    setPublishing(true);

    try {
      const result = await adapter.publish(id, revision, { session: editorSession });

      if (isConflict(result)) {
        setConflict({ revision: result.conflict.revision ?? revision });
      } else if (isRefused(result)) {
        setScan(result.refused);
      } else if (isPlaceholders(result)) {
        const { message, ...left } = result.placeholders;
        setPlaceholdersLeft({ message, left });
      } else if ('published' in result) {
        const published = await refresh();
        setScan(null);
        setPlaceholdersLeft(null);
        options.onPublished?.(published);

        if (result.warning) say.warning(options.publishedWarning ?? 'Published. Your changes are saved, but they may take up to an hour to show everywhere.');
        else say.success(options.publishedMessage ?? `Your ${noun} is live.`);
      }
    } catch (err) {
      say.error(err);
    } finally {
      setPublishing(false);
    }
  };

  const undo = async () => {
    if (!adapter.rollback) return;

    try {
      await adapter.rollback(id);
      await refresh();
      say.success(options.rolledBackMessage ?? 'The previous version is live again.');
    } catch (err) {
      say.error(err);
    }
  };

  /** A signed, 24-hour, never-indexed link to the current draft, copied for sharing. */
  const copyPreviewLink = async () => {
    if (!adapter.previewUrl) return;
    await flush();

    try {
      const url = await adapter.previewUrl(id);
      await navigator.clipboard.writeText(url);
      say.success('Preview link copied. It works for 24 hours and never appears in search engines.');
    } catch (err) {
      say.error(err instanceof Error ? err : 'The preview link could not be copied.');
    }
  };

  return {
    host,
    setHost,
    /** This editor's name on every save and publish, so its own earlier saves never count as someone else's. */
    session: editorSession,
    /** Whether this document has a publish step. An email's design may not. */
    canPublish: Boolean(adapter.publish),
    /** Whether the live version can be rolled back to the previous one. */
    canRollback: Boolean(adapter.rollback),
    /** Whether a shareable preview link can be made. */
    canPreviewLink: Boolean(adapter.previewUrl),
    nodes,
    partials,
    studioComponents,
    compiled: preview.compiled,
    natives: preview.natives,
    previewError: preview.previewError,
    loading,
    /** Why the document could not be opened; while set nothing is saved (show it with a Retry calling `reload`). */
    loadError,
    reload,
    saving,
    dirty,
    publishing,
    scan,
    placeholdersLeft,
    pending,
    setPending,
    pendingCompiled: pending && pendingCompiled?.for === pending ? pendingCompiled.tree : null,
    change,
    flush,
    check,
    publish,
    undo,
    copyPreviewLink,
    undoEdit,
    redoEdit,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    conflict,
    keepMine,
    loadLatest,
  };
}
