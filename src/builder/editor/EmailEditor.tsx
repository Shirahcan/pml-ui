'use client';

import React, { useEffect, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';

import { getNodeAtPath, moveTopLevel, removeNodeAtPath, updateNodeAtPath, type PmlNode, type StudioComment } from '../../language';
import { fieldGroupsOf, type DocumentFieldGroup, type EditableDocumentAdapter } from '../document';
import type { PmlSite } from '../../renderer/PmlRenderer';
import { Button } from '../ui/controls';
import { useOwnVars } from '../ui/theme';
import { CatalogProvider } from './catalog';
import { DocumentFieldsPanel } from './DocumentFieldsPanel';
import { DraftConflictDialog } from './DraftConflictDialog';
import type { RenderedEmail } from './EmailAsSent';
import { EMAIL_WORDS, EmailHeader, useEmailProfile } from '../studio/profiles/email';
import { FieldGroupPanel } from './FieldGroupPanel';
import { useBuilderHost } from './host';
import { FindingsPanel, type FindingsWords } from './FindingsPanel';
import { PmlAddSectionDialog } from './PmlAddSectionDialog';
import { PmlCanvas, type CanvasFrame } from './PmlCanvas';
import { PmlSettings } from './PmlSettings';
import { SlidePanel } from './SlidePanel';
import { FieldsEpochContext } from './fieldsEpoch';
import { EditorSurfaceProvider } from './surface';
import { useDocumentEditor } from './useDocumentEditor';
import { useQuickEditSelection } from './useQuickEditSelection';
import { useStudioComments, type CommentMenuItem } from './useStudioComments';

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
  /**
   * Slide a panel in over the email (the design never narrows), with the page editor's shapes so a host learns one API:
   * `'checks'`, `'details'` (the first field group when there are groups), `group:{key}`, `host:{key}`.
   */
  openPanel: (panel: EmailEditorPanel) => void;
  /** Whether the email has details to show in a panel (a fields port). */
  hasDetails: boolean;
  /** The email's field groups, in order: one slide-in panel each, opened with `openPanel(\`group:${key}\`)`. */
  fieldGroups: DocumentFieldGroup[];
  /** The host's own panels (`panels` prop), opened with `openPanel(\`host:${key}\`)`. */
  hostPanels: { key: string; title: string }[];
  /**
   * Send a waiting save and every field write now; true once the email is saved (a host panel that acts on the SAVED
   * email, such as sending a test, calls it first and stops on false).
   */
  flush: () => Promise<boolean>;
  /** "Hide comments (3)", "Show resolved (2)": for the host's menu; empty while the email has no comments. */
  commentMenu: CommentMenuItem[];
  /**
   * Replace the whole design in ONE undoable change, saved by the editor's own autosave (as a draft, with the
   * revision): how an assistant's answer lands from the host's console, as in the page editor.
   */
  replaceNodes: (nodes: PmlNode[]) => void;
  /**
   * The host wrote the document's fields itself (its assistant set an email's preview text through the fields port): every
   * open details form reads them again, keeping a field the person is typing in, and the canvas compiles again. Keeps the
   * undo history, unlike a remount (2026-11-18).
   */
  refreshFields: () => void;
  /**
   * A draft was saved elsewhere on purpose (the host's worker saved the assistant's result): take it, tree and revision,
   * as one undo step, without saving it again. False, and nothing changes, while this editor has an unsaved change or a
   * save on its way; the host then says so (2026-11-18).
   */
  adoptSavedDraft: () => Promise<boolean>;
  /** The email's design as it stands (the console's "@" targets and labels read it). */
  nodes: PmlNode[];
}

/** A panel the host adds (sending, help from the assistant): it slides in over the email like every other. */
export interface EmailEditorHostPanel {
  key: string;
  title: string;
  render: (controls: EmailEditorControls) => ReactNode;
}

/** The panels a host can open; the selected block's settings open on their own when a block is selected. */
export type EmailEditorPanel = 'details' | 'checks' | `group:${string}` | `host:${string}`;

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
  /**
   * Double-click any words to edit them in place, rich paragraphs included, with the block's settings kept out of the
   * way (post layouts E1/E2, owner 2026-11-16: newsletters adopt the page builder's quick edits). The host decides,
   * from its own gate. Off, the editor behaves exactly as before.
   */
  quickEdit?: boolean;
  /** The host's own slide-in panels, after the editor's (owner 2026-11-17: every option in a panel over the design). */
  panels?: EmailEditorHostPanel[];
  /**
   * The fields the inbox frame draws above the email (what a reader meets before the body: the subject, the preview
   * line, the standard header and footer). Absent, every text field and switch (today's behaviour); a newsletter keeps
   * its signer, audience and sending fields in their panels instead.
   */
  inboxFields?: readonly string[];
  /**
   * The email takes no edits: it is a record now (a newsletter scheduled or sent) or the assistant is working on it. The
   * canvas takes no presses and nothing can be added; the panels still open.
   */
  locked?: boolean;
  /** A field was saved from a panel or the inbox frame (e.g. the host's bar shows the new subject). */
  onFieldSaved?: (name: string) => void;
  /**
   * The checks panel's words, over the email's own ("save for everyone"): a newsletter is SENT, so it says "before it
   * can be sent" and "Ready to send" instead.
   */
  checkWords?: Partial<FindingsWords>;
  /**
   * Who writes new studio comments (the signed-in person's name), as in the page editor: with it, a selected block's
   * panel offers "Comment on this block"; without it, comments already in the email (a template's Purpose and VERIFY
   * notes among them) are still drawn, read, resolved and deleted. A comment never reaches a reader: the email's
   * compiler leaves notes out, and the host strips them before its email checks.
   */
  commentAuthor?: string;
  /** Send a comment to the host's assistant as an ask about its block; absent where it cannot act. */
  onAddressComment?: (comment: StudioComment) => void;
  /**
   * The host's console, drawn FIRST (its dock is sticky; drawn after the email it would sink below the fold), as in the
   * page editor: the host mounts ai-ui's `ConsoleHost` here, which overlays and never shrinks the email.
   */
  console?: ReactNode | ((controls: EmailEditorControls) => ReactNode);
}

const NO_SITE: PmlSite = {};

/**
 * The email editor (pml-email C1a/C2b), the shared builder composed for an email: the inbox frame (subject, preview
 * text, the standard header and footer), a 600px canvas holding only email elements, the settings rail for what is
 * selected, the email's checks, and the email exactly as sent (light, dark, plain text). Edits autosave to the host's
 * DRAFT; "Save for everyone" (the adapter's publish) is the one act that changes what sends. Mount it with
 * `key={id}`, so switching emails starts a fresh editor.
 */
export function EmailEditor({
  adapter,
  id,
  allowedElements,
  renderAsSent,
  frame,
  site = NO_SITE,
  renderControls,
  notice,
  onPublished,
  quickEdit = false,
  panels = [],
  inboxFields,
  locked = false,
  onFieldSaved,
  checkWords,
  commentAuthor,
  onAddressComment,
  console: consoleSlot,
}: EmailEditorProps): React.JSX.Element {
  const editor = useDocumentEditor(adapter, id, {
    noun: 'email',
    publishedMessage: 'Saved for everyone. The next email sent uses this version.',
    onPublished: () => onPublished?.(),
  });
  const vars = useOwnVars();
  const [adding, setAdding] = useState(false);
  // Bumped by refreshFields(): the inbox frame and every details form read the email's fields again.
  const [fieldsEpoch, setFieldsEpoch] = useState(0);
  const host = useBuilderHost();
  const { nodes, change } = editor;
  // The email's own chrome (shared PML Studio P2b1): its views, inbox frame, field writes and words, in one module.
  const email = useEmailProfile({ id, fields: adapter.fields, session: editor.session, editor, allowedElements, renderAsSent, inboxFields, checkWords, onFieldSaved });
  // Studio comments pinned to blocks, the page editor's own hook (one shape for every designer).
  const comments = useStudioComments({ nodes, change, author: commentAuthor, onAddress: onAddressComment, onError: host.onError, disabled: locked });

  // One rule for when the settings show, shared with the page editor (QUICK_EDIT_WINDOW_MS lives there).
  const { selectedPath, selectPath, settingsShown, onQuickEdit } = useQuickEditSelection(quickEdit && !locked);
  const selected = selectedPath && !locked ? getNodeAtPath(nodes, selectedPath) : null;

  // The field groups, one slide-in panel each (owner 2026-11-17: every option in a panel over the design), as the page
  // editor reads them.
  const [fieldGroups, setFieldGroups] = useState<DocumentFieldGroup[]>([]);
  useEffect(() => {
    let alive = true;

    adapter.fields
      ?.describe(id)
      .then((list) => alive && setFieldGroups(fieldGroupsOf(list)))
      // A group's panel reports its own load failure when opened; here it only means no group menu yet.
      .catch(() => undefined);

    return () => {
      alive = false;
    };
  }, [adapter.fields, id]);

  // Block settings, the checks, the field groups and the host's panels slide in over the canvas (owner 2026-11-17: "the
  // design area shouldn't be shrunken"): the selected block's settings once they are due, otherwise what the host asked
  // for, otherwise a refused "Save for everyone"'s findings until dismissed. Derived, so nothing syncs in an effect.
  const [asked, setAsked] = useState<EmailEditorPanel | null>(null);
  const [openKey, setOpenKey] = useState(0);
  const [dismissedScan, setDismissedScan] = useState<unknown>(null);
  const refused = editor.scan && !editor.scan.mayPublish && editor.scan !== dismissedScan ? 'checks' : null;
  const panel: 'selected' | EmailEditorPanel | null = selected && selectedPath && settingsShown ? 'selected' : (asked ?? refused);
  const openPanel = (next: EmailEditorPanel) => {
    setAsked(next === 'details' && fieldGroups.length > 0 ? `group:${fieldGroups[0].key}` : next);
    setOpenKey((k) => k + 1);
    selectPath(null);
  };
  const closePanel = () => {
    if (panel === 'selected') selectPath(null);
    if (panel === 'checks') setDismissedScan(editor.scan);
    setAsked(null);
  };
  const openHost = panel?.startsWith('host:') ? panels.find((hosted) => `host:${hosted.key}` === panel) ?? null : null;
  const openGroup = panel?.startsWith('group:') ? fieldGroups.find((group) => `group:${group.key}` === panel) ?? null : null;


  const controls: EmailEditorControls = {
    tab: email.tab,
    setTab: email.setTab,
    saving: editor.saving,
    dirty: editor.dirty,
    canUndo: editor.canUndo,
    canRedo: editor.canRedo,
    undo: editor.undoEdit,
    redo: editor.redoEdit,
    check: () => {
      void editor.check();
      openPanel('checks');
    },
    publish: email.publish,
    publishing: editor.publishing,
    openPanel,
    hasDetails: Boolean(adapter.fields),
    fieldGroups,
    hostPanels: panels.map(({ key, title }) => ({ key, title })),
    flush: email.flush,
    commentMenu: comments.menuItems,
    replaceNodes: (next) => change(next),
    refreshFields: () => {
      setFieldsEpoch((n) => n + 1);
      editor.refreshPreview();
      // "As sent" draws the saved email, subject and preview text included: draw it again when it is the view.
      email.redrawAsSent();
    },
    adoptSavedDraft: editor.adoptSavedDraft,
    nodes,
  };

  if (editor.loading) {
    return <p className="py-16 text-center text-sm text-[var(--pb-muted)]" style={vars}>{EMAIL_WORDS.opening}</p>;
  }

  if (editor.loadError) {
    return (
      <div role="alert" className="mx-auto max-w-md space-y-3 py-16 text-center text-sm text-[var(--pb-text)]" style={vars}>
        <p>{EMAIL_WORDS.unopened}</p>
        <Button variant="outline" onClick={() => editor.reload()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <FieldsEpochContext.Provider value={fieldsEpoch}>
    <EditorSurfaceProvider surface="email">
    <CatalogProvider components={editor.studioComponents} partials={editor.partials}>
      <div className="space-y-4 text-[var(--pb-text)]" style={vars}>
        {typeof consoleSlot === 'function' ? consoleSlot(controls) : consoleSlot}
        {renderControls ? renderControls(controls) : <EmailHeader controls={controls} />}
        {notice}

        {email.tab === 'sent' ? (
          email.asSent
        ) : (
          <div className="mx-auto w-full max-w-[600px]">
            {email.inboxFrame}
            <PmlCanvas
              // Locked: the canvas's own "building" state takes no presses (no skeleton row), as in the page editor.
              building={locked ? { at: nodes.length + 1, label: null } : null}
              nodes={nodes}
              compiled={editor.compiled}
              natives={editor.natives}
              site={site}
              frame={frame}
              selectedIndex={selectedPath ? selectedPath[0] : null}
              selectedPath={selectedPath}
              // Moving a comment: the next block clicked becomes its block, instead of being selected.
              onSelectPath={comments.pickOr(selectPath)}
              overlay={comments.layer}
              viewport="desktop"
              onSelect={(index) => comments.pickOr(selectPath)(index === null ? null : [index])}
              onMove={(from, to) => change(moveTopLevel(nodes, from, to))}
              onDelete={(index) => {
                change(removeNodeAtPath(nodes, [index]));
                selectPath(null);
              }}
              onEditText={(path, field, value) => {
                const node = getNodeAtPath(nodes, path);
                if (node) change(updateNodeAtPath(nodes, path, { ...node, props: { ...(node.props ?? {}), [field]: value } }));
              }}
              quickEditAll={quickEdit && !locked}
              onQuickEdit={quickEdit && !locked ? onQuickEdit : undefined}
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
            {locked ? null : (
              <Button variant="outline" className="mt-3 w-full border-dashed" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" />
                {EMAIL_WORDS.add}
              </Button>
            )}
          </div>
        )}

        <SlidePanel
          open={panel !== null}
          openKey={openKey}
          onClose={closePanel}
          title={panel === 'selected' ? EMAIL_WORDS.settings : openHost ? openHost.title : openGroup ? openGroup.label : panel === 'details' ? 'Details' : EMAIL_WORDS.checks}
        >
          {panel === 'selected' && selected && selectedPath ? (
            <div className="space-y-4">
              {comments.canAdd ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    comments.add(selectedPath);
                    selectPath(null);
                  }}
                >
                  {EMAIL_WORDS.commentOn}
                </Button>
              ) : null}
            <PmlSettings
              node={selected}
              deleteLabel={EMAIL_WORDS.remove}
              onChange={(next) => change(updateNodeAtPath(nodes, selectedPath, next))}
              onDelete={() => {
                change(removeNodeAtPath(nodes, selectedPath));
                selectPath(null);
              }}
            />
            </div>
          ) : openHost ? (
            openHost.render(controls)
          ) : openGroup ? (
            <FieldGroupPanel id={id} fields={adapter.fields} session={editor.session} groups={fieldGroups} open={openGroup} onOpen={(key) => openPanel(`group:${key}`)} onSaved={email.fieldSaved} />
          ) : panel === 'details' ? (
            adapter.fields ? <DocumentFieldsPanel id={id} fields={adapter.fields} session={editor.session} onSaved={email.fieldSaved} /> : null
          ) : panel === 'checks' ? (
            editor.scan ? (
              <FindingsPanel preflight={editor.scan} words={email.findingsWords} />
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
          unavailable={email.unavailable}
          title={EMAIL_WORDS.add}
          description={EMAIL_WORDS.addDescription}
        />
        <DraftConflictDialog open={editor.conflict !== null} noun="email" onKeepMine={editor.keepMine} onLoadLatest={() => void editor.loadLatest()} />
      </div>
    </CatalogProvider>
    </EditorSurfaceProvider>
    </FieldsEpochContext.Provider>
  );
}
