'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { PML_CATALOG_BY_NAME } from './catalog';
import { PRIMITIVES } from './primitives';
import { KNOWN_TAG_NAMES, attributesForTag, enumValuesFor } from './pmlVocabulary';

/** Which language the caret is in: the page's markup or a script. */
export type PmlEditContext = 'pml' | 'psl';

/** What the host's API answers for an inline completion. */
export interface PmlCompleteResult {
  completion: string | null;
}

/**
 * The one call the completion hook makes, supplied by the host (E1: the package never calls a product's API
 * itself). Portify passes its site-builder API, which already has this method.
 */
export interface PmlCompletionApi {
  completePml(pageId: string, prefix: string, suffix: string, context: PmlEditContext): Promise<PmlCompleteResult>;
}

/** How long the caret must rest before an autocomplete request fires. */
const DEBOUNCE_MS = 600;

/** Minimum non-whitespace characters on the caret's line before completing (avoids firing on nothing). */
const MIN_LINE_CONTEXT = 3;

/** Every valid tag name (snake_case): the raw primitives (incl. `script`) + the std-library components. */
const KNOWN_TAGS = new Set<string>([...PRIMITIVES, ...Object.keys(PML_CATALOG_BY_NAME)]);

/**
 * True when a completion coherently CONTINUES what the caret is typing. Guards the one case a weak fast
 * model gets wrong: mid-tag-name, where it may "restart" a DIFFERENT tag (after `<but` it suggested
 * `box`, giving the invalid `<butbox`). When the caret sits right after a partial tag name, the name it
 * continues into must be a real tag - or a prefix of one - else the completion is dropped ("correct or
 * nothing"). Only PML tag names are guarded; PSL and every non-tag position are always coherent here.
 */
export function isCoherentPmlCompletion(prefix: string, completion: string): boolean {
  const m = /<([a-zA-Z][a-zA-Z0-9-]*)$/.exec(prefix);
  if (!m) return true; // the caret is not mid-tag-name

  const norm = (s: string): string => s.toLowerCase().replace(/-/g, '_');
  const partial = norm(m[1]);
  const cont = norm(/^[a-zA-Z0-9-]*/.exec(completion)?.[0] ?? '');
  const candidate = partial + cont;

  for (const tag of KNOWN_TAGS) {
    if (tag.startsWith(candidate)) return true;
  }

  return false;
}

/** True when the caret sits inside an unclosed `"..."` value in the current tag (a free-text position). */
function inUnclosedQuote(tagBody: string): boolean {
  return (tagBody.match(/"/g)?.length ?? 0) % 2 === 1;
}

/**
 * The best deterministic ghost for a partial token: the shortest candidate that starts with it (ties
 * alphabetical), as the REMAINING chars plus a separator (`=` after an attribute name). Null when
 * nothing is typed yet (too ambiguous) or nothing matches - "complete-or-nothing".
 */
function bestCompletion(partial: string, candidates: string[], suffix: string): string | null {
  if (partial.length < 1) return null;

  const p = partial.toLowerCase();
  const matches = candidates.filter((c) => c.toLowerCase().startsWith(p));
  if (matches.length === 0) return null;

  matches.sort((a, b) => a.length - b.length || a.localeCompare(b));
  const ghost = matches[0].slice(partial.length) + suffix;

  return ghost.length > 0 ? ghost : null;
}

/**
 * A DETERMINISTIC completion for the PML tag STRUCTURE at the caret - tag names, attribute names, and
 * enum attribute values - drawn from the real schema ({@see pmlVocabulary}), so it only ever offers a
 * valid token with correct spacing (never a hallucinated attribute/value the way a free-text AI guess
 * can). Returns the ghost text to insert, or NULL for a FREE-TEXT position (a string value, prose
 * between tags, or PSL) - there the caller falls back to the AI completion.
 */
export function structuralCompletionAt(source: string, caret: number): string | null {
  // Structure is PML only; inside a <script> everything is free-text PSL for the AI.
  if (completionContextAt(source, caret) === 'psl') return null;

  const before = source.slice(0, caret);

  // Inside an OPEN tag? The last '<' must be unclosed by a later '>' and not a close tag / comment.
  const lt = before.lastIndexOf('<');
  if (lt < 0 || lt < before.lastIndexOf('>')) return null;
  const tagBody = before.slice(lt);
  if (tagBody.startsWith('</') || tagBody.startsWith('<!')) return null;

  // 1. Tag-name: `<partial` with no whitespace yet.
  const tagNameM = /^<([a-zA-Z][a-zA-Z0-9-]*)$/.exec(tagBody);
  if (tagNameM) return bestCompletion(tagNameM[1], KNOWN_TAG_NAMES, '');

  const nameM = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(tagBody);
  if (!nameM) return null; // `<` alone (no name yet) - too ambiguous to ghost
  const tag = nameM[1].toLowerCase();

  // 2. Enum VALUE inside its quotes (PML v3: every value is quoted), e.g. variant="pri -> mary".
  const valueM = /([a-zA-Z][a-zA-Z0-9-]*)="([a-zA-Z0-9-]*)$/.exec(tagBody);
  if (valueM) {
    const values = enumValuesFor(tag, valueM[1].toLowerCase());
    return values.length > 0 ? bestCompletion(valueM[2], values, '"') : null; // free value -> AI
  }

  // A free-text string value (`attr="...`): leave it to the AI.
  if (inUnclosedQuote(tagBody)) return null;

  // 3. Attribute NAME: after whitespace, a partial name, e.g. `<button la` -> `bel="` (the value goes
  // between the quotes, which the value completion above then closes).
  const attrM = /\s([a-zA-Z][a-zA-Z0-9-]*)$/.exec(tagBody);
  if (attrM) return bestCompletion(attrM[1], attributesForTag(tag), '="');

  return null;
}

/**
 * The caret's language context: inside a `<script>` body it is PSL, otherwise PML. A best-effort
 * lexical scan (the same distinction the highlighter draws) - enough to send the right prompt.
 */
export function completionContextAt(source: string, caret: number): PmlEditContext {
  const open = /<script\b[^>]*>/gi;
  let m: RegExpExecArray | null;

  while ((m = open.exec(source)) !== null) {
    const bodyStart = m.index + m[0].length;
    const closeIdx = source.indexOf('</script', bodyStart);
    const bodyEnd = closeIdx === -1 ? source.length : closeIdx;

    if (caret >= bodyStart && caret <= bodyEnd) return 'psl';
    if (closeIdx === -1) break;

    open.lastIndex = closeIdx;
  }

  return 'pml';
}

/** True when the caret's line has enough typed content to be worth completing. */
function hasEnoughContext(prefix: string): boolean {
  const line = prefix.slice(prefix.lastIndexOf('\n') + 1);

  return line.trim().length >= MIN_LINE_CONTEXT;
}

/**
 * Requests an inline ghost-text completion for the caret: debounced (so it fires on a PAUSE, not every
 * keystroke), min-context gated, and stale-cancelling (a newer edit invalidates an older in-flight
 * request by id, so a slow response never overwrites fresher text). It NEVER throws and never reports
 * to Porter - a failed or empty completion is a non-event, which is the correct UX for autocomplete.
 */
export function usePmlCompletion(
  api: PmlCompletionApi,
  pageId: string,
  source: string,
  caret: number,
  enabled: boolean,
): { suggestion: string | null; clear: () => void } {
  // The AI ghost, stored WITH the inputs it answered: a ghost for any other source / caret / page is
  // simply not shown, so a change drops it immediately with no state to reset.
  const [ai, setAi] = useState<{ pageId: string; source: string; caret: number; text: string } | null>(null);
  // The inputs whose ghost the author dismissed (Esc, typing); nothing shows for them.
  const [dismissed, setDismissed] = useState<{ pageId: string; source: string; caret: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqId = useRef(0);
  // The latest inputs, for clear() (written in an effect, read only in the callback).
  const latest = useRef({ pageId, source, caret });

  useEffect(() => {
    latest.current = { pageId, source, caret };
  }, [pageId, source, caret]);

  const clear = useCallback(() => {
    reqId.current++; // invalidate any in-flight request so its late response is ignored
    setDismissed({ ...latest.current });
  }, []);

  // 1. DETERMINISTIC structure (tag / attribute name / enum value): instant, local, no AI call and no
  //    hallucination - only ever a schema-valid token, so it never needs the coherence guard. Derived
  //    during render: it is a pure function of the source and caret.
  const structural = enabled ? structuralCompletionAt(source, caret) : null;

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    // Any change invalidates the prior in-flight request (its late answer is ignored).
    const myReq = ++reqId.current;

    if (!enabled || structuralCompletionAt(source, caret)) return;

    // 2. FREE TEXT (a string value, prose, or PSL): a debounced AI completion, coherence-guarded.
    const prefix = source.slice(0, caret);
    const suffix = source.slice(caret);

    if (!hasEnoughContext(prefix)) {
      return;
    }

    timer.current = setTimeout(() => {
      const context = completionContextAt(source, caret);

      api
        .completePml(pageId, prefix, suffix, context)
        .then((res) => {
          if (myReq !== reqId.current) return; // stale: the caret / source moved on

          const c = res.completion;
          // Drop an empty completion, or an incoherent mid-tag-name one (PML only) - correct or nothing.
          if (!c || c.length === 0 || (context === 'pml' && !isCoherentPmlCompletion(prefix, c))) {
            return;
          }

          setAi({ pageId, source, caret, text: c });
        })
        .catch(() => {
          // A quiet failure: autocomplete never raises a Porter error.
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [api, pageId, source, caret, enabled]);

  const isCurrent = (x: { pageId: string; source: string; caret: number } | null): boolean =>
    x !== null && x.pageId === pageId && x.caret === caret && x.source === source;

  const aiText = ai !== null && isCurrent(ai) ? ai.text : null;
  const suggestion = !enabled || isCurrent(dismissed) ? null : (structural ?? aiText);

  return { suggestion, clear };
}
