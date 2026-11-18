'use client';

import React, { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Redo2, Send, ShieldCheck, Undo2 } from 'lucide-react';

import { PML_CATALOG_BY_NAME } from '../../../language';
import type { DocumentFieldsPort } from '../../document';
import { EmailAsSent, type RenderedEmail } from '../../editor/EmailAsSent';
import { EmailInbox } from '../../editor/emailInbox';
import type { FindingsWords } from '../../editor/FindingsPanel';
import { Button } from '../../ui/controls';

/**
 * The email profile's own chrome (shared PML Studio P2b1): what makes the editor an EMAIL editor, in one module, so the
 * Studio can draw it for `profile="email"` and nothing email-only lives in shared chrome. Everything else (the canvas,
 * the selection bar, the element menu, the panels, comments) is the Studio's.
 */

/** What the checks say for an email whose next step is "Save for everyone" (a template). */
const SAVE_FOR_EVERYONE_WORDS: Partial<FindingsWords> = { clean: 'Nothing here needs to change. Ready to save for everyone.' };

/** The standard header and footer parts' roots: in the email profile, but never something an author adds to a body. */
const CHROME_ROOTS = ['header', 'footer'];

/** The parts of the document editor the email chrome uses. */
interface EmailProfileEditor {
  flush: () => Promise<boolean>;
  publish: () => Promise<void> | void;
  refreshPreview: () => void;
  canPublish: boolean;
}

export interface EmailProfileOptions {
  id: string;
  fields?: DocumentFieldsPort;
  /** The editor's session, so a field write is never counted as someone else's. */
  session: string;
  editor: EmailProfileEditor;
  /** The elements an email may hold (the server's email profile). Everything else is off the Add menu. */
  allowedElements: readonly string[];
  /** The email as the host sends it, for the saved draft. */
  renderAsSent: (id: string) => Promise<RenderedEmail>;
  /** The fields the inbox frame draws; absent, every text field and switch. */
  inboxFields?: readonly string[];
  /** The checks panel's words over the email's own. */
  checkWords?: Partial<FindingsWords>;
  onFieldSaved?: (name: string) => void;
}

/** The words an email's editor uses where a page's says "section". */
export const EMAIL_WORDS = {
  add: 'Add a block',
  addDescription: 'Only what an email can hold: words, headings, buttons, pictures, notes, tables and dividers.',
  settings: 'Block settings',
  remove: 'Delete block',
  checks: 'Email checks',
  opening: 'Opening the email...',
  unopened: 'This email could not be opened, so nothing here can be edited yet.',
  commentOn: 'Comment on this block',
} as const;

export interface EmailProfile {
  tab: 'design' | 'sent';
  /** Switch view; "As sent" first sends a waiting design save and every field write, then draws the SAVED email. */
  setTab: (tab: 'design' | 'sent') => void;
  /** What the Add menu may not offer: anything the email profile does not allow, and the standard chrome's roots. */
  unavailable: string[];
  /** The inbox frame (subject, preview text, the standard header and footer) drawn above the email; null without fields. */
  inboxFrame: ReactNode;
  /** The email exactly as sent (light, dark, plain text). */
  asSent: ReactNode;
  /** A waiting design save and every field write, sent now; true once the email is saved. */
  flush: () => Promise<boolean>;
  /** "Save for everyone" after every field write has landed; absent when the document has no publish step. */
  publish?: () => void;
  /** A field was saved: the canvas compiles again, the host hears which. */
  fieldSaved: (name: string) => void;
  /** The host wrote fields elsewhere: "As sent" draws again when it is the view. */
  redrawAsSent: () => void;
  /** Hand a field write to the profile, so flush and publish wait for it. */
  track: (write: Promise<unknown>) => void;
  findingsWords: Partial<FindingsWords>;
}

export function useEmailProfile({ id, fields, session, editor, allowedElements, renderAsSent, inboxFields, checkWords, onFieldSaved }: EmailProfileOptions): EmailProfile {
  const [tab, setTab] = useState<'design' | 'sent'>('design');
  const [sentVersion, setSentVersion] = useState(0);
  const [sentStale, setSentStale] = useState(false);
  const fieldWrites = useRef(new Set<Promise<unknown>>());

  // `header` and `footer` are the standard chrome's roots (added to every email at send time), never body blocks.
  const unavailable = useMemo(
    () => Object.keys(PML_CATALOG_BY_NAME).filter((name) => !allowedElements.includes(name) || CHROME_ROOTS.includes(name)),
    [allowedElements],
  );

  const track = useCallback((write: Promise<unknown>) => {
    fieldWrites.current.add(write);
    void write.finally(() => fieldWrites.current.delete(write));
  }, []);

  const fieldSaved = (name: string) => {
    editor.refreshPreview();
    onFieldSaved?.(name);
  };

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

  return {
    tab,
    setTab: showTab,
    unavailable,
    inboxFrame: fields ? <EmailInbox id={id} fields={fields} session={session} track={track} only={inboxFields} onSaved={fieldSaved} /> : null,
    asSent: <EmailAsSent render={render} version={sentVersion} stale={sentStale} />,
    flush: () => Promise.all([editor.flush(), ...fieldWrites.current]).then(([saved]) => saved),
    publish: editor.canPublish
      ? () => {
          // Field writes are part of what is saved for everyone: let them land first.
          void Promise.all([...fieldWrites.current]).then(() => editor.publish());
        }
      : undefined,
    fieldSaved,
    redrawAsSent: () => {
      if (tab === 'sent') setSentVersion((v) => v + 1);
    },
    track,
    findingsWords: { ...SAVE_FOR_EVERYONE_WORDS, ...checkWords },
  };
}

/** What the email header needs from the editor's controls. */
export interface EmailHeaderControls {
  tab: 'design' | 'sent';
  setTab: (tab: 'design' | 'sent') => void;
  saving: boolean;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  check: () => void;
  publish?: () => void;
  publishing: boolean;
}

/** The email editor's own header when the host does not draw the controls in its chrome. */
export function EmailHeader({ controls }: { controls: EmailHeaderControls }): React.JSX.Element {
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
