'use client';

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * What the product hosting the builder tells it once (shared program E4a4b): the assistant's name, so a label can
 * say "Porter's note" in Portify and "Mira's note" in MployNow without the package naming either, and where an error
 * the person must see goes (`onError`: Portify passes its error surface; E4a4c moves the panels onto it).
 *
 * ⚠ `onError` is for errors that are NOT a failed host request (a clipboard refusal, a file too large); the host's
 * own request layer already reports those.
 */
export interface BuilderHost {
  /** The assistant's name as the product's screens use it. Unset: labels name no one ("Note", "The proposed version"). */
  assistantName?: string;
  /** Show an error to the person. Default: the console, so nothing is swallowed while a host has not wired one. */
  onError: (error: unknown) => void;
}

const DEFAULT_HOST: BuilderHost = {
  onError: (error) => {
    console.error(error);
  },
};

const HostContext = createContext<BuilderHost>(DEFAULT_HOST);

export function BuilderHostProvider({ assistantName, onError, children }: Partial<BuilderHost> & { children: ReactNode }) {
  const host = useMemo<BuilderHost>(() => ({ assistantName, onError: onError ?? DEFAULT_HOST.onError }), [assistantName, onError]);

  return <HostContext.Provider value={host}>{children}</HostContext.Provider>;
}

export function useBuilderHost(): BuilderHost {
  return useContext(HostContext);
}

/** "Porter's note" with a name, `fallback` without one. */
export function assistantsLabel(name: string | undefined, thing: string, fallback: string): string {
  const trimmed = name?.trim();

  return trimmed ? `${trimmed}'s ${thing}` : fallback;
}
