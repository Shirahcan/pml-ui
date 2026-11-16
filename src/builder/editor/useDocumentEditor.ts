'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { ensureUids, type PmlNativesPayload, type PmlNode } from '../../language';
import type { DocumentLibraryComponent, DocumentPartial } from '../components';
import { isConflict, isPlaceholders, isRefused, type DocumentAdapter, type DocumentPlaceholders, type DocumentPreflight } from '../document';
import { useBuilderHost } from './host';
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
  onPublished?: (host: H | null) => void;
  /** Override the host context's messages (a hook used outside the editor's BuilderHostProvider). */
  onSuccess?: (message: string) => void;
  onWarning?: (message: string) => void;
  onError?: (error: unknown) => void;
  /** What the document is called in messages ("page", "email"), and what a successful publish says. */
  noun?: string;
  publishedMessage?: string;
}

/**
 * The visual editor's state and actions for any document kind (shared program E4a4i, from Portify's page editor).
 * Drafts autosave (an editor that needs a Save button is one people lose work in); the canvas shows the host's
 * COMPILED preview and keeps the last good one while an edit is transiently invalid; publishing is a separate act and
 * the only moment a check can refuse. No silent overwrite: a save from a revision someone else replaced is a conflict
 * the author decides. Pass a STABLE adapter (memoised): a new one each render reloads the document each render.
 */
export function useDocumentEditor<H = unknown>(adapter: DocumentAdapter, id: string, options: DocumentEditorOptions<H> = {}) {
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
  // The COMPILED tree from the host; compiled[i] is the rendered form of nodes[i].
  const [compiled, setCompiled] = useState<PmlNode[] | null>(null);
  const [natives, setNatives] = useState<PmlNativesPayload | null>(null);
  const [previewError, setPreviewError] = useState<{ message: string; path: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scan, setScan] = useState<DocumentPreflight | null>(null);
  const [placeholdersLeft, setPlaceholdersLeft] = useState<{ message: string; left: Omit<DocumentPlaceholders, 'message'> } | null>(null);
  const [pending, setPending] = useState<PendingProposal | null>(null);
  const [pendingCompiled, setPendingCompiled] = useState<{ for: PendingProposal; tree: PmlNode[] } | null>(null);

  const history = useEditHistory();
  const latestNodes = useRef<PmlNode[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editorSession] = useState(() => crypto.randomUUID());
  const revision = useRef<string | undefined>(undefined);
  const [conflict, setConflict] = useState<{ revision: string } | null>(null);

  const loadDocument = useCallback(async (): Promise<LoadedDocument<H>> => {
    if (loadRef.current) return loadRef.current(id);
    const loaded = await adapter.load(id);

    return { nodes: loaded.document.nodes, revision: loaded.revision, host: null };
  }, [adapter, id]);

  const take = useCallback((loaded: LoadedDocument<H>) => {
    setHost(loaded.host);
    revision.current = loaded.revision;
    // Every element gets its permanent id on first load; autosave then keeps them.
    latestNodes.current = ensureUids(loaded.nodes ?? []);
    setNodes(latestNodes.current);
  }, []);

  useEffect(() => {
    let alive = true;

    loadDocument()
      .then((loaded) => alive && take(loaded))
      .catch((err) => sayRef.current.error(err))
      .finally(() => alive && setLoading(false));
    // The components menu loads independently: the editor works whether or not the host has any.
    adapter.components?.partials().then((p) => alive && setPartials(p)).catch((err) => sayRef.current.error(err));
    adapter.components?.library().then((c) => alive && setStudioComponents(c)).catch((err) => sayRef.current.error(err));

    return () => {
      alive = false;
    };
  }, [adapter, loadDocument, take]);

  const persist = useCallback(
    async (next: PmlNode[]): Promise<boolean> => {
      setSaving(true);

      try {
        const saved = await adapter.saveDraft(id, { nodes: next }, revision.current ?? '', editorSession);

        // Someone else saved since: ask, never overwrite silently. `dirty` stays true: the work is still here, unsaved.
        if (isConflict(saved)) {
          setConflict({ revision: saved.conflict.revision ?? revision.current ?? '' });

          return false;
        }

        revision.current = saved.revision || revision.current;
        setConflict(null);
        setDirty(false);
        // A publish verdict is about words that no longer exist once the draft changes.
        setScan(null);
        setPlaceholdersLeft(null);

        return true;
      } catch (err) {
        sayRef.current.error(err);

        return false;
      } finally {
        setSaving(false);
      }
    },
    [adapter, id, editorSession],
  );

  /** "Keep mine": save this editor's draft over the newer one, now that the author has chosen to. */
  const keepMine = useCallback(() => {
    if (!conflict) return;
    revision.current = conflict.revision;
    void persist(latestNodes.current);
  }, [conflict, persist]);

  /** "Load the latest": drop this editor's unsaved draft and show what was saved elsewhere. */
  const loadLatest = useCallback(async () => {
    try {
      take(await loadDocument());
      setConflict(null);
      setDirty(false);
    } catch (err) {
      sayRef.current.error(err);
    }
  }, [loadDocument, take]);

  /** Show a tree and save it shortly after: the one way every change, undo and redo lands. */
  const show = useCallback(
    (incoming: PmlNode[]) => {
      const next = ensureUids(incoming);

      latestNodes.current = next;
      setNodes(next);
      setDirty(true);

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        void persist(next);
      }, 900);
    },
    [persist],
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
      if (previewTimer.current) clearTimeout(previewTimer.current);

      // Leaving with a save still waiting SENDS it (with its revision and session, so it never silently replaces a
      // newer draft). The editor is gone, so a conflict cannot be offered: say what happened instead.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void adapter
          .saveDraft(id, { nodes: latestNodes.current }, revision.current ?? '', editorSession)
          .then((saved) => {
            if (isConflict(saved)) {
              sayRef.current.error(`Your last change to this ${noun} was not saved: it was changed somewhere else just before you left. Open it again to see the newer version and redo the change.`);
            }
          })
          .catch((err) => sayRef.current.error(err));
      }
    };
  }, [adapter, id, editorSession, noun]);

  // The live compiled preview, debounced. A transiently invalid edit KEEPS the last good compile and shows the banner.
  useEffect(() => {
    if (loading) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);

    previewTimer.current = setTimeout(() => {
      adapter
        .preview(id, nodes)
        .then((result) => {
          if (result.error) {
            setPreviewError(result.error);
          } else {
            setCompiled(result.tree);
            setNatives(result.natives);
            setPreviewError(null);
          }
        })
        .catch((err) => sayRef.current.error(err));
    }, 500);
  }, [adapter, nodes, loading, id]);

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

  /** Send a waiting save now. False when it was refused (a conflict, the host's gate): the work is not stored. */
  // Reads the refs `show()` sets synchronously, not this render's state: a caller that changed the design a moment ago
  // holds a flush from the render before it.
  const flush = async (): Promise<boolean> => {
    const waiting = saveTimer.current !== null;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;

    return waiting || dirty ? persist(latestNodes.current) : true;
  };

  const refresh = async () => {
    if (options.refreshHost) setHost(await options.refreshHost(id));
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
    // Never publish past a refused save, and send the revision on screen so a newer draft is refused, not published.
    if (!(await flush())) return;
    setPublishing(true);

    try {
      const result = await adapter.publish(id, revision.current ?? '', { session: editorSession });

      if (isConflict(result)) {
        setConflict({ revision: result.conflict.revision ?? revision.current ?? '' });
      } else if (isRefused(result)) {
        setScan(result.refused);
      } else if (isPlaceholders(result)) {
        const { message, ...left } = result.placeholders;
        setPlaceholdersLeft({ message, left });
      } else if ('published' in result) {
        await refresh();
        setScan(null);
        setPlaceholdersLeft(null);
        options.onPublished?.(host);

        if (result.warning) say.warning(`Published. Your changes are saved but may take up to an hour to appear for visitors while the live site refreshes.`);
        else say.success(options.publishedMessage ?? `Your ${noun} is live.`);
      }
    } catch (err) {
      say.error(err);
    } finally {
      setPublishing(false);
    }
  };

  const undo = async () => {
    try {
      await adapter.rollback(id);
      await refresh();
      say.success('The previous version is live again.');
    } catch (err) {
      say.error(err);
    }
  };

  /** A signed, 24-hour, never-indexed link to the current draft, copied for sharing. */
  const copyPreviewLink = async () => {
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
    nodes,
    partials,
    studioComponents,
    compiled,
    natives,
    previewError,
    loading,
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
