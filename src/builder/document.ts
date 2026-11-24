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

/**
 * What the builder shows about the document beside its design. Title, slug and SEO stay in the product's own form,
 * unless the adapter offers `fields` (post layouts C1), which lets the designer show and edit them in place.
 */
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
  /** The library, newest first, and its quota in bytes (with its image count, when the host limits that too). */
  list(): Promise<{ media: MediaRef[]; quota?: { used: number; limit: number; files?: { used: number; limit: number } } | null }>;
  remove(id: string): Promise<void>;
  /**
   * How removing a picture reads, for a library whose removal does NOT empty the pages that show it (a Growth library:
   * the picture leaves the library, and a sent newsletter or a published post keeps showing it). Absent, the picker
   * says what a site's library does: the picture is gone wherever it shows (0.7.85).
   */
  removeWords?: { action: string; title: string; description: string; confirm: string };
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

/** One of a document's own fields, drawn beside or inside its design (post layouts C1, owner 2026-11-16). */
export interface DocumentField {
  /** The product's name for it, as bound parts read it (`title`, `tags`, `read_minutes`). */
  name: string;
  label: string;
  /**
   * `toggle` (pml-email C1a): an on/off setting, such as an email's standard header and footer. `choice` (blog on
   * growth-service S3): one of `options`, such as a post's category or how it ends. A `text` field longer than
   * LONG_TEXT characters is drawn as a box of several lines (a summary), a shorter one as a single line. `rows`
   * (designer sole surface P2b): a list of small records, each drawn with `columns` (a post's facts, its reader
   * questions); its value is the whole array and a write sends the whole array.
   */
  kind: 'text' | 'rich' | 'list' | 'date' | 'media' | 'record' | 'toggle' | 'choice' | 'rows';
  /** Computed by the product (a read time): shown, never edited. */
  readOnly?: boolean;
  /** The limit the builder counts against: characters for text, items for a list. */
  max?: number;
  /** A `choice` field's options; the value written is the option's `value` (`''` is the product's "none"). */
  options?: DocumentFieldOption[];
  /** A `rows` field's columns: text, long text, date or choice. `max` on the field is the number of rows allowed. */
  columns?: DocumentField[];
  /**
   * The panel it is shown in (owner 2026-11-17, "the designer is the sole surface": every option in a slide-in panel).
   * Fields without one are the document's "Details".
   */
  group?: DocumentFieldGroup;
}

export interface DocumentFieldGroup {
  key: string;
  label: string;
  /**
   * The template part these settings belong to (its `part` key: a part's name, whether every document must have it, how
   * many of a repeating part). Owner 2026-11-23: a part's settings are set ON the part, the way a post's cover is, never
   * as a row of tabs in Details. The Studio shows the group when one of that part's elements is selected and keeps it out
   * of the Details panel and the header's menu.
   */
  part?: string;
}

/**
 * A document's layout as the designer guides it (owner 2026-11-17, T2): its parts in order, each a key a node names with
 * `part`, its label, its kind, how many times a repeating part may appear, the rules its words follow, and (for a
 * repeating part) one instance's starter to add another from.
 */
export interface DocumentLayoutPart {
  key: string;
  label: string;
  kind: string;
  min?: number | null;
  max?: number | null;
  rules?: { words?: { min?: number; max?: number }; chars?: { max?: number } } | null;
  starter?: PmlNode[] | null;
  /**
   * The document should not go without it (a post's header, its cover). ADVICE, checked before publishing: the designer
   * still deletes it (owner 2026-11-18: "don't lock any element/component; admins should be able to modify/remove/etc
   * every element"), and undo brings it back.
   */
  required?: boolean;
  /** The template means its shape to stay as designed: a publish check, never a lock in the designer (as `required`). */
  locked?: boolean;
  /**
   * The repeating part this whole block belongs among (growth-service, pml-kit layout.outside_range): after the first
   * instance of that part and no further than just after its last. A post's data table and its mid-post call to action
   * sit among the question sections. ADVICE: the publish checks name a block outside its range; the designer moves it.
   */
  moves_within?: string | null;
}

export interface DocumentLayout {
  key?: string;
  version?: number;
  parts: DocumentLayoutPart[];
}

/**
 * The settings of the template part an element belongs to: the nearest part along its path (the element itself, or the
 * part it sits in), so selecting a question's heading offers its question section's settings. Null when the element is
 * in no part, or the part has no settings group.
 */
export function partGroupAt(nodes: PmlNode[], path: number[], groups: DocumentFieldGroup[]): DocumentFieldGroup | null {
  for (let depth = path.length; depth > 0; depth--) {
    let node: PmlNode | undefined;
    let level: PmlNode[] | undefined = nodes;
    for (const index of path.slice(0, depth)) {
      node = level?.[index];
      level = node?.children;
    }
    const part = typeof node?.part === 'string' ? node.part : null;
    const group = part ? groups.find((candidate) => candidate.part === part) : undefined;
    if (group) return group;
  }

  return null;
}

/** A document's field groups, in the order their fields come (the port lists fields group by group). */
export function fieldGroupsOf(fields: DocumentField[]): DocumentFieldGroup[] {
  const seen = new Map<string, DocumentFieldGroup>();

  for (const field of fields) {
    if (field.group && !seen.has(field.group.key)) seen.set(field.group.key, field.group);
  }

  return [...seen.values()];
}

export interface DocumentFieldOption {
  value: string;
  label: string;
}

/**
 * A document's own fields (title, dek, tags, author, dates, read time, cover...), so the designer shows the WHOLE
 * document, not only its design. A write follows the `saveDraft` rule: a write over a newer revision answers with a
 * conflict, never a silent overwrite.
 */
export interface DocumentFieldsPort {
  describe(id: string): Promise<DocumentField[]>;
  read(id: string): Promise<{ values: Record<string, unknown>; revision: string }>;
  write(id: string, name: string, value: unknown, revision: string, session: string): Promise<SaveDraftResult>;
}

/** One earlier version of a document: a design that went live, or a draft a throw-away or a restore replaced. */
export interface DocumentVersion {
  id: string;
  /** `published`, `before_discard` or `before_restore` (a product may add its own; the panel names the known ones). */
  kind: string;
  title: string | null;
  /** Elements in the design, every level counted. */
  elements: number;
  byName: string | null;
  at: string | null;
  /** The editor holds this version now: restoring it would change nothing. */
  current: boolean;
  /** What changed since the version before it (versions-compare 2026-11-24); null for the first one, absent from older hosts. */
  changes?: DocumentVersionChanges | null;
}

/** What changed between two designs, compared element by element by permanent id: one sentence and its counts. */
export interface DocumentVersionChanges {
  /** "removed 3 elements (the section “FAQ”, ...), changed 1 element"; empty when nothing changed. */
  words: string;
  counts: { added: number; changed: number; removed: number };
}

/** One element that differs: `removed` is in the version and gone from the editor, `added` the other way round. */
export interface DocumentVersionChange {
  uid: string;
  /** The element in words: "heading “Common questions”". */
  label: string;
  how: 'added' | 'changed' | 'removed';
}

/**
 * One version beside the editor's design (versions-compare 2026-11-24, owner: "side-by-side compare"): the version's
 * design and its drawing, and EVERY change between it and the editor.
 */
export interface DocumentVersionCompare {
  version: Omit<DocumentVersion, 'current' | 'changes'> & { nodes: PmlNode[] };
  /** The version drawn the way the canvas draws (a design the document can no longer hold carries its error). */
  preview: DocumentPreview;
  changes: DocumentVersionChange[];
  summary: DocumentVersionChanges;
}

/**
 * A document's earlier versions (plan close-multi-pass-gaps-2026-11-24 P9): the Versions panel lists them, and a restore
 * puts one back in the DRAFT at the editor's revision, never live. A newer draft saved elsewhere answers with a
 * conflict, exactly as a save does.
 */
export interface DocumentVersionsPort {
  list(id: string): Promise<DocumentVersion[]>;
  restore(id: string, versionId: string, revision: string, session: string): Promise<SaveDraftResult>;
  /** One version beside `nodes`, the design in the editor now (saved or not). Without it the panel offers no Compare. */
  compare?(id: string, versionId: string, nodes: PmlNode[]): Promise<DocumentVersionCompare>;
}

/**
 * What the visual editor needs from a host (pml-email C2b): a document it can open, save, compile and check. Publishing,
 * rolling back and a shareable preview link are optional, because some documents have no publish step: an email's
 * saved design IS the email, so its host leaves them out rather than faking them. Every `DocumentAdapter` is one.
 */
export type EditableDocumentAdapter = Pick<DocumentAdapter, 'load' | 'saveDraft' | 'preflight' | 'preview' | 'components' | 'fields'> &
  Partial<Pick<DocumentAdapter, 'publish' | 'unpublish' | 'rollback' | 'previewUrl' | 'code' | 'assistant' | 'versions'>>;

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
  /** The document's own fields, for a product whose documents have them (a blog post's title, tags, read time). */
  fields?: DocumentFieldsPort;
  /** Its earlier versions, for a product that keeps them (a blog post's publishes); absent, the editor offers no Versions. */
  versions?: DocumentVersionsPort;
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
