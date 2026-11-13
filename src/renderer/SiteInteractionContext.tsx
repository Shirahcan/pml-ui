'use client';

import React, { createContext, useContext } from 'react';

/**
 * The seam between a block and the world.
 *
 * Some blocks are interactive: a contact form sends a message, a package card starts an
 * intake, Porter answers a question. Those blocks render in TWO places, and the difference
 * is not cosmetic:
 *
 *   - On the PUBLIC page, they must really do the thing.
 *   - On the BUILDER canvas, they must not. A consultant dragging a contact form around
 *     should not be able to file a lead against themselves, and a half-built page should
 *     never open a real case.
 *
 * The wrong fix is a `preview` boolean that every block remembers to check, because one
 * block will forget and the failure is silent. So instead the CAPABILITY itself is absent:
 * the builder simply never provides a handler, the block sees `null`, and it renders an
 * honest disabled state. A block cannot forget to be inert, because it has nothing to call.
 */

export interface SiteLeadPayload {
  name: string;
  email: string;
  phone?: string;
  message: string;
  consent: boolean;
  /** Set by the block when a page is dedicated to one package. */
  package_id?: string | null;
}

/**
 * What a preview's send answers: nothing went anywhere. A preview is where a page is TRIED, so its forms
 * are filled in and sent like the live page's, and only the sending itself is held back (owner
 * 2026-11-11: "previews shouldn't disable any element ... only form submissions should be
 * disabled/suppressed"). The capability is still PRESENT, so a block cannot forget to be honest about
 * it: the answer tells it nothing was sent, and it says so in place of its thank-you.
 */
export const NOT_SENT_IN_PREVIEW = 'not_sent_in_preview' as const;

/** What a block shows when a preview's send held the message back. */
export const PREVIEW_NOT_SENT_NOTE = 'This is a preview, so nothing was sent.';

export interface SiteInteractions {
  /** Provided on the public page (phase 11c) and in previews (sends nothing). Absent in the builder. */
  submitLead?: (payload: SiteLeadPayload) => Promise<void | typeof NOT_SENT_IN_PREVIEW>;
  /**
   * Submit a custom `form` primitive. Provided on the public page and in previews (sends nothing), absent
   * in the builder (so a form is an honest disabled preview on the canvas). `data` is the field values
   * keyed by the field `name`, plus `consent` when the form shows a consent notice. Part F.
   */
  submitForm?: (formKey: string, data: Record<string, unknown>) => Promise<void | typeof NOT_SENT_IN_PREVIEW>;
  /**
   * Provided on the public page (phase 10e). Absent in the builder.
   *
   * Package ids are UUID STRINGS (custom_service_packages uses uuids). This was
   * `number | null` once, and the blocks coerced with `Number(pkg.id)` — which is NaN
   * for every real id, so every "Get started" click silently started a package-LESS
   * intake and the confirm step refused it (found in the 2026-07-14 browser e2e).
   */
  startIntake?: (packageId: string | null) => void;
}

const SiteInteractionContext = createContext<SiteInteractions>({});

export function SiteInteractionProvider({
  value,
  children,
}: {
  value: SiteInteractions;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <SiteInteractionContext.Provider value={value}>{children}</SiteInteractionContext.Provider>
  );
}

export function useSiteInteractions(): SiteInteractions {
  return useContext(SiteInteractionContext);
}

/**
 * A preview's capabilities: forms send nothing and say so. Starting an intake stays absent, because it
 * opens a real case for a real person, which no preview should do.
 */
const PREVIEW_INTERACTIONS: SiteInteractions = {
  submitForm: async () => NOT_SENT_IN_PREVIEW,
  submitLead: async () => NOT_SENT_IN_PREVIEW,
};

/** Around a page or component PREVIEW (never the builder canvas, never a live page). */
export function PreviewInteractionsProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <SiteInteractionContext.Provider value={PREVIEW_INTERACTIONS}>{children}</SiteInteractionContext.Provider>;
}
