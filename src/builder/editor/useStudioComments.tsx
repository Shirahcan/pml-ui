'use client';

import React, { useCallback, useMemo, useState } from 'react';

import { addComment, collectComments, removeComment, repinComment, updateComment, type StudioComment } from '../../language';
import { findPathByUid, getNodeAtPath, type PmlNode } from '../../language';
import { CommentPins, commentKey } from './CommentPins';
import type { CommentActions } from './CommentCard';

const VISIBLE_KEY = 'pml.studio.comments.visible';
const RESOLVED_KEY = 'pml.studio.comments.resolved';

/** The comment being written, before its first Save (it has no place in the page yet). */
const NEW_PATH: number[] = [-1];
const NEW_KEY = NEW_PATH.join('.');

function remembered(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;

  try {
    const value = window.localStorage.getItem(key);

    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}

function remember(key: string, on: boolean): void {
  try {
    window.localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // Private browsing: the choice lasts for this visit only.
  }
}

/** One item for the host's menu (show or hide the comments, show or hide the resolved ones). */
export interface CommentMenuItem {
  label: string;
  onSelect: () => void;
}

/**
 * Studio comments on any editor (D2-D4, owner 2026-11-07; the post and email designers since 2026-11-17, when a
 * template's Purpose and VERIFY notes became comments pinned to their elements): the comments in the design, the pins
 * layer for the canvas's `overlay`, adding one to an element, moving one, and the host's menu items that show or hide
 * them. Every change goes through the editor's own `change`, so autosave and undo cover comments like any element.
 * Visibility is remembered per person, on this device. The site creator's own hook (Portify) can move onto this one.
 */
export function useStudioComments({
  nodes,
  change,
  author,
  onAddress,
  onError,
  disabled = false,
  insideTop = false,
}: {
  nodes: PmlNode[];
  change: (next: PmlNode[]) => void;
  /** Who is writing new comments (the signed-in person's name); without one, comments are read, resolved and deleted only. */
  author?: string;
  /** Send a comment to the host's assistant as an ask about its element (D5); absent where it cannot act. */
  onAddress?: (comment: StudioComment) => void;
  /** Where an error the person must see goes (the builder host's). */
  onError: (error: unknown) => void;
  /** While the assistant writes the page the canvas shows its draft, so no pins are drawn. */
  disabled?: boolean;
  /** A component (one top element): a comment on the top element goes inside it, never beside it. */
  insideTop?: boolean;
}) {
  const [visible, setVisible] = useState(() => remembered(VISIBLE_KEY, true));
  const [showResolved, setShowResolved] = useState(() => remembered(RESOLVED_KEY, false));
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // A new comment stays HERE until it is saved, so an empty one is never written into the page.
  const [pending, setPending] = useState<{ uid: string; at: string } | null>(null);
  // Moving a comment (or pinning an orphan): the next element clicked on the canvas becomes its element.
  const [moving, setMoving] = useState<StudioComment | null>(null);
  const saved = useMemo(() => collectComments(nodes), [nodes]);
  const comments = useMemo(() => {
    const target = pending ? findPathByUid(nodes, pending.uid) : null;

    return pending && target ? [...saved, { path: NEW_PATH, text: '', note: { for: pending.uid, author, at: pending.at }, target }] : saved;
  }, [author, nodes, pending, saved]);
  const open = saved.filter((comment) => !comment.note.resolved).length;
  const resolved = saved.length - open;

  const add = useCallback(
    (targetPath: number[]) => {
      const target = getNodeAtPath(nodes, targetPath);

      if (!author) return;
      if (!target || typeof target.uid !== 'string') {
        onError('A comment can only be pinned to an element that has been saved. Wait for "Saved" and try again.');

        return;
      }

      setPending({ uid: target.uid, at: new Date().toISOString() });
      setVisible(true);
      remember(VISIBLE_KEY, true);
      setOpenKey(NEW_KEY);
      setEditingKey(NEW_KEY);
    },
    [author, nodes, onError],
  );

  const actions: CommentActions = useMemo(
    () => ({
      onSave: (comment, text, note) => {
        if (comment.path === NEW_PATH) {
          const at = comment.target;
          const added = at ? addComment(nodes, at, text, { ...comment.note, ...note }, { insideTop }) : null;

          setPending(null);
          if (added) change(added.nodes);
          else onError('The element this comment was for is no longer on the page, so it was not added.');

          return;
        }

        change(updateComment(nodes, comment.path, { text, note }));
      },
      onResolve: (comment, on) => {
        if (comment.path === NEW_PATH) return;
        change(updateComment(nodes, comment.path, { note: { resolved: on } }));
        if (on && !showResolved) setOpenKey(null);
      },
      onDelete: (comment) => {
        if (comment.path === NEW_PATH) setPending(null);
        else change(removeComment(nodes, comment.path));
      },
      onAddress: onAddress
        ? (comment) => {
            setOpenKey(null);
            onAddress(comment);
          }
        : undefined,
      onRepin: (comment) => {
        if (comment.path === NEW_PATH) return;
        setMoving(comment);
        setOpenKey(null);
      },
    }),
    [change, insideTop, nodes, onAddress, onError, showResolved],
  );

  /**
   * The canvas's select, wrapped: while a comment is being moved, a click on an element pins it there instead of
   * selecting (a click on nothing cancels).
   */
  const pickOr = useCallback(
    (select: (path: number[] | null) => void) => (path: number[] | null) => {
      if (!moving) {
        select(path);

        return;
      }

      setMoving(null);
      if (!path) return;

      const next = repinComment(nodes, moving.path, path, { insideTop });

      if (next === nodes) onError('A comment can only be pinned to an element that has been saved. Wait for "Saved" and try again.');
      else change(next);
    },
    [change, insideTop, moving, nodes, onError],
  );

  const banner = moving ? (
    <div className="pointer-events-auto absolute left-1/2 top-2 z-40 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border border-[#4361EE]/30 bg-white/95 px-4 py-2 text-sm text-slate-700 shadow-lg backdrop-blur-xl">
      Click the element this comment is about
      <button type="button" onClick={() => setMoving(null)} className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold text-[#4361EE] outline-none hover:bg-[#4361EE]/10">
        Cancel
      </button>
    </div>
  ) : null;

  const layer =
    visible && !disabled ? (
      <CommentPins
        nodes={nodes}
        comments={comments}
        showResolved={showResolved}
        openKey={openKey}
        onOpen={setOpenKey}
        editingKey={editingKey}
        onEditing={setEditingKey}
        actions={actions}
        banner={banner}
      />
    ) : null;

  const menuItems: CommentMenuItem[] =
    saved.length === 0
      ? []
      : [
          {
            label: visible ? `Hide comments (${open})` : `Show comments (${open})`,
            onSelect: () => {
              remember(VISIBLE_KEY, !visible);
              setVisible(!visible);
            },
          },
          ...(visible && resolved > 0
            ? [
                {
                  label: showResolved ? `Hide resolved (${resolved})` : `Show resolved (${resolved})`,
                  onSelect: () => {
                    remember(RESOLVED_KEY, !showResolved);
                    setShowResolved(!showResolved);
                  },
                },
              ]
            : []),
        ];

  return {
    comments: saved,
    open,
    layer,
    /** Write a new comment on the element at `path` (only with an author). */
    add,
    canAdd: Boolean(author),
    menuItems,
    pickOr,
    moving: moving !== null,
    openComment: (comment: StudioComment) => setOpenKey(commentKey(comment)),
  };
}
