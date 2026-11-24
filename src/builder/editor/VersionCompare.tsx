'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { isCommentNode, isStudioComment, pageOutline, withDerivedAnchors, type PmlNativesPayload, type PmlNode } from '../../language';
import type { PmlSite } from '../../renderer/PmlRenderer';
import type { DocumentVersion, DocumentVersionChange, DocumentVersionCompare, DocumentVersionsPort } from '../document';
import { Button } from '../ui/controls';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/overlays';
import { SectionPreview } from './canvasParts';
import { COMPARE_FOCUS, COMPARE_STYLES, elementForUid, markPane, scrollPaneAlong, scrollPaneTo, shownOn } from './compareMarks';
import type { CanvasFrame } from './PmlCanvas';
import { changesSentence, versionKind, versionWhen } from './versionWords';

/** The editor's side of a compare: what it holds now and its drawing, exactly as the canvas has them. */
export interface CompareEditorSide {
  nodes: PmlNode[];
  compiled: PmlNode[] | null;
  natives: PmlNativesPayload | null;
  site: PmlSite;
  frame?: CanvasFrame;
}

/** Narrower than this, a pane draws the phone layout: a desktop design squeezed into half a screen would overflow. */
const PHONE_BELOW = 720;

const HOW_WORDS: Record<DocumentVersionChange['how'], string> = { removed: 'Removed', added: 'Added', changed: 'Changed' };
const HOW_DOT: Record<DocumentVersionChange['how'], string> = { removed: 'bg-[#DC2626]', added: 'bg-[#16A34A]', changed: 'bg-[#D97706]' };

/**
 * One version beside the design in the editor, both drawn as readers see them (versions-compare 2026-11-24, owner:
 * "Add side-by-side compare to Versions"). Red marks what only the version holds (what the editor lost), green what
 * only the editor holds, amber what both hold but differs; the list names each change and takes both sides to it.
 * Restore runs the panel's own ask, so a compare never puts anything in the draft by itself.
 */
export function VersionCompare({
  id,
  port,
  version,
  noun,
  editor,
  restorable,
  onRestore,
  onClose,
}: {
  id: string;
  port: Required<Pick<DocumentVersionsPort, 'compare'>>;
  version: DocumentVersion;
  noun: string;
  editor: CompareEditorSide;
  /** False when the editor holds this version already. */
  restorable: boolean;
  onRestore: () => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<DocumentVersionCompare | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [focus, setFocus] = useState<string | null>(null);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    let alive = true;
    port
      .compare(id, version.id, editor.nodes)
      .then((compared) => {
        if (!alive) return;
        setResult(compared);
        setFailed(null);
      })
      .catch((err: unknown) => alive && setFailed(err instanceof Error ? err.message : String(err)));

    return () => {
      alive = false;
    };
  }, [port, id, version.id, editor.nodes, attempt]);

  // A pane's width decides desktop or phone drawing (the dialog is as wide as the screen allows).
  useEffect(() => {
    const pane = right.current;
    if (!pane || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => setPhone((entry?.contentRect.width ?? PHONE_BELOW) < PHONE_BELOW));
    observer.observe(pane);

    return () => observer.disconnect();
  }, [result]);

  // The marks go on the drawn elements, so after every drawing.
  useLayoutEffect(() => {
    if (!result) return;
    if (left.current) markPane(left.current, result.version.nodes, result.changes, 'version');
    if (right.current) markPane(right.current, editor.nodes, result.changes, 'editor');
  }, [result, editor.nodes, phone]);

  const goTo = (change: DocumentVersionChange) => {
    setFocus(change.uid);
    const panes = [left.current, right.current];
    panes.forEach((pane) => pane?.querySelectorAll(`[${COMPARE_FOCUS}]`).forEach((element) => element.removeAttribute(COMPARE_FOCUS)));
    if (!result || !left.current || !right.current) return;

    const inVersion = shownOn('version', change.how) ? elementForUid(left.current, result.version.nodes, change.uid) : null;
    const inEditor = shownOn('editor', change.how) ? elementForUid(right.current, editor.nodes, change.uid) : null;
    inVersion?.setAttribute(COMPARE_FOCUS, '');
    inEditor?.setAttribute(COMPARE_FOCUS, '');
    if (inVersion) scrollPaneTo(left.current, inVersion);
    if (inEditor) scrollPaneTo(right.current, inEditor);
    // The side that does not hold it shows where it was (or would be).
    if (inVersion && !inEditor) scrollPaneAlong(right.current, left.current, inVersion);
    if (inEditor && !inVersion) scrollPaneAlong(left.current, right.current, inEditor);
  };

  const sentence = changesSentence(result?.summary);
  const versionTitle = [versionKind(version.kind), versionWhen(version.at)].filter(Boolean).join(', ');

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="full" className="h-[90vh]">
        <style>{COMPARE_STYLES}</style>
        <DialogHeader>
          <DialogTitle>Compare with the editor</DialogTitle>
          <DialogDescription>
            {versionTitle} on the left, the {noun} in the editor now on the right.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--pb-border)] md:flex-row">
          <aside aria-label="What changed" className="max-h-40 shrink-0 space-y-3 overflow-y-auto border-b border-[var(--pb-border)] px-4 py-3 text-sm md:max-h-none md:w-72 md:border-b-0 md:border-r">
            {failed !== null ? (
              <div className="space-y-2">
                <p>The versions could not be compared: {failed}</p>
                <Button size="sm" variant="outline" onClick={() => {
                  setFailed(null);
                  setAttempt((n) => n + 1);
                }}>
                  Try again
                </Button>
              </div>
            ) : result === null ? (
              <p className="text-[var(--pb-muted)]">Comparing...</p>
            ) : result.changes.length === 0 ? (
              <p>The editor holds the same design as this version.</p>
            ) : (
              <>
                <p>{sentence}.</p>
                <ul className="space-y-1 text-xs text-[var(--pb-muted)]" aria-label="What the colours mean">
                  <li className="flex items-center gap-2"><span aria-hidden className={`size-2.5 shrink-0 rounded-full ${HOW_DOT.removed}`} />Only in this version</li>
                  <li className="flex items-center gap-2"><span aria-hidden className={`size-2.5 shrink-0 rounded-full ${HOW_DOT.added}`} />Only in the editor</li>
                  <li className="flex items-center gap-2"><span aria-hidden className={`size-2.5 shrink-0 rounded-full ${HOW_DOT.changed}`} />In both, changed</li>
                </ul>
                <ul className="space-y-1" aria-label="Changes">
                  {result.changes.map((change) => (
                    <li key={`${change.how}:${change.uid}`}>
                      <button
                        type="button"
                        onClick={() => goTo(change)}
                        aria-current={focus === change.uid ? 'true' : undefined}
                        className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-[var(--pb-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--pb-accent)] ${focus === change.uid ? 'bg-[var(--pb-subtle)]' : ''}`}
                      >
                        <span aria-hidden className={`mt-1.5 size-2.5 shrink-0 rounded-full ${HOW_DOT[change.how]}`} />
                        <span className="min-w-0">
                          <span className="font-medium">{HOW_WORDS[change.how]}</span> {change.label}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>

          <div className="grid min-h-0 min-w-0 flex-1 grid-cols-2 divide-x divide-[var(--pb-border)]">
            <ComparePane
              title={versionTitle}
              paneRef={left}
              nodes={result?.version.nodes ?? []}
              tree={result?.preview.tree ?? null}
              natives={result?.preview.natives ?? null}
              site={editor.site}
              frame={editor.frame}
              phone={phone}
              waiting={result === null}
              error={result?.preview.error ? `This version cannot be drawn: ${result.preview.error.message}` : null}
            />
            <ComparePane
              title="In the editor now"
              paneRef={right}
              nodes={editor.nodes}
              tree={editor.compiled}
              natives={editor.natives}
              site={editor.site}
              frame={editor.frame}
              phone={phone}
              waiting={false}
              error={null}
            />
          </div>
        </div>

        <DialogFooter>
          {!restorable ? <p className="mr-auto self-center text-xs text-[var(--pb-muted)]">The editor holds this version now.</p> : null}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {restorable ? <Button onClick={onRestore}>Put this version in the draft</Button> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One side, drawn section by section the way the canvas draws, scrolling on its own. */
function ComparePane({
  title,
  paneRef,
  nodes,
  tree,
  natives,
  site,
  frame,
  phone,
  waiting,
  error,
}: {
  title: string;
  paneRef: React.RefObject<HTMLDivElement | null>;
  nodes: PmlNode[];
  tree: PmlNode[] | null;
  natives: PmlNativesPayload | null;
  site: PmlSite;
  frame?: CanvasFrame;
  phone: boolean;
  waiting: boolean;
  error: string | null;
}) {
  const outlineKey = JSON.stringify(pageOutline(withDerivedAnchors(tree ?? [])));
  // Stable while the headings are, as on the canvas.
  const outline = useMemo(() => JSON.parse(outlineKey) as ReturnType<typeof pageOutline>, [outlineKey]);

  return (
    <section aria-label={title} className="flex min-h-0 min-w-0 flex-col">
      <h3 className="shrink-0 truncate border-b border-[var(--pb-border)] px-3 py-2 text-xs font-medium text-[var(--pb-muted)]">{title}</h3>
      <div ref={paneRef} className="min-h-0 flex-1 overflow-y-auto bg-[var(--pb-subtle)] p-3">
        {error ? <p className="mb-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</p> : null}
        {waiting ? (
          <p className="px-3 py-10 text-center text-sm text-[var(--pb-muted)]">Drawing this version...</p>
        ) : (
          <div
            className={`relative isolate mx-auto ${phone ? 'max-w-sm' : 'max-w-5xl'} bg-[var(--site-bg)] text-[var(--site-text)] ${frame?.className ?? ''}`}
            style={frame?.style}
          >
            {nodes.map((node, index) => {
              if (isCommentNode(node) || isStudioComment(node)) return null;
              const compiledIndex = nodes.slice(0, index).filter((n) => !isCommentNode(n)).length;
              const preview = tree?.[compiledIndex] ?? null;

              return (
                <div key={node.uid ?? index} data-compare-section={index}>
                  {preview ? (
                    <SectionPreview preview={preview} natives={natives} site={site} mobile={phone} outline={outline} index={index} />
                  ) : (
                    <div className="px-6 py-10 text-center text-sm opacity-40">{node.component ?? node.primitive ?? 'Section'}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
