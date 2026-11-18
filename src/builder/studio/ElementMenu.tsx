'use client';

import React, { useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, BoxSelect, ClipboardPaste, Copy, CopyPlus, MessageSquarePlus, MoreVertical, SquareDashed, Trash2 } from 'lucide-react';

import { getNodeAtPath, type Moved, type PmlNode } from '../../language';
import { useBuilderHost } from '../editor/host';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/overlays';
import { availableActions, elementActions, heldElement, holdElement } from './elementActions';

/**
 * An item only the host can offer (Portify's "Add to Porter"), placed after the Studio's own items and before Remove.
 * The Studio never hard-codes a product's actions (shared PML Studio P3a).
 */
export interface StudioElementAction {
  key: string;
  label: string;
  icon?: ReactNode;
  /** Shown greyed out, for an action already taken ("Added to Porter"). */
  disabled?: boolean;
  onSelect: (path: number[], node: PmlNode) => void;
}

/**
 * Everything that can be done to one element, in ONE menu (the kebab rule): Move up / down, Duplicate, Copy, Paste after
 * this, Wrap in a box, Unwrap, the host's own items, Comment, then Remove, last and red, which asks first. An action the
 * element cannot take right now is left out rather than offered and refused. Opened from the three dots on the
 * element's bar, or by right-clicking the element (the host controls `open` for that).
 */
export function ElementMenu({
  nodes,
  path,
  label,
  change,
  select,
  onComment,
  extraActions = [],
  open,
  onOpenChange,
  triggerClassName,
}: {
  nodes: PmlNode[];
  path: number[];
  /** The element's name as a person says it ("Heading", "Question section"). */
  label: string;
  change: (next: PmlNode[]) => void;
  /** Where the selection goes after an action. */
  select: (path: number[] | null) => void;
  /** Pin a comment to this element; absent where comments are not kept. */
  onComment?: (path: number[]) => void;
  extraActions?: StudioElementAction[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
}): React.JSX.Element | null {
  const { onError, onSuccess } = useBuilderHost();
  const [confirming, setConfirming] = useState(false);
  const node = getNodeAtPath(nodes, path);

  if (!node) return null;

  const name = label.toLowerCase();
  const can = availableActions(nodes, path, heldElement());
  const land = (moved: Moved | null) => {
    if (!moved) return;
    change(moved.nodes);
    select(moved.path.length > 0 ? moved.path : null);
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={onOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for this ${name}`}
            className={triggerClassName ?? 'inline-flex items-center rounded-md px-1.5 py-0.5 outline-none hover:bg-white/15'}
            // The bar sits on the element: a click on the dots must not also select what is under it.
            onClick={(event) => event.stopPropagation()}
          >
            <MoreVertical className="h-3 w-3" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[13rem]" data-builder-keep-panel="" onClick={(event) => event.stopPropagation()}>
          {can.up ? (
            <DropdownMenuItem onSelect={() => land(can.up)}>
              <ArrowUp aria-hidden />
              Move up
            </DropdownMenuItem>
          ) : null}
          {can.down ? (
            <DropdownMenuItem onSelect={() => land(can.down)}>
              <ArrowDown aria-hidden />
              Move down
            </DropdownMenuItem>
          ) : null}
          {can.duplicate ? (
            <DropdownMenuItem onSelect={() => land(can.duplicate)}>
              <CopyPlus aria-hidden />
              Duplicate
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={() => {
              if (holdElement(node)) {
                onSuccess('Copied. Use Paste after this on another element, in this design or another one.');
              } else {
                onError(new Error('The browser did not let the editor keep the copy (a private window, or site storage turned off).'));
              }
            }}
          >
            <Copy aria-hidden />
            Copy
          </DropdownMenuItem>
          {can.paste ? (
            <DropdownMenuItem onSelect={() => land(can.paste)}>
              <ClipboardPaste aria-hidden />
              Paste after this
            </DropdownMenuItem>
          ) : null}
          {can.wrap ? (
            <DropdownMenuItem onSelect={() => land(can.wrap)}>
              <BoxSelect aria-hidden />
              Wrap in a box
            </DropdownMenuItem>
          ) : null}
          {can.unwrap ? (
            <DropdownMenuItem onSelect={() => land(can.unwrap)}>
              <SquareDashed aria-hidden />
              Unwrap
            </DropdownMenuItem>
          ) : null}
          {extraActions.map((action) => (
            <DropdownMenuItem key={action.key} disabled={action.disabled} onSelect={() => action.onSelect(path, node)}>
              {action.icon ?? null}
              {action.label}
            </DropdownMenuItem>
          ))}
          {onComment ? (
            <DropdownMenuItem onSelect={() => onComment(path)}>
              <MessageSquarePlus aria-hidden />
              Comment
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setConfirming(true)}>
            <Trash2 aria-hidden />
            Remove {name}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this {name}?</AlertDialogTitle>
            <AlertDialogDescription>It goes with everything inside it. Undo brings it back.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction className="bg-[var(--pb-danger)] text-white" onClick={() => land(elementActions.remove(nodes, path))}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
