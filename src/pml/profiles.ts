import { POST_OPENING_DRAFTS, PROFILE_PIECES, type PmlProfilePiece, type ProfileKey } from './elements.generated';
import { isCommentNode } from './nodeTree';
import type { PmlNode } from './primitives';

/**
 * A document's pieces (shared PML Studio P1b): the elements whose words are the DOCUMENT's own fields (a post's title,
 * its cover), read from pml-kit's profiles through the generated module. The Studio and the hosts' consoles ask these
 * helpers, never a list of their own, so what a piece edits and what an aimed ask drafts has one authority.
 */
export type ProfilePieces = Readonly<Record<string, PmlProfilePiece>>;

/** A purpose's pieces (a page, an email and a card have none). */
export function piecesOf(profile: ProfileKey): ProfilePieces {
  return PROFILE_PIECES[profile];
}

/** The piece this node is, or undefined when it is design (an element, a component, a comment). */
export function pieceOf(pieces: ProfilePieces, node: PmlNode | null | undefined): PmlProfilePiece | undefined {
  const name = node?.primitive ?? '';

  return name !== '' && Object.prototype.hasOwnProperty.call(pieces, name) ? pieces[name] : undefined;
}

/**
 * Whether a block shows only the document's details: a piece, or a block whose children are all such blocks (a post's
 * opening). A comment pinned inside is the author's note, never an element, so it does not count (pml-kit
 * PostProfile::onlyPieces, the same rule).
 */
export function onlyPieces(pieces: ProfilePieces, node: PmlNode | null | undefined): boolean {
  if (!node) return false;
  if (pieceOf(pieces, node)) return true;

  const children = (node.children ?? []).filter((child) => !isCommentNode(child));

  return children.length > 0 && children.every((child) => onlyPieces(pieces, child));
}

/**
 * The details an ask aimed at this block drafts, in the order its pieces appear: each drafting piece's own, and a post's
 * search details too when it holds two or more of them (the whole opening). Empty when it holds none (pml-kit
 * PostProfile::draftsFor).
 */
export function draftsFor(pieces: ProfilePieces, node: PmlNode | null | undefined): string[] {
  if (!node) return [];

  const primitives: string[] = [];
  const walk = (n: PmlNode) => {
    primitives.push(n.primitive ?? '');
    for (const child of n.children ?? []) walk(child);
  };
  walk(node);

  const fields: string[] = [];
  for (const primitive of primitives) {
    const piece = Object.prototype.hasOwnProperty.call(pieces, primitive) ? pieces[primitive] : undefined;
    fields.push(...(piece?.drafts ?? []));
  }

  const drafting = Object.keys(pieces).filter((name) => pieces[name].drafts !== undefined);
  if (fields.length > 0 && drafting.filter((name) => primitives.includes(name)).length > 1) {
    fields.push(...POST_OPENING_DRAFTS);
  }

  return [...new Set(fields)];
}
