'use client';

import React from 'react';
import { Code2, FileText, Layers3, Link2, Redo2, RotateCcw, Send, ShieldCheck, Undo2 } from 'lucide-react';

import { Button } from '../ui/controls';
import type { PageEditorControls } from './PageEditor';

/** The editor's own header when the host does not draw the controls in its chrome. */
export function PageEditorHeader({ controls }: { controls: PageEditorControls }): React.JSX.Element {
  const status = controls.publishing ? 'Publishing' : controls.saving ? 'Saving draft' : controls.dirty ? 'Unsaved changes' : 'Draft up to date';

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-xs text-[var(--pb-muted)]" aria-live="polite">
        {status}
      </span>
      <Button size="icon" variant="ghost" aria-label="Undo" disabled={!controls.canUndo} onClick={controls.undo}>
        <Undo2 />
      </Button>
      <Button size="icon" variant="ghost" aria-label="Redo" disabled={!controls.canRedo} onClick={controls.redo}>
        <Redo2 />
      </Button>
      {controls.fieldGroups.length > 0
        ? controls.fieldGroups.map((group) => (
            <Button key={group.key} size="sm" variant="outline" onClick={() => controls.openPanel(`group:${group.key}`)}>
              <FileText />
              {group.label}
            </Button>
          ))
        : controls.hasDetails ? (
            <Button size="sm" variant="outline" onClick={() => controls.openPanel('details')}>
              <FileText />
              Details
            </Button>
          ) : null}
      {controls.hostPanels.map((hosted) => (
        <Button key={hosted.key} size="sm" variant="outline" onClick={() => controls.openPanel(`host:${hosted.key}`)}>
          {hosted.title}
        </Button>
      ))}
      <Button size="sm" variant="outline" onClick={() => controls.openPanel('layers')}>
        <Layers3 />
        Layers
      </Button>
      {controls.toggleCode ? (
        <Button size="sm" variant="outline" aria-pressed={controls.view === 'code'} onClick={controls.toggleCode}>
          <Code2 />
          {controls.view === 'code' ? 'Back to the design' : 'Code'}
        </Button>
      ) : null}
      <Button size="sm" variant="outline" onClick={controls.check}>
        <ShieldCheck />
        Run the checks
      </Button>
      {controls.unpublish ? (
        <Button size="sm" variant="outline" onClick={controls.unpublish}>
          Unpublish
        </Button>
      ) : null}
      {controls.copyPreviewLink ? (
        <Button size="sm" variant="outline" onClick={controls.copyPreviewLink}>
          <Link2 />
          Copy preview link
        </Button>
      ) : null}
      {controls.rollback ? (
        <Button size="sm" variant="outline" onClick={controls.rollback}>
          <RotateCcw />
          Throw away the draft
        </Button>
      ) : null}
      <Button size="sm" onClick={controls.publish} disabled={controls.publishing}>
        <Send />
        Publish
      </Button>
    </div>
  );
}
