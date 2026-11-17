'use client';

import React, { type ReactNode } from 'react';

import type { DocumentFieldGroup, DocumentFieldsPort } from '../document';
import { DocumentFieldsPanel } from './DocumentFieldsPanel';

/**
 * One field group's slide-in panel (owner 2026-11-17: every option in a panel over the design): the groups as pills at
 * the top, so a host's menu needs ONE item for all of them, then that group's fields. The host's own `aside` heads the
 * first group, as it heads Details.
 */
export function FieldGroupPanel({
  id,
  fields,
  session,
  groups,
  open,
  onOpen,
  aside,
  onSaved,
}: {
  id: string;
  fields: DocumentFieldsPort | undefined;
  session: string;
  groups: DocumentFieldGroup[];
  open: DocumentFieldGroup;
  onOpen: (key: string) => void;
  aside?: ReactNode;
  /** A field was saved (the canvas compiles again). */
  onSaved?: (name: string) => void;
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      {groups.length > 1 ? (
        <nav aria-label="Details" className="flex flex-wrap gap-1.5">
          {groups.map((group) => (
            <button
              key={group.key}
              type="button"
              aria-current={group.key === open.key ? 'page' : undefined}
              onClick={() => onOpen(group.key)}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium outline-none transition-colors ${
                group.key === open.key ? 'bg-[var(--pb-accent)] text-white' : 'bg-[var(--pb-accent-soft)] text-[var(--pb-text)] hover:opacity-80'
              }`}
            >
              {group.label}
            </button>
          ))}
        </nav>
      ) : null}
      {open.key === groups[0]?.key ? aside : null}
      {fields ? <DocumentFieldsPanel key={open.key} id={id} fields={fields} session={session} group={open.key} label={open.label} onSaved={onSaved} /> : null}
    </div>
  );
}
