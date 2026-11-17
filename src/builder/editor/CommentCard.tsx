'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, MoreVertical, Pencil, Pin, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import { COMMENT_COLORS, COMMENT_MAX_CHARS, COMMENT_PLACEMENTS, COMMENT_SWATCH, type StudioComment } from '../../language';
import type { CommentColor, CommentNote, CommentPlacement } from '../../language';
import { Button } from '../ui/controls';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  DialogFooter,
  DialogHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/overlays';
import { useBuilderHost } from './host';

export interface CommentActions {
  onSave: (comment: StudioComment, text: string, note: Partial<CommentNote>) => void;
  onResolve: (comment: StudioComment, resolved: boolean) => void;
  onDelete: (comment: StudioComment) => void;
  /** Send the comment to the host's assistant as an ask about its element (D5). */
  onAddress?: (comment: StudioComment) => void;
  /** Move a comment (or pin an orphan): the next element clicked on the canvas becomes its element. */
  onRepin?: (comment: StudioComment) => void;
}

/** Ticks once a minute so "5 min ago" stays true while the editor is open. */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 60_000);

    return () => clearInterval(tick);
  }, []);

  return now;
}

const PLACEMENT_LABEL: Record<CommentPlacement, string> = {
  'top-right': 'Top right',
  'top-left': 'Top left',
  'bottom-right': 'Bottom right',
  'bottom-left': 'Bottom left',
  left: 'Left side',
  right: 'Right side',
};

/** "just now", "5 min ago", "3 h ago", then the date; the full local time, zone named, on hover. */
function when(at: string | undefined, now: number): { short: string; full: string } | null {
  const time = at ? Date.parse(at) : NaN;

  if (Number.isNaN(time)) return null;

  const minutes = Math.round((now - time) / 60_000);
  // `dateStyle` cannot be combined with `timeZoneName` (a TypeError that crashed the card), so the
  // fields are named one by one; the zone is always named (the platform's time rule).
  const full = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(time);

  if (minutes < 1) return { short: 'just now', full };
  if (minutes < 60) return { short: `${minutes} min ago`, full };
  if (minutes < 60 * 24) return { short: `${Math.round(minutes / 60)} h ago`, full };

  return { short: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(time), full };
}

/**
 * One studio comment, opened from its pin (D2/D3): who wrote it and when, the words, and what can be
 * done to it in ONE kebab (the row-actions rule). Delete is last, red, and asks first. A new comment
 * opens here in edit mode, with its colour and where its pin sits.
 */
export function CommentCard({
  comment,
  editing,
  onEdit,
  onClose,
  actions,
}: {
  comment: StudioComment;
  editing: boolean;
  onEdit: (on: boolean) => void;
  onClose: () => void;
  actions: CommentActions;
}): React.JSX.Element {
  const [draft, setDraft] = useState(comment.text);
  const [color, setColor] = useState<CommentColor>(comment.note.color ?? 'yellow');
  const [placement, setPlacement] = useState<CommentPlacement>(comment.note.placement ?? 'top-right');
  const [confirming, setConfirming] = useState(false);
  const host = useBuilderHost();
  const assistant = host.assistantName?.trim();
  const now = useMinuteClock();
  const stamp = when(comment.note.at, now);
  const swatch = COMMENT_SWATCH[comment.note.color ?? 'yellow'];
  const resolved = comment.note.resolved === true;

  const save = () => {
    const text = draft.trim();

    if (text === '') {
      actions.onDelete(comment);
      onClose();

      return;
    }

    actions.onSave(comment, text, { color, placement });
    onEdit(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(comment.text);
      host.onSuccess('Comment copied');
    } catch (error) {
      // A clipboard refusal is not a failed request, so it goes to the host's error surface.
      host.onError(error);
    }
  };

  return (
    <div
      role="dialog"
      aria-label={`Comment by ${comment.note.author ?? 'someone'}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      className="w-72 rounded-2xl border border-white bg-white/95 p-3 text-left text-sm text-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl"
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
          style={{ backgroundColor: swatch.fill, color: swatch.ink }}
        >
          {(comment.note.author ?? '?').trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{comment.note.author ?? 'Someone'}</p>
          {/* A note a template or a prepare wrote carries no time: then nothing is said about one (2026-11-17). */}
          {stamp || resolved ? (
            <p className="text-xs text-slate-500" title={stamp?.full}>
              {stamp ? `${stamp.short}${resolved ? ', resolved' : ''}` : 'Resolved'}
            </p>
          ) : null}
        </div>
        {editing ? null : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Actions for this comment" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 outline-none hover:bg-slate-100 hover:text-slate-800">
                <MoreVertical aria-hidden="true" className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[13rem]">
              <DropdownMenuItem onSelect={() => onEdit(true)}>
                <Pencil aria-hidden="true" className="h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => actions.onResolve(comment, !resolved)}>
                {resolved ? <RotateCcw aria-hidden="true" className="h-4 w-4" /> : <Check aria-hidden="true" className="h-4 w-4" />}
                {resolved ? 'Reopen' : 'Resolve'}
              </DropdownMenuItem>
              {actions.onAddress && comment.target ? (
                <DropdownMenuItem onSelect={() => actions.onAddress?.(comment)}>
                  <Sparkles aria-hidden="true" className="h-4 w-4" />
                  {assistant ? `Ask ${assistant} to address` : 'Ask the assistant to address'}
                </DropdownMenuItem>
              ) : null}
              {actions.onRepin ? (
                <DropdownMenuItem onSelect={() => actions.onRepin?.(comment)}>
                  <Pin aria-hidden="true" className="h-4 w-4" />
                  {comment.target ? 'Move to another element' : 'Pin to an element'}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => void copy()}>
                <Copy aria-hidden="true" className="h-4 w-4" />
                Copy
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setConfirming(true)}>
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <button type="button" aria-label="Close" onClick={onClose} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 outline-none hover:bg-slate-100 hover:text-slate-700">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            autoFocus
            aria-label="Comment"
            value={draft}
            maxLength={COMMENT_MAX_CHARS}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) save();
            }}
            rows={3}
            placeholder="Write a note for whoever works on this next"
            className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#4361EE]"
          />
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Colour">
            {COMMENT_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={color === option}
                aria-label={COMMENT_SWATCH[option].label}
                onClick={() => setColor(option)}
                className={`h-5 w-5 rounded-full outline-none ring-offset-2 ${color === option ? 'ring-2 ring-slate-700' : ''}`}
                style={{ backgroundColor: COMMENT_SWATCH[option].fill }}
              />
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Pin
            <select
              value={placement}
              onChange={(event) => setPlacement(event.target.value as CommentPlacement)}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
            >
              {COMMENT_PLACEMENTS.map((option) => (
                <option key={option} value={option}>
                  {PLACEMENT_LABEL[option]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setDraft(comment.text);
                if (comment.text === '') {
                  actions.onDelete(comment);
                  onClose();
                } else {
                  onEdit(false);
                }
              }}
              className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-slate-600 outline-none hover:bg-slate-100"
            >
              Cancel
            </button>
            <button type="button" onClick={save} className="whitespace-nowrap rounded-full bg-[#4361EE] px-4 py-1.5 text-xs font-semibold text-white outline-none hover:bg-[#324CD9]">
              Save
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap break-words text-slate-700">{comment.text}</p>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <DialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>Undo (Ctrl+Z) brings it back while this editor is open.</AlertDialogDescription>
          </DialogHeader>
          <DialogFooter>
            <AlertDialogCancel asChild>
              <Button variant="outline">Keep it</Button>
            </AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button
                variant="danger"
                onClick={() => {
                  actions.onDelete(comment);
                  onClose();
                }}
              >
                Delete
              </Button>
            </AlertDialogAction>
          </DialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
