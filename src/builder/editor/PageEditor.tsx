'use client';

import React, { useEffect, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';

import { getNodeAtPath, moveTopLevel, removeNodeAtPath, updateNodeAtPath, type PmlNode } from '../../language';
import { fieldGroupsOf, type DocumentFieldGroup, type EditableDocumentAdapter } from '../document';
import type { PmlSite } from '../../renderer/PmlRenderer';
import { Button } from '../ui/controls';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/overlays';
import { useOwnVars } from '../ui/theme';
import { CatalogProvider } from './catalog';
import { DocumentFieldsPanel } from './DocumentFieldsPanel';
import { useBuilderHost } from './host';
import { EditorNounProvider } from './surface';
import { DraftConflictDialog } from './DraftConflictDialog';
import { FindingsPanel } from './FindingsPanel';
import { PageEditorHeader } from './PageEditorHeader';
import { PageLayers } from './PageLayers';
import { PlaceholdersLeftNotice } from './PlaceholdersLeftNotice';
import { PmlAddSectionDialog } from './PmlAddSectionDialog';
import { PmlCanvas, type CanvasFrame } from './PmlCanvas';
import { PmlCodePane } from './PmlCodePane';
import { PmlSettings } from './PmlSettings';
import { SlidePanel } from './SlidePanel';
import { useDocumentEditor } from './useDocumentEditor';
import { useQuickEditSelection } from './useQuickEditSelection';

/** What the host may draw in its own chrome (a top bar) instead of the editor's header. */
export interface PageEditorControls {
  saving: boolean;
  dirty: boolean;
  publishing: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  check: () => void;
  publish: () => void;
  /** Throw away the draft (the adapter's rollback); absent when the document has none. Confirm before calling it. */
  rollback?: () => void;
  /** Copy a shareable preview link; absent when the document has none. */
  copyPreviewLink?: () => void;
  /** Which view shows: the design or its code; `toggleCode` is absent when the document has no code port. */
  view: 'design' | 'code';
  toggleCode?: () => void;
  /** Slide a panel in over the canvas (the design never narrows): the document's details, its layers, its checks. */
  openPanel: (panel: PageEditorPanel) => void;
  /** Whether the document has details to show (a fields port, or the host's `aside`). */
  hasDetails: boolean;
  /**
   * The document's field groups, in order (designer sole surface P2a): one slide-in panel each, opened with
   * `openPanel(\`group:${key}\`)`. Empty when its fields have no groups (then `'details'` shows them all).
   */
  fieldGroups: DocumentFieldGroup[];
  /** Take the document off the public site (the adapter's unpublish); absent unless it is live. Confirms first. */
  unpublish?: () => void;
  /**
   * Send a waiting save now; true once the document is saved (a host panel that reads the SAVED document, such as a
   * writing check, calls it first and stops on false).
   */
  flush: () => Promise<boolean>;
  /** The host's own panels (`panels` prop), opened with `openPanel(\`host:${key}\`)`. */
  hostPanels: { key: string; title: string }[];
}

/** A panel the host adds (help from the assistant, a share card): it slides in over the canvas like every other. */
export interface PageEditorHostPanel {
  key: string;
  title: string;
  render: (controls: PageEditorControls) => ReactNode;
}

/**
 * The panels a host can open; the selected section's settings open on their own when a section is selected.
 * `group:{key}` is one field group's panel; `'details'` opens the first group when there are groups.
 */
export type PageEditorPanel = 'details' | 'layers' | 'checks' | `group:${string}` | `host:${string}`;

/** The words a host gives the editor, so it never calls a post a "page". */
export interface PageEditorLabels {
  noun?: string;
  publishedMessage?: string;
  publishedWarning?: string;
  rolledBackMessage?: string;
  /** The add button and dialog title ("Add a section"). */
  add?: string;
  /** The confirm for a rollback. */
  rollbackTitle?: string;
  rollbackDescription?: string;
  /** The confirm for an unpublish, and what shows once it is done. */
  unpublishTitle?: string;
  unpublishDescription?: string;
  unpublishedMessage?: string;
}

export interface PageEditorProps {
  adapter: EditableDocumentAdapter;
  id: string;
  site?: PmlSite;
  frame?: CanvasFrame;
  /** Elements this document may not hold (the host's profile); everything else is on the add menu. */
  unavailable?: readonly string[];
  /** Given, the host draws the controls (undo, check, publish...) in its own chrome; otherwise a header does. */
  renderControls?: (controls: PageEditorControls) => ReactNode;
  /** A host's note above the canvas. */
  notice?: ReactNode;
  labels?: PageEditorLabels;
  /** After a publish lands. */
  onPublished?: () => void;
  /** Whether readers see the document now (the host knows from its load); with the adapter's `unpublish`, offers it. */
  live?: boolean;
  /** After an unpublish lands (reload the host's view of the document). */
  onUnpublished?: () => void;
  /** The host's own slide-in panels, after the editor's (owner 2026-11-17: every option in a panel over the design). */
  panels?: PageEditorHostPanel[];
  /**
   * Quick edits (owner 2026-11-16): a double-click edits words in place with the settings closed. The host decides,
   * usually from its gate. Pictures pick from the host's `MediaSourceProvider` when one wraps the editor (a post's
   * cover and images come from the PRODUCT's library); without one an image is an address field.
   */
  quickEdit?: boolean;
  /**
   * The host's console (S7c): drawn after the editor; the host mounts ai-ui's `ConsoleHost` here, which positions
   * itself (it overlays, it never shrinks the page), so pml-ui never imports ai-ui.
   */
  console?: ReactNode;
  /** The host's own panel, shown at the top of the Details panel (above the document's fields). */
  aside?: ReactNode;
}

const NO_SITE: PmlSite = {};

/**
 * The page editor (shared program E4a4i, blog-on-growth-service S7a): the shared builder composed for a page or a post
 * on any `EditableDocumentAdapter`. The canvas keeps its full width; everything else slides in over it from the right
 * (owner 2026-11-17: "the design area shouldn't be shrunken"): the selected section's settings (after the double-click
 * window), the document's details, its layers, its checks. Add a section, undo and redo, Publish, and, where the
 * document has them, Throw away the draft and a preview link. Edits autosave to the host's draft; Publish is the separate act. Mount it with
 * `key={id}` so switching documents starts a fresh editor.
 */
export function PageEditor({ adapter, id, site = NO_SITE, frame, unavailable = [], renderControls, notice, labels = {}, onPublished, live = false, onUnpublished, panels = [], quickEdit = false, console: consoleSlot, aside }: PageEditorProps): React.JSX.Element {
  const noun = labels.noun ?? 'page';
  const editor = useDocumentEditor(adapter, id, {
    noun,
    publishedMessage: labels.publishedMessage,
    publishedWarning: labels.publishedWarning,
    rolledBackMessage: labels.rolledBackMessage,
    onPublished: () => onPublished?.(),
  });
  const vars = useOwnVars();
  const { selectedPath, selectPath, settingsShown, onQuickEdit } = useQuickEditSelection(quickEdit);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<'design' | 'code'>('design');
  const code = adapter.code;
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const host = useBuilderHost();
  const { nodes, change } = editor;

  // The field groups, one slide-in panel each (owner 2026-11-17: every option in a panel over the design).
  const [fieldGroups, setFieldGroups] = useState<DocumentFieldGroup[]>([]);
  useEffect(() => {
    let alive = true;

    adapter.fields
      ?.describe(id)
      .then((list) => alive && setFieldGroups(fieldGroupsOf(list)))
      // The Details panel reports its own load failure when opened; here it only means no group menu yet.
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [adapter.fields, id]);
  const selected = selectedPath ? getNodeAtPath(nodes, selectedPath) : null;
  const addLabel = labels.add ?? 'Add a section';

  // The panel shows the selected section's settings once they are due (useQuickEditSelection), otherwise what the host
  // asked for, otherwise a refused publish's findings until they are dismissed. Derived, so nothing syncs in an effect.
  const [asked, setAsked] = useState<PageEditorPanel | null>(null);
  const [openKey, setOpenKey] = useState(0);
  const [dismissedScan, setDismissedScan] = useState<unknown>(null);
  const refused = editor.scan && !editor.scan.mayPublish && editor.scan !== dismissedScan ? 'checks' : null;
  const panel: 'selected' | PageEditorPanel | null = selected && selectedPath && settingsShown ? 'selected' : (asked ?? refused);
  const openPanel = (next: PageEditorPanel) => {
    setAsked(next === 'details' && fieldGroups.length > 0 ? `group:${fieldGroups[0].key}` : next);
    setOpenKey((k) => k + 1);
    selectPath(null);
  };
  const closePanel = () => {
    if (panel === 'selected') selectPath(null);
    if (panel === 'checks') setDismissedScan(editor.scan);
    setAsked(null);
  };
  const hasDetails = Boolean(adapter.fields || aside);

  const controls: PageEditorControls = {
    saving: editor.saving,
    dirty: editor.dirty,
    publishing: editor.publishing,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    undo: editor.undoEdit,
    redo: editor.redoEdit,
    check: () => {
      void editor.check();
      openPanel('checks');
    },
    publish: () => void editor.publish(),
    rollback: editor.canRollback ? () => setConfirmRollback(true) : undefined,
    copyPreviewLink: editor.canPreviewLink ? () => void editor.copyPreviewLink() : undefined,
    view,
    toggleCode: code
      ? () => {
          // The code view reads the SAVED document: send a waiting save first.
          if (view === 'design') void editor.flush().then(() => setView('code'));
          else setView('design');
        }
      : undefined,
    openPanel,
    hasDetails,
    fieldGroups,
    unpublish: adapter.unpublish && live ? () => setConfirmUnpublish(true) : undefined,
    flush: () => editor.flush(),
    hostPanels: panels.map(({ key, title }) => ({ key, title })),
  };
  const openHost = panel?.startsWith('host:') ? panels.find((hosted) => `host:${hosted.key}` === panel) ?? null : null;
  const openGroup = panel?.startsWith('group:') ? fieldGroups.find((group) => `group:${group.key}` === panel) ?? null : null;

  if (editor.loading) {
    return <p className="py-16 text-center text-sm text-[var(--pb-muted)]" style={vars}>Opening the {noun}...</p>;
  }

  if (editor.loadError) {
    return (
      <div role="alert" className="mx-auto max-w-md space-y-3 py-16 text-center text-sm text-[var(--pb-text)]" style={vars}>
        <p>This {noun} could not be opened, so nothing here can be edited yet.</p>
        <Button variant="outline" onClick={() => editor.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <EditorNounProvider noun={noun}>
    <CatalogProvider components={editor.studioComponents} partials={editor.partials}>
      <div className="space-y-4 text-[var(--pb-text)]" style={vars}>
        {renderControls ? renderControls(controls) : <PageEditorHeader controls={controls} />}
        {notice}
        {editor.placeholdersLeft ? <PlaceholdersLeftNotice message={editor.placeholdersLeft.message} left={editor.placeholdersLeft.left} /> : null}

        {view === 'code' && code ? (
          <PmlCodePane
            pageId={id}
            adapter={{ code, assistant: adapter.assistant }}
            onApply={(next) => {
              change(next);
              setView('design');
            }}
            onCancel={() => setView('design')}
          />
        ) : (
        <div className="min-w-0">
          <PmlCanvas
            nodes={nodes}
            compiled={editor.compiled}
            natives={editor.natives}
            site={site}
            frame={frame}
            selectedIndex={selectedPath ? selectedPath[0] : null}
            selectedPath={selectedPath}
            onSelectPath={selectPath}
            viewport="desktop"
            onSelect={(index) => selectPath(index === null ? null : [index])}
            onMove={(from, to) => change(moveTopLevel(nodes, from, to))}
            onDelete={(index) => {
              change(removeNodeAtPath(nodes, [index]));
              selectPath(null);
            }}
            onEditText={(path, field, value) => {
              const node = getNodeAtPath(nodes, path);
              if (node) change(updateNodeAtPath(nodes, path, { ...node, props: { ...(node.props ?? {}), [field]: value } }));
            }}
            quickEditAll={quickEdit}
            onQuickEdit={quickEdit ? onQuickEdit : undefined}
            // Rich words edited in place: the paragraph keeps its own shape, only its words change.
            onEditWords={(path, children) => {
              const node = getNodeAtPath(nodes, path);
              if (node) change(updateNodeAtPath(nodes, path, { ...node, children }));
            }}
          />
          {editor.previewError ? (
            <p role="status" className="mt-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {editor.previewError.message} The canvas shows the last version that worked.
            </p>
          ) : null}
          <Button variant="outline" className="mt-3 w-full border-dashed" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            {addLabel}
          </Button>
        </div>
        )}

        <SlidePanel
          open={panel !== null}
          openKey={openKey}
          onClose={closePanel}
          title={panel === 'selected' ? 'Section settings' : openHost ? openHost.title : openGroup ? openGroup.label : panel === 'details' ? 'Details' : panel === 'layers' ? 'Layers' : 'Checks'}
        >
          {panel === 'selected' && selected && selectedPath ? (
            <PmlSettings
              node={selected}
              onChange={(next) => change(updateNodeAtPath(nodes, selectedPath, next))}
              onDelete={() => {
                change(removeNodeAtPath(nodes, selectedPath));
                selectPath(null);
              }}
            />
          ) : openHost ? (
            openHost.render(controls)
          ) : openGroup ? (
            <div className="space-y-4">
              {/* The host's own panel heads the first group, as it heads Details. */}
              {openGroup.key === fieldGroups[0]?.key ? aside : null}
              {adapter.fields ? <DocumentFieldsPanel key={openGroup.key} id={id} fields={adapter.fields} session={editor.session} group={openGroup.key} label={openGroup.label} /> : null}
            </div>
          ) : panel === 'details' ? (
            <div className="space-y-4">
              {aside}
              {adapter.fields ? <DocumentFieldsPanel id={id} fields={adapter.fields} session={editor.session} /> : null}
            </div>
          ) : panel === 'layers' ? (
            <PageLayers
              nodes={nodes}
              selectedPath={selectedPath}
              onSelect={selectPath}
              onMoved={(moved) => {
                change(moved.nodes);
                selectPath(moved.path);
              }}
            />
          ) : panel === 'checks' ? (
            editor.scan ? (
              <FindingsPanel preflight={editor.scan} words={{ clean: 'Nothing here needs to change. Ready to publish.' }} />
            ) : (
              <p className="text-sm text-[var(--pb-muted)]">Running the checks...</p>
            )
          ) : null}
        </SlidePanel>
        <PmlAddSectionDialog
          open={adding}
          onOpenChange={setAdding}
          existing={nodes}
          onAdd={(node: PmlNode) => change([...nodes, node])}
          unavailable={[...unavailable]}
          title={addLabel}
        />
        {consoleSlot}
        <DraftConflictDialog open={editor.conflict !== null} noun={noun} onKeepMine={editor.keepMine} onLoadLatest={() => void editor.loadLatest()} />
        <AlertDialog open={confirmUnpublish} onOpenChange={setConfirmUnpublish}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{labels.unpublishTitle ?? `Take this ${noun} off the site?`}</AlertDialogTitle>
              <AlertDialogDescription>
                {labels.unpublishDescription ?? `Readers can no longer open it. Its design and details stay here, and you can publish it again at any time.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it live</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmUnpublish(false);
                  adapter
                    .unpublish?.(id)
                    .then(() => {
                      host.onSuccess(labels.unpublishedMessage ?? `The ${noun} is off the site.`);
                      onUnpublished?.();
                    })
                    .catch((error) => host.onError(error));
                }}
              >
                Unpublish
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={confirmRollback} onOpenChange={setConfirmRollback}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{labels.rollbackTitle ?? 'Throw away the draft?'}</AlertDialogTitle>
              <AlertDialogDescription>
                {labels.rollbackDescription ?? `Every change not yet published is thrown away, and the ${noun} goes back to its last published version.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep the draft</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmRollback(false);
                  selectPath(null);
                  void editor.undo();
                }}
              >
                Throw it away
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CatalogProvider>
    </EditorNounProvider>
  );
}
