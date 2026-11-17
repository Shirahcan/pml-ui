'use client';

import React, { useState, type ReactNode } from 'react';
import { Link2, Plus, Redo2, RotateCcw, Send, ShieldCheck, Undo2 } from 'lucide-react';

import { getNodeAtPath, moveTopLevel, removeNodeAtPath, updateNodeAtPath, type PmlNode } from '../../language';
import type { EditableDocumentAdapter } from '../document';
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
import { DraftConflictDialog } from './DraftConflictDialog';
import { FindingsPanel } from './FindingsPanel';
import { PageLayers } from './PageLayers';
import { PlaceholdersLeftNotice } from './PlaceholdersLeftNotice';
import { PmlAddSectionDialog } from './PmlAddSectionDialog';
import { PmlCanvas, type CanvasFrame } from './PmlCanvas';
import { PmlSettings } from './PmlSettings';
import { useDocumentEditor } from './useDocumentEditor';

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
}

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
}

const NO_SITE: PmlSite = {};

/**
 * The page editor (shared program E4a4i, blog-on-growth-service S7a): the shared builder composed for a page or a post
 * on any `EditableDocumentAdapter`. A canvas, the settings rail for the selected section and the page's layers when
 * nothing is selected, Add a section, undo and redo, the checks, Publish, and, where the document has them, Throw away
 * the draft and a preview link. Edits autosave to the host's draft; Publish is the separate act. Mount it with
 * `key={id}` so switching documents starts a fresh editor.
 */
export function PageEditor({ adapter, id, site = NO_SITE, frame, unavailable = [], renderControls, notice, labels = {}, onPublished }: PageEditorProps): React.JSX.Element {
  const noun = labels.noun ?? 'page';
  const editor = useDocumentEditor(adapter, id, {
    noun,
    publishedMessage: labels.publishedMessage,
    publishedWarning: labels.publishedWarning,
    rolledBackMessage: labels.rolledBackMessage,
    onPublished: () => onPublished?.(),
  });
  const vars = useOwnVars();
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState(false);
  const { nodes, change } = editor;
  const selected = selectedPath ? getNodeAtPath(nodes, selectedPath) : null;
  const addLabel = labels.add ?? 'Add a section';

  const controls: PageEditorControls = {
    saving: editor.saving,
    dirty: editor.dirty,
    publishing: editor.publishing,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    undo: editor.undoEdit,
    redo: editor.redoEdit,
    check: () => void editor.check(),
    publish: () => void editor.publish(),
    rollback: editor.canRollback ? () => setConfirmRollback(true) : undefined,
    copyPreviewLink: editor.canPreviewLink ? () => void editor.copyPreviewLink() : undefined,
  };

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
    <CatalogProvider components={editor.studioComponents} partials={editor.partials}>
      <div className="space-y-4 text-[var(--pb-text)]" style={vars}>
        {renderControls ? renderControls(controls) : <PageEditorHeader controls={controls} />}
        {notice}
        {editor.placeholdersLeft ? <PlaceholdersLeftNotice message={editor.placeholdersLeft.message} left={editor.placeholdersLeft.left} /> : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0">
            <PmlCanvas
              nodes={nodes}
              compiled={editor.compiled}
              natives={editor.natives}
              site={site}
              frame={frame}
              selectedIndex={selectedPath ? selectedPath[0] : null}
              selectedPath={selectedPath}
              onSelectPath={setSelectedPath}
              viewport="desktop"
              onSelect={(index) => setSelectedPath(index === null ? null : [index])}
              onMove={(from, to) => change(moveTopLevel(nodes, from, to))}
              onDelete={(index) => {
                change(removeNodeAtPath(nodes, [index]));
                setSelectedPath(null);
              }}
              onEditText={(path, field, value) => {
                const node = getNodeAtPath(nodes, path);
                if (node) change(updateNodeAtPath(nodes, path, { ...node, props: { ...(node.props ?? {}), [field]: value } }));
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

          <aside aria-label={selected ? 'Selected section' : 'Layers and checks'} className="space-y-3">
            {selected && selectedPath ? (
              <PmlSettings
                node={selected}
                onChange={(next) => change(updateNodeAtPath(nodes, selectedPath, next))}
                onDelete={() => {
                  change(removeNodeAtPath(nodes, selectedPath));
                  setSelectedPath(null);
                }}
              />
            ) : (
              <>
                {editor.scan ? <FindingsPanel preflight={editor.scan} words={{ clean: `Nothing here needs to change. Ready to publish.` }} /> : null}
                <PageLayers
                  nodes={nodes}
                  selectedPath={selectedPath}
                  onSelect={setSelectedPath}
                  onMoved={(moved) => {
                    change(moved.nodes);
                    setSelectedPath(moved.path);
                  }}
                />
              </>
            )}
          </aside>
        </div>

        <PmlAddSectionDialog
          open={adding}
          onOpenChange={setAdding}
          existing={nodes}
          onAdd={(node: PmlNode) => change([...nodes, node])}
          unavailable={[...unavailable]}
          title={addLabel}
        />
        <DraftConflictDialog open={editor.conflict !== null} noun={noun} onKeepMine={editor.keepMine} onLoadLatest={() => void editor.loadLatest()} />
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
                  setSelectedPath(null);
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
  );
}

/** The editor's own header when the host does not draw the controls in its chrome. */
function PageEditorHeader({ controls }: { controls: PageEditorControls }): React.JSX.Element {
  const status = controls.publishing ? 'Publishing' : controls.saving ? 'Saving draft' : controls.dirty ? 'Unsaved changes' : 'Draft up to date';

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-xs text-[var(--pb-muted)]" aria-live="polite">
        {status}
      </span>
      <Button size="icon" variant="ghost" aria-label="Undo" disabled={!controls.canUndo} onClick={controls.undo}>
        <Undo2 />
      </Button>
      <Button size="icon" variant="ghost" aria-label="Redo" disabled={!controls.canRedo} onClick={controls.redo}>
        <Redo2 />
      </Button>
      <Button size="sm" variant="outline" onClick={controls.check}>
        <ShieldCheck />
        Run the checks
      </Button>
      {controls.copyPreviewLink ? (
        <Button size="sm" variant="outline" onClick={controls.copyPreviewLink}>
          <Link2 />
          Copy preview link
        </Button>
      ) : null}
      {controls.rollback ? (
        <Button size="sm" variant="outline" onClick={controls.rollback}>
          <RotateCcw />
          Throw away the draft
        </Button>
      ) : null}
      <Button size="sm" onClick={controls.publish} disabled={controls.publishing}>
        <Send />
        Publish
      </Button>
    </div>
  );
}
