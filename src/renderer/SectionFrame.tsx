import React, { type ReactNode } from 'react';

import { FRAME_GUTTER, FRAME_MAX_WIDTH, splitSectionFrame } from '../pml/sectionFrame';
import type { PmlNode } from '../pml/primitives';
import { resolvePrimitiveStyle } from '../pml/primitiveStyle';

const TEXT_ALIGN: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/**
 * A top-level node inside its section frame (PML v2 S2a-01): a full-width band (background,
 * vertical rhythm, border) holding a centred container (width, side padding), so nothing renders
 * flush to the edges and backgrounds run edge to edge. Modules, scripts and sticky nodes render as
 * before (see `splitSectionFrame`). Server-renderable: no hooks.
 */
export function SectionFrame({ node, render }: { node: PmlNode; render: (node: PmlNode) => ReactNode }): React.JSX.Element {
  const parts = splitSectionFrame(node);

  if (!parts.framed) {
    return <>{render(node)}</>;
  }

  const band = resolvePrimitiveStyle(parts.band);
  const container = resolvePrimitiveStyle(parts.container);
  const gutter = parts.defaultGutter ? FRAME_GUTTER : '';
  const align = parts.align ? (TEXT_ALIGN[parts.align] ?? '') : '';

  return (
    <div
      // The band and the container are the section's PADDING: a click there lands on no element's content (the
      // builder's canvas reads this to clear a selection, owner 2026-11-18). Inert on a live page.
      data-pml-frame=""
      className={`w-full ${parts.sticky ? 'pml-motion' : ''} ${band.className}`.replace(/\s+/g, ' ').trim()}
      // The shared motion stylesheet makes `.pml-motion[data-motion="sticky"]` sticky: on the band,
      // so the whole full-width bar sticks rather than a column trapped inside it.
      data-motion={parts.sticky ? 'sticky' : undefined}
      // A full-width bar sticks flush to the top (the shared rule's 1rem offset suits a floating card,
      // and would leave a gap above a bar). An inline value outranks the stylesheet rule.
      style={parts.sticky ? { ...band.style, top: 0 } : band.style}
    >
      <div
        data-pml-frame=""
        className={`mx-auto w-full ${FRAME_MAX_WIDTH[parts.width]} ${gutter} ${align} ${container.className}`.replace(/\s+/g, ' ').trim()}
        style={container.style}
      >
        {render(parts.node)}
      </div>
    </div>
  );
}
