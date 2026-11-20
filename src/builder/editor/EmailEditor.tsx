'use client';

import React, { useMemo, type ReactNode } from 'react';

import type { PmlNode, StudioComment } from '../../language';
import type { DocumentFieldGroup, EditableDocumentAdapter } from '../document';
import type { PmlSite } from '../../renderer/PmlRenderer';
import type { RenderedEmail } from './EmailAsSent';
import type { FindingsWords } from './FindingsPanel';
import { Studio, type PageEditorHostPanel, type StudioControls } from './PageEditor';
import type { StudioElementAction } from '../studio/ElementMenu';
import type { CanvasFrame } from './PmlCanvas';
import type { CommentMenuItem } from './useStudioComments';

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
  /** The host's own items in every block's menu (e.g. "Add to Porter"), as the page editor takes them. */
  elementMenuActions?: StudioElementAction[];
}

/** The words the email has always used where the Studio says "page". */
const EMAIL_LABELS = { noun: 'email', publishedMessage: 'Saved for everyone. The next email sent uses this version.' };

/**
 * The email editor (pml-email C1a/C2b), now the Studio on the email profile (shared PML Studio P2b3): the inbox frame
 * (subject, preview text, the standard header and footer), a 600px canvas holding only email elements, the panels, the
 * email's checks and the email exactly as sent, plus the Studio's selection bar, element menu and reorder. It keeps its
 * own props and controls for one release; a new host mounts `<Studio profile="email">` directly. Edits autosave to the
 * host's DRAFT; "Save for everyone" (the adapter's publish) is the one act that changes what sends. Mount it with
 * `key={id}`, so switching emails starts a fresh editor.
 */
export function EmailEditor({
  adapter,
  id,
  allowedElements,
  renderAsSent,
  frame,
  site,
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
  elementMenuActions,
}: EmailEditorProps): React.JSX.Element {
  // A host panel is drawn with the email's controls, as before.
  const studioPanels = useMemo<PageEditorHostPanel[]>(
    () => panels.map((panel) => ({ key: panel.key, title: panel.title, render: (controls) => panel.render(emailControls(controls)) })),
    [panels],
  );

  return (
    <Studio
      profile="email"
      adapter={adapter}
      id={id}
      allowedElements={allowedElements}
      renderAsSent={renderAsSent}
      inboxFields={inboxFields}
      checkWords={checkWords}
      frame={frame}
      site={site}
      notice={notice}
      onPublished={onPublished}
      quickEdit={quickEdit}
      panels={studioPanels}
      locked={locked}
      onFieldSaved={onFieldSaved}
      commentAuthor={commentAuthor}
      onAddressComment={onAddressComment}
      labels={EMAIL_LABELS}
      renderControls={renderControls ? (controls) => renderControls(emailControls(controls)) : undefined}
      console={typeof consoleSlot === 'function' ? (controls) => consoleSlot(emailControls(controls)) : consoleSlot}
      elementMenuActions={elementMenuActions}
    />
  );
}

/**
 * The Studio's controls as the email editor has always handed them to its host. `adoptSavedDraft` and `refreshFields`
 * are part of the contract: Portify's DesignerConsole calls them on an applied run (portify-1c, 2026-11-18).
 */
function emailControls(controls: StudioControls): EmailEditorControls {
  return {
    tab: controls.tab ?? 'design',
    setTab: controls.setTab ?? (() => undefined),
    saving: controls.saving,
    dirty: controls.dirty,
    canUndo: controls.canUndo,
    canRedo: controls.canRedo,
    undo: controls.undo,
    redo: controls.redo,
    check: controls.check,
    publish: controls.canPublish ? controls.publish : undefined,
    publishing: controls.publishing,
    openPanel: (panel) => controls.openPanel(panel),
    hasDetails: controls.hasDetails,
    fieldGroups: controls.fieldGroups,
    hostPanels: controls.hostPanels,
    flush: controls.flush,
    commentMenu: controls.commentMenu,
    replaceNodes: controls.replaceNodes,
    refreshFields: controls.refreshFields,
    adoptSavedDraft: controls.adoptSavedDraft,
    nodes: controls.nodes,
  };
}
