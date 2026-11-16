'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Loader2, Trash2, Upload } from 'lucide-react';

import type { DocumentMediaPort } from '../document';
import type { MediaRef } from '../sharing/types';
import { Button } from '../ui/controls';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/overlays';
import { useOwnVars } from '../ui/theme';
import { useBuilderHost } from './host';

/** Where the pictures come from (the adapter's media port) and the host's one upload limit (unknown: the server alone decides). */
export interface MediaSource {
  media: DocumentMediaPort;
  uploadLimit?: { maxMb: number; maxBytes: number; known: boolean } | null;
}

type LibraryQuota = NonNullable<Awaited<ReturnType<DocumentMediaPort['list']>>['quota']>;

/**
 * Pick a picture, or upload one.
 *
 * The value stored in a block is the image's URL, not its id: a published page is a SNAPSHOT.
 *
 * ⚠ Deleting an image from the library DOES break every page that shows it: the host removes
 * the file with its record (Portify removes it server-side), and the picture's address serves only a
 * recorded file. So the picker asks before it deletes and says so plainly; it does not yet know
 * which pages use the image (an open gap, reported 2026-11-14 in Portify).
 */
export function MediaField({
  value,
  onChange,
  media,
  uploadLimit,
}: {
  value: string;
  onChange: (url: string) => void;
} & MediaSource): React.JSX.Element {
  const vars = useOwnVars();
  const [open, setOpen] = useState(false);

  return (
    <>
      {value ? (
        <div className="flex items-start gap-3" style={vars}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a user upload at its own address, not a Next-optimisable asset */}
          <img
            src={value}
            alt=""
            className="h-20 w-20 shrink-0 rounded-xl border border-white/20 object-cover"
          />
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              Change
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onChange('')} className="text-red-600">
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setOpen(true)} className="w-full border-dashed" style={vars}>
          <ImageIcon className="h-4 w-4" />
          Choose an image
        </Button>
      )}

      <MediaPickerDialog
        open={open}
        onOpenChange={setOpen}
        media={media}
        uploadLimit={uploadLimit}
        onSelect={(picked) => {
          onChange(picked.url);
          setOpen(false);
        }}
      />
    </>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
  media: port,
  uploadLimit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (media: MediaRef) => void;
} & MediaSource): React.JSX.Element {
  const host = useBuilderHost();
  const [media, setMedia] = useState<MediaRef[]>([]);
  const [quota, setQuota] = useState<LibraryQuota | null>(null);
  // Has the library loaded once? The spinner covers only the FIRST load; a reopen refreshes in the
  // background behind the list already on screen (no state is set synchronously in the effect).
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  // The image waiting on "Delete it?": a delete removes the file every page using it points at.
  const [confirming, setConfirming] = useState<MediaRef | null>(null);
  const [deleting, setDeleting] = useState(false);
  // ⚠ The confirm hides the picker from assistive technology (aria-hidden) while it is open. If focus is still inside
  // the picker at that moment, the browser refuses the aria-hidden ("Blocked aria-hidden", seen on the test box), so
  // focus leaves the picker BEFORE the confirm opens, and comes back to the same Delete button (or the picker itself,
  // when that image is gone) after it closes.
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const askToDelete = (item: MediaRef, button: HTMLButtonElement) => {
    deleteTrigger.current = button;
    // Whatever holds focus (the button, or the picker itself after an upload) lets go of it.
    if (document.activeElement instanceof HTMLElement && pickerRef.current?.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    setConfirming(item);
  };

  useEffect(() => {
    if (!open) return;

    let alive = true;

    port
      .list()
      .then((data) => {
        if (!alive) return;
        setMedia(data.media);
        setQuota(data.quota ?? null);
      })
      // The host's error surface (Portify's ignores a failed request its own layer already showed).
      .catch((err) => host.onError(err))
      .finally(() => {
        if (alive) setLoaded(true);
      });

    return () => {
      alive = false;
    };
  }, [port, open, host]);

  const loading = open && !loaded;

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Fail fast and locally on the obvious ones, so nobody waits on a large round trip to be
    // told no. The server re-checks all of it regardless.
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      host.onError(
        'An SVG cannot be used on a public page. An SVG is a document that can carry code, not a picture. Please export it as a PNG.',
      );
      event.target.value = '';

      return;
    }

    // The platform's ONE upload limit (documents.max_upload_mb), never a literal here. Until the
    // figure is known the server alone decides, so a stale number never refuses a good file.
    if (uploadLimit?.known && file.size > uploadLimit.maxBytes) {
      // A too-large file is not a failed request, so it goes to the host's error surface, not a dead-end message.
      host.onError(
        `That image is ${formatBytes(file.size)}. Public pages accept images up to ${uploadLimit.maxMb} MB. Resizing it will also make your page load faster.`,
      );
      event.target.value = '';

      return;
    }

    setUploading(true);

    try {
      const uploaded = await port.upload(file);
      setMedia((prev) => [uploaded, ...prev]);
      host.onSuccess('Image uploaded.');
      await refreshQuota();
    } catch (err) {
      // A refused file ("that file is not a real image") carries its real reason.
      host.onError(err);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  // The library's new count after an upload or a delete, so the line under the upload control is never stale.
  const refreshQuota = async () => {
    try {
      setQuota((await port.list()).quota ?? null);
    } catch (err) {
      host.onError(err);
    }
  };

  const remove = async (item: MediaRef) => {
    setDeleting(true);

    try {
      await port.remove(item.id);
      setMedia((prev) => prev.filter((m) => m.id !== item.id));
      host.onSuccess('Image deleted.');
      await refreshQuota();
    } catch (err) {
      host.onError(err);
    } finally {
      setDeleting(false);
      setConfirming(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Bounded to the viewport; the library scrolls in DialogBody, so the upload control and a long library stay reachable on a short screen. */}
      <DialogContent ref={pickerRef} size="2xl">
        <DialogHeader>
          <DialogTitle>Your images</DialogTitle>
          <DialogDescription>
            JPEG, PNG, or WebP{uploadLimit?.known ? `, up to ${uploadLimit.maxMb} MB` : ''}. We re-encode every image, which removes the location data your
            phone attaches to a photo.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 pb-5">
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/30 bg-white/40 px-4 py-6 text-sm outline-none transition hover:bg-white/60">
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span>{uploading ? 'Uploading' : 'Upload an image'}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFile}
            disabled={uploading}
            className="hidden"
          />
        </label>

        {quota ? (
          <p className="text-xs text-[var(--pb-muted)]">
            {quota.files ? `${quota.files.used} of ${quota.files.limit} images, ` : ''}
            {formatBytes(quota.used)} of {formatBytes(quota.limit)} used.
          </p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin opacity-60" />
          </div>
        ) : media.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--pb-muted)]">
            No images yet. Upload one to get started.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {media.map((item) => (
              <div key={item.id} className="group relative">
                <button
                  type="button"
                  aria-label={item.alt ? `Use ${item.alt}` : 'Use this image'}
                  onClick={() => onSelect(item)}
                  className="block w-full overflow-hidden rounded-xl border border-white/20 outline-none transition hover:border-[var(--pb-accent)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a user upload at its own address, not a Next-optimisable asset */}
                  <img
                    src={item.url}
                    alt={item.alt ?? ''}
                    className="aspect-square w-full object-cover"
                  />
                </button>

                <button
                  type="button"
                  aria-label="Delete image"
                  onClick={(event) => askToDelete(item, event.currentTarget)}
                  className="absolute right-1.5 top-1.5 rounded-md bg-white/90 p-1.5 text-red-600 opacity-0 outline-none transition group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        </DialogBody>

        {/* Inside the picker's content, so the picker treats the confirm as its own layer and
            stays open behind it. */}
        <AlertDialog
          open={confirming !== null}
          onOpenChange={(next) => {
            if (!next && !deleting) setConfirming(null);
          }}
        >
          <AlertDialogContent
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              const trigger = deleteTrigger.current;
              deleteTrigger.current = null;
              // After the confirm has fully gone (its aria-hidden on the picker is lifted in the same teardown), so
              // focus never lands inside a hidden picker.
              window.setTimeout(() => (trigger?.isConnected ? trigger : pickerRef.current)?.focus(), 0);
            }}
          >
            <DialogHeader>
              <AlertDialogTitle>Delete this image?</AlertDialogTitle>
              <AlertDialogDescription>
                Any page that shows it will show an empty space instead, including pages that
                are already published. This cannot be undone.
              </AlertDialogDescription>
            </DialogHeader>
            {confirming ? (
              /* eslint-disable-next-line @next/next/no-img-element -- a user upload at its own address, not a Next-optimisable asset */
              <img
                src={confirming.url}
                alt={confirming.alt ?? ''}
                className="h-24 w-24 rounded-xl border border-slate-200 object-cover"
              />
            ) : null}
            <DialogFooter>
              <AlertDialogCancel asChild>
                <Button variant="outline" disabled={deleting}>
                  Keep it
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction
                asChild
                // aria-disabled, NOT disabled: disabling the focused button drops focus to the page, and the picker
                // behind (still hidden by this confirm) then takes it back ("Blocked aria-hidden"). A second press is
                // ignored instead.
                aria-disabled={deleting}
                onClick={(event) => {
                  // Keep the confirm open until the delete answers, so a failure is not hidden.
                  event.preventDefault();
                  if (confirming && !deleting) void remove(confirming);
                }}
              >
                <Button variant="danger" className="aria-disabled:opacity-60">
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Delete image
                </Button>
              </AlertDialogAction>
            </DialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
