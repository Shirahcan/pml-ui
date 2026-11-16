import type { PmlCompleteResult, PmlEditContext } from '../pml/completion';
import type { PmlDiagnostic } from '../pml/diagnostics';
import type { PmlNativesPayload } from '../pml/expressions';
import type { PmlNode } from '../pml/primitives';
import type { DocumentComponentsPort } from './components';
import type { CardMediaPort, CardPort, CardRef, MediaRef } from './sharing/types';

/**
 * The DocumentAdapter (shared program E4a1): the ONLY way the builder reads and writes a document, so the same builder
 * runs on Portify's site pages, growth-service's posts and landing pages, and any product after them. Drafted in
 * Portify's docs/plans/shared-console-and-growth-2026-11-12/E0_AUDIT.md with portify-78's review.
 *
 * Errors: a call that fails throws with the real reason; the builder hands it to the host's `onError`. A save or a
 * publish that lost a race is NOT an error: it answers `{ conflict }` and the builder offers "Keep mine" / "Load
 * theirs" (the no-silent-overwrite rule, owner 2026-11-13).
 */

/** The design the builder edits: the PML node tree, and the document's own options. */
export interface PmlDocument {
  nodes: PmlNode[];
  options?: Record<string, unknown>;
}

/** What the builder shows about the document beside its design. Title, slug and SEO stay in the product's own form. */
export interface DocumentMeta {
  title: string;
  slug: string | null;
  status: 'draft' | 'published' | 'scheduled' | (string & {});
  publishedAt: string | null;
  /** The draft differs from what the public sees. */
  hasUnpublishedChanges: boolean;
  /** The public address once published. */
  publicUrl: string | null;
}

/** A save or publish refused because the document changed somewhere else since this editor loaded it. */
export interface DocumentConflict {
  message: string;
  /** Who saved the newer version and when, when the product knows. */
  by: string | null;
  at: string | null;
  /**
   * The newer version's revision, when the product returns it (E4a2b). "Keep mine" saves FROM it, which is what makes
   * the author's choice to overwrite stick; without it the retry would be refused again.
   */
  revision?: string | null;
}

/**
 * One finding before publishing. `source` says which check found it: the product's rule pack (`pack`, e.g. CICC
 * compliance), its own readiness checks (`readiness`, e.g. a blog post's), or the social card (`card`).
 */
export interface DocumentFinding {
  source: 'pack' | 'readiness' | 'card' | 'structure' | (string & {});
  severity: 'block' | 'warn' | 'info';
  rule: string;
  message: string;
  excerpt: string | null;
  /** A better wording, when the check offers one. */
  suggestion: string | null;
}

export interface DocumentPreflight {
  /** False when any finding blocks, or when a check that must run could not. */
  mayPublish: boolean;
  findings: DocumentFinding[];
  /**
   * A check that should have run did not (an AI review unavailable), so findings may be missing: the builder says so
   * beside them rather than implying the copy was fully checked (E4a2b).
   */
  incomplete?: boolean;
}

export type SaveDraftResult = { revision: string } | { conflict: DocumentConflict };

/** What is left before a document may go live: placeholders an author has not replaced yet (a picture, a line). */
export interface DocumentPlaceholders {
  message: string;
  total: number;
  pictures: number;
  other: number;
  /** Up to three of the notes, word for word. */
  examples: string[];
}

/**
 * A publish answers; it does not throw for a reason the author can act on. `refused`: a check that must pass did not
 * (the findings say why). `placeholders`: the design still shows placeholders. `conflict`: someone saved since (E4a2a).
 */
export type PublishResult =
  | { published: true; url: string | null; card?: CardRef | null; warning?: string | null }
  | { scheduled: string }
  | { conflict: DocumentConflict }
  | { refused: DocumentPreflight }
  | { placeholders: DocumentPlaceholders };

/**
 * The canvas's compile: the host's own compiled tree for the design, what its `{...}` expressions read, and a located
 * error that keeps the last good compile on screen rather than blanking it.
 */
export interface DocumentPreview {
  tree: PmlNode[];
  natives: PmlNativesPayload | null;
  error: { message: string; path: string } | null;
}

/** The media port: the card's `upload`, plus the library the builder's pickers list and prune. */
export interface DocumentMediaPort extends CardMediaPort {
  list(): Promise<{ media: MediaRef[]; quota?: { used: number; limit: number } | null }>;
  remove(id: string): Promise<void>;
}

/** The code pane: the document as PML text and back. Code that does not read yet is an answer, never a throw. */
export interface DocumentCodePort {
  source(id: string): Promise<string>;
  parse(id: string, source: string): Promise<PmlNode[]>;
  parseLive(id: string, source: string): Promise<{ nodes: PmlNode[] | null; error: string | null }>;
  /** The code's problems, located (no model call; safe on a debounce). Absent, the pane shows parse errors only. */
  diagnose?(id: string, source: string): Promise<PmlDiagnostic[]>;
}

/** The assistant's whole-source edit. `source` null with `unavailable` false and `changed` false is a refusal (`reply` says why). */
export interface CodeEditResult {
  source: string | null;
  unavailable: boolean;
  reason?: string | null;
  reply?: string | null;
  changed?: boolean;
}

export interface CodeSelectionEditResult {
  replacement: string | null;
  unavailable: boolean;
}

export interface CodeScaffoldResult {
  block: string | null;
  unavailable: boolean;
  refused: boolean;
  reason: string | null;
}

/**
 * The code pane's assistant (E4a4f1). OPTIONAL on the adapter: a product without one omits it and the pane hides these
 * actions. Every call is one the author asked for (an instruction, a comment to fill, a resting caret), never a timer.
 * Each answer is a PROPOSAL the pane shows as a diff; nothing reaches the document until the author accepts it.
 */
export interface DocumentCodeAssistant {
  edit(id: string, instruction: string, source: string): Promise<CodeEditResult>;
  editSelection(id: string, instruction: string, source: string, selection: string): Promise<CodeSelectionEditResult>;
  scaffold(id: string, comment: string, source: string, context: PmlEditContext): Promise<CodeScaffoldResult>;
  complete(id: string, prefix: string, suffix: string, context: PmlEditContext): Promise<PmlCompleteResult>;
}

export interface DocumentAdapter {
  load(id: string): Promise<{ document: PmlDocument; revision: string; meta: DocumentMeta }>;
  /** `session` names this editor, so its own earlier saves never count as someone else's. */
  saveDraft(id: string, document: PmlDocument, revision: string, session: string): Promise<SaveDraftResult>;
  preflight(id: string): Promise<DocumentPreflight>;
  /**
   * `at` schedules it (a product that cannot schedule publishes now). `session` names this editor, as on saveDraft, so a
   * draft someone ELSE saved since `revision` is refused with a conflict instead of going live unseen (E4a2a).
   */
  publish(id: string, revision: string, options?: { at?: string; session?: string }): Promise<PublishResult>;
  unschedule?(id: string): Promise<void>;
  unpublish(id: string): Promise<void>;
  /** Back to the last published version. */
  rollback(id: string): Promise<{ revision: string }>;
  /** A signed, short-lived address that shows the draft to someone without an account. */
  previewUrl(id: string): Promise<string>;
  /** The canvas's compile of a design (the current one, or a proposal Porter has not applied yet). */
  preview(id: string, nodes: PmlNode[]): Promise<DocumentPreview>;
  code: DocumentCodePort;
  media: DocumentMediaPort;
  /** The code pane's assistant; absent, the pane offers no assistant actions (E4a4f1). */
  assistant?: DocumentCodeAssistant;
  /** The "Add a section" menu's partials and library, for a product that has them. */
  components?: DocumentComponentsPort;
  /** The social card, for a product that publishes one. */
  card?: CardPort;
  /** The console's subject for this document (shared console C3/C4). */
  consoleSubject(id: string): { kind: string; id: string };
}

/** True when a save or publish answered with a conflict rather than a result. */
export function isConflict(result: SaveDraftResult | PublishResult): result is { conflict: DocumentConflict } {
  return typeof result === 'object' && result !== null && 'conflict' in result;
}

/** True when a publish was refused by a check that must pass. */
export function isRefused(result: PublishResult): result is { refused: DocumentPreflight } {
  return typeof result === 'object' && result !== null && 'refused' in result;
}

/** True when a publish was held back because the design still shows placeholders. */
export function isPlaceholders(result: PublishResult): result is { placeholders: DocumentPlaceholders } {
  return typeof result === 'object' && result !== null && 'placeholders' in result;
}
