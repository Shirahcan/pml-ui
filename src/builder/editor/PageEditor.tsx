'use client';

import React, { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';

import { elementLabel, getNodeAtPath, moveTopLevel, pieceOf, piecesOf, removeNodeAtPath, updateNodeAtPath, type PmlNode, type ProfileKey } from '../../language';
import { fieldGroupsOf, isConflict, partGroupAt, type DocumentFieldGroup, type DocumentLayout, type EditableDocumentAdapter } from '../document';
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
import { CatalogProvider, PiecesProvider } from './catalog';
import { DocumentFieldsPanel } from './DocumentFieldsPanel';
import { FieldGroupPanel } from './FieldGroupPanel';
import { useBuilderHost } from './host';
import { EditorNounProvider, EditorSurfaceProvider } from './surface';
import type { RenderedEmail } from './EmailAsSent';
import { EMAIL_WORDS, EmailHeader, useEmailProfile } from '../studio/profiles/email';
import { ComponentSettingsPanel } from '../studio/profiles/component';
import { DraftConflictDialog } from './DraftConflictDialog';
import { FindingsPanel, type FindingsWords } from './FindingsPanel';
import { PageEditorHeader } from './PageEditorHeader';
import { PageLayers } from './PageLayers';
import { PartGuides } from './PartGuides';
import { PlaceholdersLeftNotice } from './PlaceholdersLeftNotice';
import { PmlAddSectionDialog } from './PmlAddSectionDialog';
import { PmlCanvas, type CanvasFrame } from './PmlCanvas';
import { PmlCodePane } from './PmlCodePane';
import { CanvasFlavorContext } from './canvasFlavor';
import { canDelete as layoutAllowsDelete, canReorder } from './layoutParts';
import { NestedPartCounters } from './NestedPartCounters';
import { PieceFieldsPanel } from './PieceFields';
import { PositionControls, SelectionBar, type AssistantAsk } from './SelectionBar';
import type { StudioElementAction } from '../studio/ElementMenu';
import { AddRelativeButton, useAddRelative } from '../studio/AddRelative';
import { FieldsEpochContext } from './fieldsEpoch';
import { useStudioComments, type CommentMenuItem } from './useStudioComments';
import type { StudioComment } from '../../language';
import { PmlSettings } from './PmlSettings';
import { SlidePanel } from './SlidePanel';
import { UnpublishDialog } from './UnpublishDialog';
import { VersionsPanel } from './VersionsPanel';
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
  /**
   * Compile the canvas again with the same design: the host changed something the design READS outside the editor (a
   * post's title applied from an assistant's proposal through the fields port). Keeps the undo history, unlike a remount.
   */
  refreshPreview: () => void;
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
  /** Copy a shareable preview link; absent when the document has none. */
  copyPreviewLink?: () => void;
  /** Which view shows: the design or its code; `toggleCode` is absent when the document has no code port. */
  view: 'design' | 'code';
  toggleCode?: () => void;
  /** Slide a panel in over the canvas (the design never narrows): the document's details, its layers, its checks. */
  openPanel: (panel: PageEditorPanel) => void;
  /** Whether the document has details to show (a fields port, or the host's `aside`). */
  hasDetails: boolean;
  /** Whether the document keeps earlier versions: then `openPanel('versions')` lists them, each one restorable. */
  hasVersions: boolean;
  /**
   * The document's field groups, in order (designer sole surface P2a): one slide-in panel each, opened with
   * `openPanel(\`group:${key}\`)`. Empty when its fields have no groups (then `'details'` shows them all).
   */
  fieldGroups: DocumentFieldGroup[];
  /** "Hide comments (3)", "Show resolved (2)": for the host's menu; empty while the document has no comments. */
  commentMenu: CommentMenuItem[];
  /** Take the document off the public site (the adapter's unpublish); absent unless it is live. Confirms first. */
  unpublish?: () => void;
  /**
   * Send a waiting save now; true once the document is saved (a host panel that reads the SAVED document, such as a
   * writing check, calls it first and stops on false).
   */
  flush: () => Promise<boolean>;
  /** The host's own panels (`panels` prop), opened with `openPanel(\`host:${key}\`)`. */
  hostPanels: { key: string; title: string }[];
  /** Whether the document has a publish step ("Save for everyone" for an email template; a newsletter has none). */
  canPublish: boolean;
  /** An email's views (profile `email` only): the design, or the email exactly as sent. */
  tab?: 'design' | 'sent';
  setTab?: (tab: 'design' | 'sent') => void;
  /**
   * Replace the whole design in ONE undoable change, saved by the editor's own autosave (as a draft, with the
   * revision): how an assistant's Build lands from the host's console (designer sole surface P4b).
   */
  replaceNodes: (nodes: PmlNode[]) => void;
  /** The design as it stands (the console's "@" targets and labels read it). */
  nodes: PmlNode[];
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
export type PageEditorPanel = 'details' | 'layers' | 'checks' | 'versions' | `group:${string}` | `host:${string}`;

/** The words a host gives the editor, so it never calls a post a "page". */
export interface PageEditorLabels {
  noun?: string;
  publishedMessage?: string;
  publishedWarning?: string;
  rolledBackMessage?: string;
  /** The add button and dialog title ("Add a section"). */
  add?: string;
  /** The confirm for a rollback, and its two buttons (a host whose rollback is not "throw away the draft" names them). */
  rollbackTitle?: string;
  rollbackDescription?: string;
  rollbackConfirm?: string;
  rollbackCancel?: string;
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
   * While the assistant works on the design (a console run in flight), the canvas takes no edits: what it lands would
   * otherwise replace a change made meanwhile.
   */
  locked?: boolean;
  /**
   * The document's layout (its parts, their rules and starters): with it the canvas shows each part's word count
   * against its rule and "Add" / "Remove last" after a repeating part (owner 2026-11-17, T2).
   */
  layout?: DocumentLayout | null;
  /**
   * @deprecated The canvas's reading look now follows `profile` (a post draws in the post's reading look, as its public
   * page does). Kept for one release as an override; a host passes `profile` only.
   */
  flavor?: 'post' | 'page';
  /**
   * A document field was saved from a panel (a post's title, its category). The canvas compiles again by itself; a
   * host whose own chrome shows a field (the top bar's title) reads it again here.
   */
  onFieldSaved?: (name: string) => void;
  /**
   * The selected element's "AI write" / "AI suggest" (the reference studio's selection bar). The editor makes no call:
   * the host sends a scoped ask to its assistant (a post's designer: its docked console, as an ordinary turn about that
   * element). Absent, the two asks are not offered.
   */
  onAskAssistant?: (ask: AssistantAsk) => void;
  /**
   * Which elements the host's assistant takes an ask about, mirroring its server (a post's designer: its console drafts
   * the title and summary as a proposal, but not the author, the dates, the cover, the badges or a call to action).
   * Absent: every element except the post's own fields.
   */
  canAskAssistant?: (node: PmlNode, path: number[]) => boolean;
  /**
   * Who writes new studio comments (the signed-in person's name). With it, the selection bar offers "Comment" on any
   * element; without it, comments already in the design are still drawn, read, resolved and deleted (owner 2026-11-17:
   * comments surface in the designer "similar to figma comments", a template's Purpose and VERIFY notes among them).
   */
  commentAuthor?: string;
  /** Send a comment to the host's assistant as an ask about its element (D5); absent where it cannot act. */
  onAddressComment?: (comment: StudioComment) => void;
  /**
   * What the document is FOR (shared PML Studio P1b; pml-kit Profiles): which of its elements are pieces whose words are
   * the document's own fields (a post's title edits `title`, its cover edits `cover`), so selecting one offers those
   * fields, a double-click types its one text field in place, and the assistant's asks skip it. A page (the default)
   * has none.
   */
  profile?: ProfileKey;
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
  console?: ReactNode | ((controls: PageEditorControls) => ReactNode);
  /** The host's own panel, shown at the top of the Details panel (above the document's fields). */
  aside?: ReactNode;
  /**
   * The email profile's own (shared PML Studio P2b2; ignored by other profiles). `allowedElements`: what an email may
   * hold (the server's email profile), everything else off the Add menu. `renderAsSent`: the email as the host sends
   * it, for the As sent view. `inboxFields`: the fields the inbox frame draws above the email. `checkWords`: the
   * checks panel's words over the email's own.
   */
  allowedElements?: readonly string[];
  renderAsSent?: (id: string) => Promise<RenderedEmail>;
  inboxFields?: readonly string[];
  checkWords?: Partial<FindingsWords>;
  /**
   * The host's own items in every element's menu (shared PML Studio P3a: Portify's "Add to Porter"), placed before
   * Comment and Remove. The menu itself (move, duplicate, copy, paste, wrap, unwrap, remove) is the Studio's.
   */
  elementMenuActions?: StudioElementAction[];
}

const NO_SITE: PmlSite = {};

/** An email Studio without a host renderer: the As sent view says it cannot draw the email. */
const NO_AS_SENT = (): Promise<RenderedEmail> => Promise.reject(new Error('This editor has no way to draw the email as sent.'));

/**
 * The page editor (shared program E4a4i, blog-on-growth-service S7a): the shared builder composed for a page or a post
 * on any `EditableDocumentAdapter`. The canvas keeps its full width; everything else slides in over it from the right
 * (owner 2026-11-17: "the design area shouldn't be shrunken"): the selected section's settings (after the double-click
 * window), the document's details, its layers, its checks. Add a section, undo and redo, Publish, and, where the
 * document has them, Throw away the draft and a preview link. Edits autosave to the host's draft; Publish is the separate act. Mount it with
 * `key={id}` so switching documents starts a fresh editor.
 */
export function PageEditor({ adapter, id, site = NO_SITE, frame, unavailable = [], renderControls, notice, labels = {}, onPublished, live = false, onUnpublished, panels: hostPanelsIn = [], locked = false, layout = null, flavor, onFieldSaved, onAskAssistant, canAskAssistant, commentAuthor, onAddressComment, profile = 'page', quickEdit = false, console: consoleSlot, aside, elementMenuActions, allowedElements, renderAsSent, inboxFields, checkWords }: PageEditorProps): React.JSX.Element {
  const noun = labels.noun ?? 'page';
  const editor = useDocumentEditor(adapter, id, {
    noun,
    publishedMessage: labels.publishedMessage,
    publishedWarning: labels.publishedWarning,
    rolledBackMessage: labels.rolledBackMessage,
    onPublished: () => onPublished?.(),
  });
  const vars = useOwnVars();
  const isEmail = profile === 'email';
  const { selectedPath, selectPath, settingsShown, onQuickEdit } = useQuickEditSelection(isEmail ? quickEdit && !locked : quickEdit);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<'design' | 'code'>('design');
  const code = adapter.code;
  const [confirmRollback, setConfirmRollback] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  // Bumped by refreshFields(): every open details form reads the document's fields again.
  const [fieldsEpoch, setFieldsEpoch] = useState(0);
  // The element whose menu is open (its path, joined): a right-click opens it, as does its three dots on the bar.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const host = useBuilderHost();
  const { nodes, change } = editor;
  // The component profile's Settings panel (P3c-6): first among the host's panels, when the host keeps settings.
  const settingsPort = profile === 'component' ? adapter.settings : undefined;
  const panels: PageEditorHostPanel[] = settingsPort
    ? [{ key: 'settings', title: 'Settings', render: () => <ComponentSettingsPanel id={id} port={settingsPort} editor={editor} /> }, ...hostPanelsIn]
    : hostPanelsIn;
  // The email profile's chrome (P2b1): drawn only for profile="email"; a hook, so it runs for every profile.
  const email = useEmailProfile({ id, fields: adapter.fields, session: editor.session, editor, allowedElements: allowedElements ?? [], renderAsSent: renderAsSent ?? NO_AS_SENT, inboxFields, checkWords, onFieldSaved });
  // Add an element before / inside / after the selected one (P3b1), with what this document may not hold left out.
  const relative = useAddRelative({ nodes, change, select: selectPath, unavailable: isEmail ? [...unavailable, ...email.unavailable] : unavailable });
  // Studio comments, Figma-style (pins, cards, add, resolve, move): the same experience as the site creator.
  const comments = useStudioComments({ nodes, change, author: commentAuthor, onAddress: onAddressComment, onError: host.onError, disabled: locked });

  // The field groups, one slide-in panel each (owner 2026-11-17: every option in a panel over the design).
  const [allFieldGroups, setFieldGroups] = useState<DocumentFieldGroup[]>([]);
  // A template part's settings are offered on the part when it is selected (owner 2026-11-23), never as a Details tab:
  // Details, its menu and its tabs hold only the document's own groups.
  const fieldGroups = useMemo(() => allFieldGroups.filter((group) => !group.part), [allFieldGroups]);
  const partGroups = useMemo(() => allFieldGroups.filter((group) => group.part), [allFieldGroups]);
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
  // An element inside a section is named for what it is ("Title", "Author"), never "Section settings": the owner read
  // that title as the whole header being selected (2026-11-17).
  const selectedTitle =
    isEmail
      ? EMAIL_WORDS.settings
      : selected && selectedPath && selectedPath.length > 1
        ? elementLabel(selected.component ?? selected.primitive ?? '', editor.studioComponents)
        : 'Section settings';
  const addLabel = labels.add ?? (isEmail ? EMAIL_WORDS.add : 'Add a section');

  // A field saved from any panel: the canvas compiles again, and the host hears which field it was.
  const fieldSaved = (name: string) => {
    editor.refreshPreview();
    onFieldSaved?.(name);
  };

  // The document's pieces, from its profile (one authority in pml-kit): a post's have fields, a page has none.
  const pieces = piecesOf(profile);
  // The reading look follows the profile (shared PML Studio P2a); an explicit `flavor` still wins for one release.
  const canvasFlavor = flavor ?? (profile === 'post' ? 'post' : 'page');
  const pieceNames = useMemo(() => Object.keys(pieces), [pieces]);

  // A double-click on a piece whose words are one text field (a post's title, line under the title, author) types it
  // where it sits and saves it to the document (owner 2026-11-17: "double on the title for quick edit"). Written at the
  // revision it was read at, so a change made elsewhere meanwhile is refused, never overwritten.
  const fieldsPort = adapter.fields;
  const documentText = fieldsPort
    ? {
        fieldOf: (node: PmlNode) => pieceOf(pieces, node)?.quickEdit,
        read: async (name: string) => {
          try {
            const read = await fieldsPort.read(id);
            const value = read.values[name];

            return { value: typeof value === 'string' ? value : '', revision: read.revision };
          } catch (error) {
            host.onError(error);
            throw error;
          }
        },
        write: (name: string, value: string, revision: string) => {
          fieldsPort
            .write(id, name, value, revision, editor.session)
            .then((result) => {
              if (isConflict(result)) {
                host.onError(new Error(`This ${noun} was changed somewhere else after you opened it. Open its details to load the latest, then try again.`));

                return;
              }
              fieldSaved(name);
            })
            .catch((error) => host.onError(error));
        },
      }
    : undefined;

  // No element is locked (owner 2026-11-18, "don't lock any element/component"): every element deletes; a template's
  // required parts and limits are findings at Run the checks. One rule, shared with the selection bar.
  const deletable = (path: number[]): boolean => layoutAllowsDelete(nodes, layout, path);

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
    // Clearing a selection never opens another panel (owner 2026-11-18: it switched to "Checks"): a refused publish's
    // findings that were waiting behind the element's panel are put away with it; "Run the checks" shows them again.
    if (panel === 'selected') {
      selectPath(null);
      setDismissedScan(editor.scan);
    }
    if (panel === 'checks') setDismissedScan(editor.scan);
    setAsked(null);
  };
  const hasDetails = Boolean(adapter.fields || aside);

  // A click on empty canvas clears the selection and closes its panel outright: neither a refused check's findings nor
  // a panel opened before the selection (Checks, Details) comes back from behind it.
  const selectFromCanvas = (path: number[] | null) => {
    if (path === null && selectedPath) {
      setDismissedScan(editor.scan);
      setAsked(null);
    }
    selectPath(path);
  };

  // Esc clears a selection even while its panel is not open (a quick edit); a dialog, a menu or a field keeps its own Esc.
  useEffect(() => {
    if (!selectedPath) return undefined;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return;

      const focused = document.activeElement as HTMLElement | null;
      if (focused && (focused.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(focused.tagName))) return;

      setDismissedScan(editor.scan);
      setAsked(null);
      selectPath(null);
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [selectedPath, selectPath, editor.scan]);

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
    // An email's publish waits for its field writes (they are part of what is saved for everyone).
    publish: isEmail ? () => email.publish?.() : () => void editor.publish(),
    rollback: editor.canRollback ? () => setConfirmRollback(true) : undefined,
    refreshPreview: editor.refreshPreview,
    refreshFields: () => {
      setFieldsEpoch((n) => n + 1);
      editor.refreshPreview();
      email.redrawAsSent();
    },
    adoptSavedDraft: editor.adoptSavedDraft,
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
    hasVersions: editor.canRestoreVersions,
    fieldGroups,
    commentMenu: comments.menuItems,
    unpublish: adapter.unpublish && live ? () => setConfirmUnpublish(true) : undefined,
    flush: isEmail ? email.flush : () => editor.flush(),
    replaceNodes: (next) => change(next),
    nodes,
    hostPanels: panels.map(({ key, title }) => ({ key, title })),
    canPublish: editor.canPublish,
    tab: isEmail ? email.tab : undefined,
    setTab: isEmail ? email.setTab : undefined,
  };
  const openHost = panel?.startsWith('host:') ? panels.find((hosted) => `host:${hosted.key}` === panel) ?? null : null;
  const openGroup = panel?.startsWith('group:') ? fieldGroups.find((group) => `group:${group.key}` === panel) ?? null : null;
  const selectedPart = selectedPath ? partGroupAt(nodes, selectedPath, partGroups) : null;

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
    <FieldsEpochContext.Provider value={fieldsEpoch}>
    <MaybeEmailSurface email={isEmail}>
    <EditorNounProvider noun={noun}>
    <CanvasFlavorContext.Provider value={canvasFlavor}>
    <CatalogProvider components={editor.studioComponents} partials={editor.partials}>
    <PiecesProvider pieces={pieceNames}>
      <div className="space-y-4 text-[var(--pb-text)]" style={vars}>
        {/* The host's console FIRST: its dock is sticky, so drawn after the canvas it would sit at the bottom of a long
            document and its tab would vanish below the fold (owner 2026-11-17: "it should always be visible"). */}
        {typeof consoleSlot === 'function' ? consoleSlot(controls) : consoleSlot}
        {renderControls ? (
          renderControls(controls)
        ) : isEmail ? (
          <EmailHeader controls={{ ...controls, tab: email.tab, setTab: email.setTab, publish: email.publish }} />
        ) : (
          <PageEditorHeader controls={controls} />
        )}
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
        ) : isEmail && email.tab === 'sent' ? (
          email.asSent
        ) : (
        // An email is a 600px column with its inbox frame (subject, preview text) above it.
        <div className={isEmail ? 'mx-auto w-full min-w-0 max-w-[600px]' : 'min-w-0'}>
          {isEmail ? email.inboxFrame : null}
          {/* Pinned to the top of the canvas as it scrolls, taking no room (a notice that pushed the design down would
              jump while a person types). It sat BELOW the whole canvas before: on a long post the only sign of a failed
              draw was 2000px down, and it claimed "the last version that worked" when nothing had (2026-11-23). At the RIGHT:
              the host's console floats over the canvas's left, and a centred notice covered its close and menu buttons. */}
          {editor.previewError ? (
            <div className="sticky top-2 z-30 h-0">
              <p role="status" className="ml-auto mr-3 w-fit max-w-[min(90%,24rem)] rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 shadow-sm">
                {editor.compiled
                  ? `${editor.previewError.message} The canvas shows the last version that worked.`
                  : `The canvas could not draw this ${noun}: ${editor.previewError.message} Each element shows its name until it can.`}
              </p>
            </div>
          ) : null}
          <PmlCanvas
            // A page has no frame on the site, so none on the canvas (owner 2026-11-17, T1: "no global/total border").
            bare={!isEmail}
            // Locked while the assistant works: the canvas's own "building" state takes no presses (no skeleton row).
            building={locked ? { at: nodes.length + 1, label: null } : null}
            afterSection={layout && layout.parts.length > 0 ? (index) => <PartGuides nodes={nodes} index={index} layout={layout} change={change} /> : undefined}
            nodes={nodes}
            compiled={editor.compiled}
            natives={editor.natives}
            site={site}
            frame={frame}
            selectedIndex={selectedPath ? selectedPath[0] : null}
            selectedPath={selectedPath}
            // While a comment is being moved, the next element clicked becomes its element instead of the selection.
            onSelectPath={comments.pickOr(selectFromCanvas)}
            onClearSelection={() => comments.pickOr(selectFromCanvas)(null)}
            // A right-click selects the element (so its bar stays on it) and opens its menu there (P3a).
            onElementContextMenu={
              locked
                ? undefined
                : (path) => {
                    selectFromCanvas(path);
                    setMenuFor(path.join('.'));
                  }
            }
            overlay={
              <>
                {comments.layer}
                {/* An FAQ's question (any nested part instance) is counted under itself, not after the whole section. */}
                {layout && layout.parts.length > 0 ? <NestedPartCounters nodes={nodes} layout={layout} /> : null}
              </>
            }
            viewport="desktop"
            onSelect={(index) => comments.pickOr(selectFromCanvas)(index === null ? null : [index])}
            canDelete={(index) => deletable([index])}
            // Every element moves (owner 2026-11-18: no element is locked); a template's order is a publish check.
            canMove={(index) => canReorder(nodes, layout, [index])}
            onMove={(from, to) => {
              if (!canReorder(nodes, layout, [from])) return;
              change(moveTopLevel(nodes, from, to));
            }}
            renderSelectionBar={
              locked
                ? undefined
                : (path) => <SelectionBar nodes={nodes} path={path} layout={layout} studio={editor.studioComponents} change={change} select={selectPath} onAsk={onAskAssistant} canAsk={canAskAssistant} pieces={pieces} onComment={comments.canAdd ? comments.add : undefined} extraActions={elementMenuActions} menuOpen={menuFor === path.join('.')} onMenuOpenChange={(open) => setMenuFor(open ? path.join('.') : null)} onAddRelative={relative.open} />
            }
            onDelete={(index) => {
              if (!deletable([index])) return;
              change(removeNodeAtPath(nodes, [index]));
              selectPath(null);
            }}
            onEditText={(path, field, value) => {
              const node = getNodeAtPath(nodes, path);
              if (node) change(updateNodeAtPath(nodes, path, { ...node, props: { ...(node.props ?? {}), [field]: value } }));
            }}
            quickEditAll={quickEdit}
            documentText={documentText}
            onQuickEdit={quickEdit ? onQuickEdit : undefined}
            // Rich words edited in place: the paragraph keeps its own shape, only its words change.
            onEditWords={(path, children) => {
              const node = getNodeAtPath(nodes, path);
              if (node) change(updateNodeAtPath(nodes, path, { ...node, children }));
            }}
          />
          {isEmail && locked ? null : (
            <Button variant="outline" className="mt-3 w-full border-dashed" disabled={locked} onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" />
              {addLabel}
            </Button>
          )}
        </div>
        )}

        <SlidePanel
          // An element's options get more room than a list (owner 2026-11-18), each kind with its own remembered width.
          defaultWidth={panel === 'selected' ? 480 : 420}
          widthKey={panel === 'selected' ? 'pml.panel.width.element' : 'pml.panel.width'}
          open={panel !== null}
          openKey={openKey}
          onClose={closePanel}
          title={panel === 'selected' ? selectedTitle : openHost ? openHost.title : openGroup ? openGroup.label : panel === 'details' ? 'Details' : panel === 'layers' ? 'Layers' : panel === 'versions' ? 'Versions' : isEmail ? EMAIL_WORDS.checks : 'Checks'}
        >
          {panel === 'selected' && selected && selectedPath ? (
            <div className="space-y-4">
              {isEmail && comments.canAdd ? (
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
              <PositionControls nodes={nodes} path={selectedPath} layout={layout} change={change} select={selectPath} />
              {locked ? null : <AddRelativeButton placements={relative.placements(selectedPath)} name={relative.nameOf(selectedPath)} onChoose={(placement) => relative.open(selectedPath, placement)} />}
              {/* The part's settings first (a template's: its name, must have, how many), then the piece's own fields (a
                  post's title, its cover upload), then its look. */}
              {adapter.fields && selectedPart ? (
                <DocumentFieldsPanel key={`${id}:${selectedPart.key}`} id={id} fields={adapter.fields} session={editor.session} group={selectedPart.key} label={selectedPart.label} onSaved={fieldSaved} />
              ) : null}
              {adapter.fields ? <PieceFieldsPanel node={selected} pieces={pieces} id={id} fields={adapter.fields} session={editor.session} onSaved={fieldSaved} /> : null}
              <PmlSettings
                key={selectedPath.join('.')}
                node={selected}
                pageNodes={nodes}
                onChange={(next) => change(updateNodeAtPath(nodes, selectedPath, next))}
                canDelete={deletable(selectedPath)}
                // Named for what it is ("Delete paragraph"), never "Delete section" for an element inside one (2026-11-18).
                deleteLabel={isEmail ? EMAIL_WORDS.remove : `Delete ${elementLabel(selected.component ?? selected.primitive ?? '', editor.studioComponents).toLowerCase()}`}
                onDelete={() => {
                  if (!deletable(selectedPath)) return;
                  change(removeNodeAtPath(nodes, selectedPath));
                  selectPath(null);
                }}
              />
            </div>
          ) : openHost ? (
            openHost.render(controls)
          ) : openGroup ? (
            <FieldGroupPanel id={id} fields={adapter.fields} session={editor.session} groups={fieldGroups} open={openGroup} onOpen={(key) => openPanel(`group:${key}`)} aside={aside} onSaved={fieldSaved} />
          ) : panel === 'details' ? (
            <div className="space-y-4">
              {aside}
              {adapter.fields ? <DocumentFieldsPanel id={id} fields={adapter.fields} session={editor.session} onSaved={fieldSaved} /> : null}
            </div>
          ) : panel === 'layers' ? (
            <PageLayers
              nodes={nodes}
              canDrag={(path) => canReorder(nodes, layout, path)}
              selectedPath={selectedPath}
              onSelect={selectPath}
              onMoved={(moved) => {
                change(moved.nodes);
                selectPath(moved.path);
              }}
            />
          ) : panel === 'versions' && adapter.versions ? (
            <VersionsPanel
              id={id}
              port={adapter.versions}
              noun={noun}
              onRestore={editor.restoreVersion}
              changing={editor.dirty || editor.saving}
              compareWith={{ nodes, compiled: editor.compiled, natives: editor.natives, site, frame }}
            />
          ) : panel === 'checks' ? (
            editor.scan ? (
              <FindingsPanel preflight={editor.scan} words={isEmail ? email.findingsWords : { clean: 'Nothing here needs to change. Ready to publish.' }} />
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
          unavailable={isEmail ? [...unavailable, ...email.unavailable] : [...unavailable]}
          title={addLabel}
          description={isEmail ? EMAIL_WORDS.addDescription : undefined}
        />
        {relative.dialog}
        <DraftConflictDialog open={editor.conflict !== null} noun={noun} onKeepMine={editor.keepMine} onLoadLatest={() => void editor.loadLatest()} />
        <UnpublishDialog
          open={confirmUnpublish}
          onOpenChange={setConfirmUnpublish}
          noun={noun}
          title={labels.unpublishTitle}
          description={labels.unpublishDescription}
          onConfirm={() =>
            adapter
              .unpublish?.(id)
              .then(() => {
                host.onSuccess(labels.unpublishedMessage ?? `The ${noun} is off the site.`);
                onUnpublished?.();
              })
              .catch((error) => host.onError(error))
          }
        />
        <AlertDialog open={confirmRollback} onOpenChange={setConfirmRollback}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{labels.rollbackTitle ?? 'Throw away the draft?'}</AlertDialogTitle>
              <AlertDialogDescription>
                {labels.rollbackDescription ?? `Every change not yet published is thrown away, and the ${noun} goes back to its last published version.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{labels.rollbackCancel ?? 'Keep the draft'}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmRollback(false);
                  selectPath(null);
                  void editor.undo();
                }}
              >
                {labels.rollbackConfirm ?? 'Throw it away'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PiecesProvider>
    </CatalogProvider>
    </CanvasFlavorContext.Provider>
    </EditorNounProvider>
    </MaybeEmailSurface>
    </FieldsEpochContext.Provider>
  );
}

/** An email says it is one at its root (the settings hide #link names and page data); any other profile changes nothing. */
function MaybeEmailSurface({ email, children }: { email: boolean; children: ReactNode }): React.JSX.Element {
  return email ? <EditorSurfaceProvider surface="email">{children}</EditorSurfaceProvider> : <>{children}</>;
}

/**
 * The Studio (shared PML Studio P2a): one editor for every kind of PML document, its purpose given by `profile` (a page,
 * a post, an email, a card). `PageEditor` is the same component under its first name. What is shared chrome and what
 * is a profile's own is written down in docs/STUDIO.md.
 */
export const Studio = PageEditor;
export type StudioProps = PageEditorProps;
export type StudioControls = PageEditorControls;
