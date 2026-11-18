'use client';

import React from 'react';

import { pieceOf, type PmlNode, type ProfilePieces } from '../../language';
import type { DocumentFieldsPort } from '../document';
import { DocumentFieldsPanel } from './DocumentFieldsPanel';

/**
 * The document fields a piece draws, so selecting the piece offers THEM (owner 2026-11-17: "The sections should provide
 * relevant and/or appropriate options/config e.g. cover photo section should allow for easy file upload"). Which piece
 * binds to which field is the document's PROFILE (pml-kit, through the generated module), never a list kept here: a
 * post's title edits `title`, a page has no pieces. A field the host's port does not describe is simply not shown, so a
 * product without one never sees an empty control; a piece with no fields (the dates, read time, a badge) shows a value
 * the document keeps and is not typed.
 */
export function pieceFieldNames(pieces: ProfilePieces, node: PmlNode | null | undefined): readonly string[] {
  return pieceOf(pieces, node)?.fields ?? [];
}

/**
 * A piece's own fields at the top of its panel, with the controls and guarded save the Details panel uses (a write over
 * a newer revision is refused with "Load the latest", never a silent overwrite). Keyed by the fields, so selecting
 * another piece reads the post again rather than showing a value another panel has since changed.
 */
export function PieceFieldsPanel({
  node,
  pieces,
  id,
  fields,
  session,
  onSaved,
}: {
  node: PmlNode;
  /** The document's pieces (its profile's). */
  pieces: ProfilePieces;
  id: string;
  fields: DocumentFieldsPort;
  session: string;
  onSaved?: (name: string) => void;
}): React.JSX.Element | null {
  const names = pieceFieldNames(pieces, node);

  if (names.length === 0) return null;

  return <DocumentFieldsPanel key={`${id}:${names.join(',')}`} id={id} fields={fields} session={session} only={names} label="This element's details" onSaved={onSaved} />;
}
