'use client';

import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

import { Button, Input } from '../ui/controls';
import { useOwnVars } from '../ui/theme';
import { MediaPickerDialog } from './MediaPicker';
import { useMediaSource, type MediaSource } from './mediaSource';

export { MediaSourceProvider, type MediaSource } from './mediaSource';

/** Where the pictures come from (the adapter's media port) and the host's one upload limit (unknown: the server alone decides). */

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
  const source = useMediaSource({ media, uploadLimit });

  // No media library in this host: the author can still give a picture by its address.
  if (!source) {
    return <Input aria-label="Image address" name="image-address" type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://" style={vars} />;
  }

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
        media={source.media}
        uploadLimit={source.uploadLimit}
        onSelect={(picked) => {
          onChange(picked.url);
          setOpen(false);
        }}
      />
    </>
  );
}

export { MediaPickerDialog } from './MediaPicker';
