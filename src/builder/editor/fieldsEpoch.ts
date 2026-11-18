import { createContext, useContext } from 'react';

/**
 * Bumped by an editor's `refreshFields()` (2026-11-18, portify-1c: the host's assistant wrote an email's preview text
 * through the fields port and the open inputs kept the old value until a reload): every open fields form under the
 * editor reads the document's fields again. Zero, and never bumped, outside an editor.
 */
export const FieldsEpochContext = createContext(0);

export function useFieldsEpoch(): number {
  return useContext(FieldsEpochContext);
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * A fresh read merged into an open form: every field takes the stored value, except one the person has changed and not
 * saved yet (its value differs from the last one saved), which keeps what they typed, so a refresh never eats typing.
 */
export function mergeFreshRead(current: Record<string, unknown>, saved: Record<string, unknown>, read: Record<string, unknown>): Record<string, unknown> {
  const next = { ...read };

  for (const [name, value] of Object.entries(current)) {
    if (!same(value, saved[name])) next[name] = value;
  }

  return next;
}
