import type { DocumentVersionChanges } from '../document';

/** What each kind of version is, in the words of the person who made it. */
export const KIND_WORDS: Record<string, string> = {
  published: 'Published',
  before_discard: 'Draft before it was thrown away',
  before_restore: 'Draft before a version was restored',
};

export function versionKind(kind: string): string {
  return KIND_WORDS[kind] ?? 'Earlier version';
}

export function versionWhen(at: string | null): string {
  if (!at) return '';
  const date = new Date(at);

  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

/** "Removed 1 element (the heading “FAQ”)": the server's one sentence, as the start of a line. Empty when nothing changed. */
export function changesSentence(changes: DocumentVersionChanges | null | undefined): string {
  const words = changes?.words?.trim() ?? '';

  return words === '' ? '' : words.charAt(0).toUpperCase() + words.slice(1);
}
