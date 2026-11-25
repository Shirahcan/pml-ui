import { describe, expect, it } from 'vitest';

import { PROFILE_KEYS } from '../../src/pml/elements.generated';
import { draftsFor, onlyPieces, pieceOf, piecesOf } from '../../src/pml/profiles';
import type { PmlNode } from '../../src/pml/primitives';

const piece = (primitive: string): PmlNode => ({ primitive }) as PmlNode;
const post = piecesOf('post');

/**
 * A document's pieces come from pml-kit's profiles (shared PML Studio P1b): the same answers PostProfile gives on the
 * server (PostProfileTest), so the Studio, the console and Porter never disagree about a post's title.
 */
describe('profile pieces', () => {
  it('only a post has pieces; a page, an email, a card and a component have none', () => {
    expect([...PROFILE_KEYS].sort()).toEqual(['card', 'component', 'email', 'page', 'post']);
    expect(piecesOf('page')).toEqual({});
    expect(piecesOf('email')).toEqual({});
    expect(piecesOf('component')).toEqual({});
    expect(pieceOf(post, piece('post_title'))).toEqual({ fields: ['title'], quickEdit: 'title', drafts: ['title', 'meta_title', 'focus_keyword'] });
    expect(pieceOf(post, piece('post_cover'))?.fields).toEqual(['cover']);
    expect(pieceOf(post, piece('heading'))).toBeUndefined();
    expect(pieceOf(piecesOf('page'), piece('post_title'))).toBeUndefined();
  });

  it("a block made only of pieces is the document's details; a note pinned inside does not make it design", () => {
    const opening = { primitive: 'box', children: [{ comment: 'Check the date', note: { id: 'n1' } }, piece('post_date'), piece('post_author')] } as unknown as PmlNode;

    expect(onlyPieces(post, piece('post_cover'))).toBe(true);
    expect(onlyPieces(post, opening)).toBe(true);
    expect(onlyPieces(post, { primitive: 'box', children: [piece('post_title'), piece('p')] } as PmlNode)).toBe(false);
    expect(onlyPieces(post, { primitive: 'box', children: [] } as PmlNode)).toBe(false);
    expect(onlyPieces(piecesOf('page'), piece('post_title'))).toBe(false);
  });

  it('an aimed ask drafts the pieces it holds, and the search details too for the whole opening', () => {
    expect(draftsFor(post, piece('post_title'))).toEqual(['title', 'meta_title', 'focus_keyword']);
    expect(draftsFor(post, piece('post_cover'))).toEqual([]);
    expect(draftsFor(post, { primitive: 'post_header', children: [piece('post_title'), piece('post_dek'), piece('post_author')] } as PmlNode)).toEqual([
      'title',
      'meta_title',
      'focus_keyword',
      'dek',
      'answer',
      'meta_description',
      'secondary_keywords',
    ]);
    expect(draftsFor(piecesOf('page'), piece('post_title'))).toEqual([]);
  });
});
