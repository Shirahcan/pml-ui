import type { PmlNode } from '../../pml/primitives';

/**
 * The social card as the builder sees it (shared program E4b), the TypeScript side of the E0 DocumentAdapter's
 * `card` and `media` ports. The PHP twin of `CardRef` is what `Shirahcan\Pml\Card\CardPublisher::publish()` returns.
 */

/** The published card picture: what a shared link unfurls with right now. */
export interface CardRef {
  /** Absolute https address of the stored picture; null when none was ever drawn. */
  url: string | null;
  width: number;
  height: number;
  /** `image/png` or `image/jpeg`. */
  type: string | null;
  alt: string;
  hash: string;
  /** `rendered`: current. `pending`: the new card is waiting to be drawn. `failed`: it could not be, see `error`. */
  status: 'rendered' | 'pending' | 'failed';
  error: string | null;
}

/** The person's own picture, already cropped to 1.91:1 and stored through the media port. */
export interface CardPicture {
  mediaId: string;
  url: string;
  width: number;
  height: number;
}

/**
 * The card document. `nodes` is what the card will be drawn from, composed and guarded by the SERVER (the automatic
 * card from the page's facts, the person's own picture as its background, or their design), so the builder draws
 * exactly what will be published and never composes a second copy of its own.
 */
export interface CardDoc {
  source: 'automatic' | 'designed' | 'picture';
  nodes: PmlNode[];
  picture?: CardPicture | null;
  alt?: string | null;
}

/** What the builder saves: the server recomposes `nodes` from it. */
export type CardDocChange =
  | { source: 'automatic'; alt?: string | null }
  | { source: 'picture'; picture: CardPicture; alt?: string | null }
  | { source: 'designed'; nodes: PmlNode[]; alt?: string | null };

/** A stored media file. */
export interface MediaRef {
  id: string;
  url: string;
  width?: number;
  height?: number;
  mime?: string;
  bytes?: number;
}

/** The adapter's `card` port (E0_AUDIT): errors throw with the real reason. */
export interface CardPort {
  load(id: string): Promise<CardDoc | null>;
  save(id: string, card: CardDocChange): Promise<void>;
  previewUrl(id: string): Promise<string>;
}

/** The part of the adapter's `media` port the card uses. */
export interface CardMediaPort {
  upload(file: File): Promise<MediaRef>;
}

/** The words and address a link unfurls with, from the live draft (no render). */
export interface UnfurlFacts {
  title: string;
  description: string;
  /** The page's public address. */
  url: string;
  /** The domain the networks print, e.g. `example.com`. */
  domain: string;
  /** `og:site_name`, which Slack prints above the title. */
  siteName?: string;
}
