import React from 'react';

import type { PmlNode } from '../pml/primitives';
import type { PmlNativesPayload } from '../pml/expressions';
import { PmlRenderer, type PmlHost, type PmlSite } from '../renderer/PmlRenderer';
import {
  CARD_HEIGHT,
  CARD_READY_ATTRIBUTE,
  CARD_SAFE_MARGIN,
  CARD_TYPE_SCALE,
  CARD_WIDTH,
  CARD_X_DOMAIN_BAND,
  cardNodes,
} from './cardFrame';

/**
 * A social card: a PML card document drawn by the SAME renderer as pages, inside a fixed 1200x630 frame (shared
 * program E1b). The builder's live preview, the unfurl previews and the published picture all come from here, so
 * there is no second renderer to drift.
 *
 * Once the card's fonts and pictures have loaded, the frame carries `data-card-ready="true"`, which the snapshot
 * (ai-service `POST /v1/render/snapshot`) waits for before it takes the picture.
 */
export function PmlCard({
  nodes,
  site,
  host,
  natives = null,
  scale = 1,
  overlay = false,
  selectable = false,
  decorative = false,
  className,
  style,
}: {
  nodes: PmlNode[];
  site: PmlSite;
  /** The product's own elements (its pinned identity line) and error sink, as for a page. */
  host?: PmlHost;
  natives?: PmlNativesPayload | null;
  /** 1 for the real card; smaller for a thumbnail or a preview (the card is drawn at full size, then scaled). */
  scale?: number;
  /** The builder's guides: the safe margin and the band X writes the domain over. */
  overlay?: boolean;
  /** The card canvas (E4c): marks each part's card path (`i.j`) so a click selects it. Off for a real card. */
  selectable?: boolean;
  /** A preview of the card in a builder (a thumbnail, the canvas): hidden from screen readers, whose own words describe it (the alt text, the parts list). Never on the real card. */
  decorative?: boolean;
  /** The product's theme and fonts for this card (classes and CSS variables), as its pages get them. */
  className?: string;
  style?: React.CSSProperties;
}): React.JSX.Element {
  const frame = React.useRef<HTMLDivElement>(null);
  const card = React.useMemo(() => cardNodes(nodes), [nodes]);
  const [readyFor, setReadyFor] = React.useState<PmlNode[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    // Waits on the browser (fonts, image decoding), an outside system, so this is effect work.
    void (async () => {
      const fonts = typeof document !== 'undefined' ? (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts : undefined;
      await fonts?.ready;
      const pictures = Array.from(frame.current?.querySelectorAll('img') ?? []);
      // LOADED, not merely finished: a picture that failed is `complete` too (with no pixels), and counting it as
      // ready let a snapshot store a card without its logo (found 2026-11-16, on a box whose API host the snapshot
      // browser could not reach). A picture that fails leaves the card NOT ready, so the snapshot reports not_ready
      // and the last good picture keeps serving instead of a broken one being stored.
      const loaded = await Promise.all(
        pictures.map((img) => (img.complete ? Promise.resolve(img.naturalWidth > 0) : img.decode().then(() => true, () => false))),
      );

      if (!cancelled && loaded.every(Boolean)) {
        setReadyFor(card);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [card]);

  const ready = readyFor === card;

  return (
    <div aria-hidden={decorative ? true : undefined} style={{ width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale, overflow: 'hidden', position: 'relative' }}>
      <div
        ref={frame}
        data-pml-card=""
        {...{ [CARD_READY_ATTRIBUTE]: ready ? 'true' : undefined }}
        className={className}
        style={{
          ...style,
          // Card-sized type, whatever the page theme's own scale is (see CARD_TYPE_SCALE).
          ['--site-type-scale' as string]: CARD_TYPE_SCALE,
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <style>{CARD_FILL_CSS}</style>
        {selectable ? (
          // The canvas: each top-level part under its own root, so every mark IS the part's card path (`i.j.k`). The
          // DOM is the same as the single renderer below (each part still draws one element at the frame's top level).
          card.map((node, index) => <PmlRenderer key={index} nodes={[node]} site={site} host={host} natives={natives} pathRoot={[index]} />)
        ) : (
          <PmlRenderer nodes={card} site={site} host={host} natives={natives} />
        )}
        {overlay ? <CardGuides /> : null}
      </div>
    </div>
  );
}

/**
 * A card is ONE frame, not a page: its top-level box fills the 1200x630 frame exactly, and the box's own `justify`
 * places the words (the headline card centres them, the photo card sets them at the bottom). On a page a box is a
 * band (holding `min_height`) around a centred column (holding `justify`), so the column is only as tall as its
 * words and a `min_height: lg` band is 640 px: centred words sat at the top and the band spilled out of the card.
 * Here the band and its column stretch to the frame instead, and the band's page-sized minimum is dropped.
 * Scoped to the card frame; pages are untouched.
 */
const CARD_FILL_CSS =
  '[data-pml-card]>*:not(style):not([data-card-guides]){flex:1 1 auto;min-height:0!important;display:flex;flex-direction:column}' +
  '[data-pml-card]>*:not(style):not([data-card-guides])>*{flex:1 1 auto;display:flex;flex-direction:column}' +
  '[data-pml-card]>*:not(style):not([data-card-guides])>*>*{flex:1 1 auto}';

/** The safe margin and X's domain band, drawn over the card in the builder only. */
function CardGuides(): React.JSX.Element {
  return (
    <div aria-hidden="true" data-card-guides="" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: CARD_SAFE_MARGIN, border: '1px dashed rgba(67, 97, 238, 0.7)' }} />
      <div
        style={{
          position: 'absolute',
          left: CARD_X_DOMAIN_BAND.left,
          top: CARD_X_DOMAIN_BAND.top,
          width: CARD_X_DOMAIN_BAND.width,
          height: CARD_X_DOMAIN_BAND.height,
          background: 'rgba(239, 68, 68, 0.12)',
        }}
      />
    </div>
  );
}
