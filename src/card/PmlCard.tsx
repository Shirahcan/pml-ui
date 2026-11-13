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
      await Promise.all(pictures.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))));

      if (!cancelled) {
        setReadyFor(card);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [card]);

  const ready = readyFor === card;

  return (
    <div style={{ width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale, overflow: 'hidden', position: 'relative' }}>
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
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <PmlRenderer nodes={card} site={site} host={host} natives={natives} />
        {overlay ? <CardGuides /> : null}
      </div>
    </div>
  );
}

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
