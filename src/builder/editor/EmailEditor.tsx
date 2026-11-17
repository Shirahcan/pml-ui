'use client';

import React, { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Plus, Redo2, ShieldCheck, Undo2 } from 'lucide-react';

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
}

export interface EmailEditorProps {
  adapter: EditableDocumentAdapter;
  id: string;
  /** The elements an email may hold (the server's email profile: one authority). Everything else is off the menu. */
  allowedElements: readonly string[];
  /** The SAVED email as the host sends it (its delivery HTML and plain text). */
  renderAsSent: (id: string) => Promise<RenderedEmail>;
  frame?: CanvasFrame;
  site?: PmlSite;
  /** Given, the host draws the controls (tabs, undo, check, save state) in its own chrome; otherwise a header does. */
  renderControls?: (controls: EmailEditorControls) => ReactNode;
  /** A host's note above the email (e.g. "this email has no design yet, so it still sends as written"). */
  notice?: ReactNode;
}

const NO_SITE: PmlSite = {};

/**
 * The email editor (pml-email C1a), the shared builder composed for an email: the inbox frame (subject, preview text,
 * the standard header and footer), a 600px canvas holding only email elements, the settings rail for what is
 * selected, the email's checks, and the email exactly as sent (light, dark, plain text). Saving IS the change, so
 * there is no publish here; the host decides what a saved design does.
 */
export function EmailEditor({ adapter, id, allowedElements, renderAsSent, frame, site = NO_SITE, renderControls, notice }: EmailEditorProps): React.JSX.Element {
  const editor = useDocumentEditor(adapter, id, { noun: 'email' });
  const vars = useOwnVars();
  const [tab, setTab] = useState<'design' | 'sent'>('design');
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [sentVersion, setSentVersion] = useState(0);
  const [session] = useState(() => crypto.randomUUID());
  const { nodes, change } = editor;

  const unavailable = useMemo(() => Object.keys(PML_CATALOG_BY_NAME).filter((name) => !allowedElements.includes(name)), [allowedElements]);
  const selected = selectedPath ? getNodeAtPath(nodes, selectedPath) : null;

  const showTab = useCallback(
    (next: 'design' | 'sent') => {
      if (next === 'sent') {
        // The preview is of the SAVED email: send a waiting save first, then draw.
        void editor.flush().then(() => setSentVersion((v) => v + 1));
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
  };

  if (editor.loading) {
    return <p className="py-16 text-center text-sm text-[var(--pb-muted)]" style={vars}>Opening the email...</p>;
  }

  return (
    <CatalogProvider components={editor.studioComponents} partials={editor.partials}>
      <div className="space-y-4 text-[var(--pb-text)]" style={vars}>
        {renderControls ? renderControls(controls) : <EmailEditorHeader controls={controls} />}
        {notice}

        {tab === 'sent' ? (
          <EmailAsSent render={render} version={sentVersion} />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="mx-auto w-full max-w-[600px]">
              {adapter.fields ? <EmailInbox id={id} fields={adapter.fields} session={session} /> : null}
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
                  onChange={(next) => change(updateNodeAtPath(nodes, selectedPath, next))}
                  onDelete={() => {
                    change(removeNodeAtPath(nodes, selectedPath));
                    setSelectedPath(null);
                  }}
                />
              ) : editor.scan ? (
                <FindingsPanel preflight={editor.scan} words={{ clean: 'Nothing here needs to change. Ready to send.' }} />
              ) : (
                <p className="text-sm text-[var(--pb-muted)]">Select a block to change it, or run the checks before you save it for everyone.</p>
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
  );
}

/** The editor's own header when the host does not draw the controls in its chrome. */
function EmailEditorHeader({ controls }: { controls: EmailEditorControls }): React.JSX.Element {
  const status = controls.saving ? 'Saving' : controls.dirty ? 'Unsaved changes' : 'Saved';

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
        <span className="text-xs text-[var(--pb-muted)]">{status}</span>
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
      </div>
    </div>
  );
}
