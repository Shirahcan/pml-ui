'use client';

import React from 'react';

import type { PmlNode } from '../../language';
import type { DocumentFieldsPort } from '../document';
import { DocumentFieldsPanel } from './DocumentFieldsPanel';

/**
 * The document fields a post piece draws, so selecting the piece offers THEM (owner 2026-11-17: "The sections should
 * provide relevant and/or appropriate options/config e.g. cover photo section should allow for easy file upload"). The
 * names are the post document's own fields (the fields port); a field the host's port does not describe is simply not
 * shown, so a product without one never sees an empty control. Pieces not listed here (breadcrumbs, the dates, read
 * time, the reviewer badge) come from the post's history or facts and are not typed.
 */
export const PIECE_FIELDS: Readonly<Record<string, readonly string[]>> = {
  post_title: ['title'],
  post_dek: ['dek'],
  post_author: ['author_name'],
  post_category: ['category_id'],
  post_cover: ['cover'],
  post_tags: ['tags'],
  post_story: ['story_id'],
  post_sources_badge: ['facts'],
  post_cta: ['cta_kind', 'cta_ref'],
};

/** The document fields `node` draws, by its element name. */
export function pieceFieldNames(node: PmlNode | null | undefined): readonly string[] {
  return PIECE_FIELDS[node?.primitive ?? ''] ?? [];
}

/**
 * A piece's own fields at the top of its panel, with the controls and guarded save the Details panel uses (a write over
 * a newer revision is refused with "Load the latest", never a silent overwrite). Keyed by the fields, so selecting
 * another piece reads the post again rather than showing a value another panel has since changed.
 */
export function PieceFieldsPanel({
  node,
  id,
  fields,
  session,
  onSaved,
}: {
  node: PmlNode;
  id: string;
  fields: DocumentFieldsPort;
  session: string;
  onSaved?: (name: string) => void;
}): React.JSX.Element | null {
  const names = pieceFieldNames(node);

  if (names.length === 0) return null;

  return <DocumentFieldsPanel key={`${id}:${names.join(',')}`} id={id} fields={fields} session={session} only={names} label="This element's details" onSaved={onSaved} />;
}
