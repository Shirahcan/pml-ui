'use client';

import React, { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Plus, Redo2, Send, ShieldCheck, Undo2 } from 'lucide-react';

import { getNodeAtPath, moveTopLevel, PML_CATALOG_BY_NAME, removeNodeAtPath, updateNodeAtPath, type PmlNode } from '../../language';
import type { EditableDocumentAdapter } from '../document';
import type { PmlSite } from '../../renderer/PmlRenderer';
import { Button } from '../ui/controls';
import { useOwnVars } from '../ui/theme';
import { CatalogProvider } from './catalog';
import { DraftConflictDialog } from './DraftConflictDialog';
import { EmailAsSent, type RenderedEmail } from './EmailAsSent';
import { EmailInbox } from './emailInbox';
import { FindingsPanel } from './FindingsPanel';
import { PmlAddSectionDialog } from './PmlAddSectionDialog';
import { PmlCanvas, type CanvasFrame } from './PmlCanvas';
import { PmlSettings } from './PmlSettings';
import { EditorSurfaceProvider } from './surface';
import { useDocumentEditor } from './useDocumentEditor';

/** What the host may place in its own chrome (a top bar) instead of the editor's header. */
export interface EmailEditorControls {
  tab: 'design' | 'sent';
  setTab: (tab: 'design' | 'sent') => void;
  saving: boolean;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  check: () => void;
  /** "Save for everyone": present when the host has a publish step; refused (with the findings shown) while checks block. */
  publish?: () => void;
  publishing: boolean;
}

export interface EmailEditorProps {
  adapter: EditableDocumentAdapter;
  id: string;
  /** The elements an email may hold (the server's email profile: one authority). Everything else is off the menu. */
  allowedElements: readonly string[];
  /** The email as the host sends it (its delivery HTML and plain text), for the saved draft. */
  renderAsSent: (id: string) => Promise<RenderedEmail>;
  frame?: CanvasFrame;
  site?: PmlSite;
  /** Given, the host draws the controls (tabs, undo, check, save) in its own chrome; otherwise a header does. */
  renderControls?: (controls: EmailEditorControls) => ReactNode;
  /** A host's note above the email (e.g. "this email has no design yet, so it still sends as written"). */
  notice?: ReactNode;
  /** After "Save for everyone" lands. */
  onPublished?: () => void;
}

const NO_SITE: PmlSite = {};

/** The standard header and footer parts' roots: in the email profile, but never something an author adds to a body. */
const CHROME_ROOTS = ['header', 'footer'];

/**
 * The email editor (pml-email C1a/C2b), the shared builder composed for an email: the inbox frame (subject, preview
 * text, the standard header and footer), a 600px canvas holding only email elements, the settings rail for what is
 * selected, the email's checks, and the email exactly as sent (light, dark, plain text). Edits autosave to the host's
 * DRAFT; "Save for everyone" (the adapter's publish) is the one act that changes what sends. Mount it with
 * `key={id}`, so switching emails starts a fresh editor.
 */
export function EmailEditor({ adapter, id, allowedElements, renderAsSent, frame, site = NO_SITE, renderControls, notice, onPublished }: EmailEditorProps): React.JSX.Element {
  const editor = useDocumentEditor(adapter, id, {
    noun: 'email',
    publishedMessage: 'Saved for everyone. The next email sent uses this version.',
    onPublished: () => onPublished?.(),
  });
  const vars = useOwnVars();
  const [tab, setTab] = useState<'design' | 'sent'>('design');
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [sentVersion, setSentVersion] = useState(0);
  const [sentStale, setSentStale] = useState(false);
  const fieldWrites = useRef(new Set<Promise<unknown>>());
  const { nodes, change } = editor;

  // `header` and `footer` are the standard chrome's roots (added to every email at send time), never body blocks.
  const unavailable = useMemo(
    () => Object.keys(PML_CATALOG_BY_NAME).filter((name) => !allowedElements.includes(name) || CHROME_ROOTS.includes(name)),
    [allowedElements],
  );
  const selected = selectedPath ? getNodeAtPath(nodes, selectedPath) : null;

  const track = useCallback((write: Promise<unknown>) => {
    fieldWrites.current.add(write);
    void write.finally(() => fieldWrites.current.delete(write));
  }, []);

  const showTab = useCallback(
    (next: 'design' | 'sent') => {
      if (next === 'sent') {
        // "As sent" draws the SAVED draft: send a waiting design save and every field write first.
        void Promise.all([editor.flush(), ...fieldWrites.current]).then(([saved]) => {
          setSentStale(saved === false);
          setSentVersion((v) => v + 1);
        });
      }
      setTab(next);
    },
    [editor],
  );

  const render = useCallback(() => renderAsSent(id), [renderAsSent, id]);

  const controls: EmailEditorControls = {
    tab,
    setTab: showTab,
    saving: editor.saving,
    dirty: editor.dirty,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    undo: editor.undoEdit,
    redo: editor.redoEdit,
    check: () => void editor.check(),
    publish: editor.canPublish
      ? () => {
          // Field writes are part of what is saved for everyone: let them land first.
          void Promise.all([...fieldWrites.current]).then(() => editor.publish());
        }
      : undefined,
    publishing: editor.publishing,
  };

  if (editor.loading) {
    return <p className="py-16 text-center text-sm text-[var(--pb-muted)]" style={vars}>Opening the email...</p>;
  }

  if (editor.loadError) {
    return (
      <div role="alert" className="mx-auto max-w-md space-y-3 py-16 text-center text-sm text-[var(--pb-text)]" style={vars}>
        <p>This email could not be opened, so nothing here can be edited yet.</p>
        <Button variant="outline" onClick={() => editor.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <EditorSurfaceProvider surface="email">
    <CatalogProvider components={editor.studioComponents} partials={editor.partials}>
      <div className="space-y-4 text-[var(--pb-text)]" style={vars}>
        {renderControls ? renderControls(controls) : <EmailEditorHeader controls={controls} />}
        {notice}

        {tab === 'sent' ? (
          <EmailAsSent render={render} version={sentVersion} stale={sentStale} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="mx-auto w-full max-w-[600px]">
              {adapter.fields ? <EmailInbox id={id} fields={adapter.fields} session={editor.session} track={track} /> : null}
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
                Add a block
              </Button>
            </div>

            <aside aria-label={selected ? 'Selected block' : 'Email checks'} className="space-y-3">
              {selected && selectedPath ? (
                <PmlSettings
                  node={selected}
                  deleteLabel="Delete block"
                  onChange={(next) => change(updateNodeAtPath(nodes, selectedPath, next))}
                  onDelete={() => {
                    change(removeNodeAtPath(nodes, selectedPath));
                    setSelectedPath(null);
                  }}
                />
              ) : editor.scan ? (
                <FindingsPanel preflight={editor.scan} words={{ clean: 'Nothing here needs to change. Ready to save for everyone.' }} />
              ) : (
                <p className="text-sm text-[var(--pb-muted)]">
                  Select a block to change it. Your changes are kept as a draft; nobody receives them until you save them for everyone.
                </p>
              )}
            </aside>
          </div>
        )}

        <PmlAddSectionDialog
          open={adding}
          onOpenChange={setAdding}
          existing={nodes}
          onAdd={(node: PmlNode) => change([...nodes, node])}
          unavailable={unavailable}
          title="Add a block"
          description="Only what an email can hold: words, headings, buttons, pictures, notes, tables and dividers."
        />
        <DraftConflictDialog open={editor.conflict !== null} noun="email" onKeepMine={editor.keepMine} onLoadLatest={() => void editor.loadLatest()} />
      </div>
    </CatalogProvider>
    </EditorSurfaceProvider>
  );
}

/** The editor's own header when the host does not draw the controls in its chrome. */
function EmailEditorHeader({ controls }: { controls: EmailEditorControls }): React.JSX.Element {
  const status = controls.saving ? 'Saving draft' : controls.dirty ? 'Unsaved changes' : 'Draft saved';

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div role="tablist" aria-label="Email views" className="flex gap-2">
        {(['design', 'sent'] as const).map((t) => (
          <Button key={t} role="tab" aria-selected={controls.tab === t} size="sm" variant={controls.tab === t ? 'primary' : 'outline'} onClick={() => controls.setTab(t)}>
            {t === 'design' ? 'Design' : 'As sent'}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
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
        {controls.publish ? (
          <Button size="sm" onClick={controls.publish} disabled={controls.publishing}>
            <Send />
            {controls.publishing ? 'Saving for everyone' : 'Save for everyone'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
