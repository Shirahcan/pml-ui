/**
 * A template's example words: a value that is WHOLLY one bracketed example, e.g. "[The direct answer, in under 50
 * words.]" or "[Column]" (owner 2026-11-17: placeholders must never need "tremendous effort to remove or replace").
 * On the canvas such a value is a placeholder: grey, replaced in one go by whatever is typed, and an emptied slot keeps
 * it. The stored PML keeps it until someone writes, so publishing still refuses a part that holds one
 * (pml-kit layout.unfilled).
 */
export function isBracketedExample(value: unknown): boolean {
  return typeof value === 'string' && /^\s*\[[^[\]]+\]\s*$/.test(value);
}
