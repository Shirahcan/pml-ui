'use client';

import React from 'react';
import { ListRestart } from 'lucide-react';

import { pageOutline, withDerivedAnchors } from '../../pml/anchors';
import type { PmlNode } from '../../pml/primitives';
import { Button } from '../ui/controls';

/**
 * "Rebuild from the headings" for a contents list (owner 2026-11-17, T1: "table of content (with links) ... a container
 * with individual children for easy updates, additions, and removals"). The items stay the author's to add, remove,
 * reorder and rename; this refills them from the page's headings as they stand now (level 2, and level 3 when the list
 * goes that deep), with the same anchors the page draws. It is one edit, so Undo brings the old items back.
 */
export function TocRebuild({ node, pageNodes, onChange }: { node: PmlNode; pageNodes: PmlNode[]; onChange: (next: PmlNode) => void }): React.JSX.Element {
  const depth = String(node.props?.depth ?? '') === '3' ? 3 : 2;
  const entries = pageOutline(withDerivedAnchors(pageNodes)).filter((entry) => entry.level >= 2 && entry.level <= depth);

  return (
    <div className="space-y-1.5">
      <Button
        size="sm"
        variant="outline"
        disabled={entries.length === 0}
        className="whitespace-nowrap outline-none"
        onClick={() =>
          onChange({
            ...node,
            children: entries.map((entry) => ({ primitive: 'toc_item', props: { label: entry.text, target: entry.anchor } }) as PmlNode),
          })
        }
      >
        <ListRestart className="h-4 w-4" />
        Rebuild from the headings
      </Button>
      <p className="text-xs text-[var(--pb-muted)]">
        {entries.length === 0 ? 'The page has no headings to list yet.' : `Replaces the items with the page's ${entries.length} heading${entries.length === 1 ? '' : 's'}. Undo brings the old ones back.`}
      </p>
    </div>
  );
}
