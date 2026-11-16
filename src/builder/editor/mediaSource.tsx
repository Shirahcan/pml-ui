'use client';

import React, { createContext, useContext, type ReactNode } from 'react';

import type { DocumentMediaPort } from '../document';

/** Where the pictures come from (the adapter's media port) and the host's one upload limit (unknown: the server alone decides). */
export interface MediaSource {
  media?: DocumentMediaPort;
  uploadLimit?: { maxMb: number; maxBytes: number; known: boolean } | null;
}

/**
 * Where every MediaField below finds its pictures when it is not handed them (E4a4g): the settings rail mounts image
 * fields deep inside, so the host provides the media port and its upload limit once.
 */
const MediaSourceContext = createContext<MediaSource | null>(null);

export function MediaSourceProvider({ media, uploadLimit, children }: MediaSource & { children: ReactNode }) {
  return <MediaSourceContext.Provider value={{ media, uploadLimit }}>{children}</MediaSourceContext.Provider>;
}

/** The props' source when given, else the provider's; null when neither has a media port. */
export function useMediaSource(props: MediaSource): Required<Pick<MediaSource, 'media'>> & MediaSource | null {
  const context = useContext(MediaSourceContext);
  const source = props.media ? props : context;

  return source?.media ? { media: source.media, uploadLimit: source.uploadLimit ?? null } : null;
}

