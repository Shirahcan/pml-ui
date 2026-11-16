'use client';

import React from 'react';

import { Button } from '../ui/controls';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle, DialogFooter, DialogHeader } from '../ui/overlays';

export interface DraftConflictDialogProps {
  /** Set while a save was refused because someone else saved this document since this editor last did. */
  open: boolean;
  /**
   * Save this editor's version over the newer one. Absent where there is nothing of the author's to keep (a preview):
   * the only choice is to load the latest and look again.
   */
  onKeepMine?: () => void;
  /** Drop this editor's unsaved changes and show what was saved elsewhere. */
  onLoadLatest: () => void;
  /** What was changed, in the author's words: a page (default), a component, an email. */
  noun?: string;
}

/**
 * Two people (or two tabs) saved the same document: no silent overwrite. The author decides which version stays;
 * until they do, nothing of theirs is lost and nothing of the other's is overwritten. Both choices are plain verbs
 * about whose words stay.
 */
export function DraftConflictDialog({ open, onKeepMine, onLoadLatest, noun = 'page' }: DraftConflictDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <DialogHeader>
          <AlertDialogTitle>This {noun} was changed somewhere else</AlertDialogTitle>
          <AlertDialogDescription>
            {onKeepMine
              ? `Someone else, or this ${noun} open in another tab, saved changes after you last saved. Keep your version to replace theirs, or load theirs and lose the changes you have not saved here.`
              : `This ${noun} was saved again after you opened it here, so what you are looking at is not the latest. Load the latest, check it, then try again.`}
          </AlertDialogDescription>
        </DialogHeader>
        <DialogFooter>
          {onKeepMine ? (
            <>
              <AlertDialogCancel asChild>
                <Button variant="outline" onClick={onLoadLatest}>
                  Load their version
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button onClick={onKeepMine}>Keep mine</Button>
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction asChild>
              <Button onClick={onLoadLatest}>Load the latest</Button>
            </AlertDialogAction>
          )}
        </DialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
