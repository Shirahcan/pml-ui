'use client';

import React, { useEffect, useState } from 'react';

import type { DocumentVersion, DocumentVersionsPort } from '../document';
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
import { VersionCompare, type CompareEditorSide } from './VersionCompare';
import { changesSentence, versionKind, versionWhen } from './versionWords';

/**
 * A document's earlier versions, newest first, in a slide-in over the canvas (plan close-multi-pass-gaps-2026-11-24
 * P9). Restoring one puts it in the DRAFT, never live, and asks first; what the draft held is kept as a version too,
 * so a restore can itself be undone.
 *
 * ⚠ BEFORE THIS A PUBLISHED CHANGE COULD NOT BE UNDONE. A post kept only its draft and its live copy, so a section
 * removed by hand and published was gone (Portify TEST, 2026-11-24).
 */
export function VersionsPanel({
  id,
  port,
  noun,
  onRestore,
  changing = false,
  compareWith,
}: {
  id: string;
  port: DocumentVersionsPort;
  noun: string;
  /** The editor's restore: true once the version is in the draft and on the canvas. */
  onRestore: (versionId: string) => Promise<boolean>;
  /**
   * The design is being changed (unsaved, or saving). Which version the editor holds was true when the list was read;
   * while the person edits it is not, so it is not claimed, and the list is read again once the change is saved
   * (Portify local 2026-11-24: "In the editor now" stayed on a version after a section was deleted under it).
   */
  changing?: boolean;
  /** The editor's design and drawing, for Compare (versions-compare 2026-11-24). Without it, or a port with no compare, no Compare. */
  compareWith?: CompareEditorSide;
}) {
  const [versions, setVersions] = useState<DocumentVersion[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [asking, setAsking] = useState<DocumentVersion | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [reads, setReads] = useState(0);
  const [comparing, setComparing] = useState<DocumentVersion | null>(null);
  const compare = port.compare;

  useEffect(() => {
    if (changing) return;
    let alive = true;
    port
      .list(id)
      .then((list) => {
        if (!alive) return;
        setVersions(list);
        setFailed(null);
      })
      .catch((err: unknown) => alive && setFailed(err instanceof Error ? err.message : String(err)));

    return () => {
      alive = false;
    };
  }, [port, id, reads, changing]);

  const restore = async () => {
    if (!asking) return;
    setRestoring(true);
    const done = await onRestore(asking.id);
    setRestoring(false);
    setAsking(null);
    if (done) setReads((n) => n + 1);
  };

  if (failed !== null && versions === null) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-[var(--pb-text)]">The versions could not be read: {failed}</p>
        <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={() => setReads((n) => n + 1)}>
          Try again
        </Button>
      </div>
    );
  }

  if (versions === null) return <p className="text-sm text-[var(--pb-muted)]">Reading the versions...</p>;

  if (versions.length === 0) {
    return (
      <p className="text-sm text-[var(--pb-muted)]">
        No earlier versions yet. Each time you publish, the {noun} as it went live is kept here, and so is a draft you throw away.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--pb-muted)]">
        Compare shows a version beside the {noun} in the editor. Restoring puts a version in the draft. Readers keep seeing the
        published {noun} until you publish.
      </p>
      <ul className="space-y-2" aria-label="Versions">
        {versions.map((version) => (
          <li key={version.id} className="rounded-lg border border-[var(--pb-border)] bg-[var(--pb-surface)] px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm">
                <p className="font-medium text-[var(--pb-text)]">{versionKind(version.kind)}</p>
                <p className="text-xs text-[var(--pb-muted)]">
                  {versionWhen(version.at)}
                  {version.byName ? ` by ${version.byName}` : ''}
                </p>
                <p className="text-xs text-[var(--pb-muted)]">
                  {version.elements} {version.elements === 1 ? 'element' : 'elements'}
                  {version.title ? `, titled "${version.title}"` : ''}
                </p>
                {changesSentence(version.changes) ? (
                  <p className="mt-1 text-xs text-[var(--pb-text)]">Since the version before: {changesSentence(version.changes)}.</p>
                ) : null}
              </div>
              {version.current && !changing ? (
                <span className="shrink-0 whitespace-nowrap text-xs text-[var(--pb-muted)]">In the editor now</span>
              ) : (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {compare && compareWith ? (
                    <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={() => setComparing(version)}>
                      Compare
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={() => setAsking(version)}>
                    Restore
                  </Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      {comparing && compare && compareWith ? (
        <VersionCompare
          key={comparing.id}
          id={id}
          port={{ compare }}
          version={comparing}
          noun={noun}
          editor={compareWith}
          restorable={!(comparing.current && !changing)}
          onClose={() => setComparing(null)}
          // The panel's own ask, so a restore from the compare is asked exactly like one from the list.
          onRestore={() => {
            setAsking(comparing);
            setComparing(null);
          }}
        />
      ) : null}

      <AlertDialog open={asking !== null} onOpenChange={(open) => !open && !restoring && setAsking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Put this version in the draft?</AlertDialogTitle>
            <AlertDialogDescription>
              The {noun} in the editor becomes this version. Readers keep seeing the published {noun} until you publish. What the
              draft holds now is kept as a version, so you can come back to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              disabled={restoring}
              onClick={(event) => {
                event.preventDefault();
                void restore();
              }}
            >
              {restoring ? 'Restoring...' : 'Put it in the draft'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
