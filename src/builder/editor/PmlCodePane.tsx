'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';

import type { PmlNode } from '../../language';
import type { PmlCompletionApi, PmlEditContext } from '../../pml/completion';
import { usePmlDiagnostics, type PmlDiagnosticsApi } from '../../pml/diagnostics';
import type { DocumentAdapter } from '../document';
import { Button } from '../ui/controls';
import { COPILOT_HISTORY_LIMIT, CopilotBox, DEFAULT_COPILOT_HISTORY_KEY, loadCopilotHistory, persistCopilotHistory } from './codeCopilot';
import { assistantsLabel, useBuilderHost } from './host';
import { PmlCodeEditor, type PmlCodeEditorHandle } from './PmlCodeEditor';
import { PmlDiffView } from './PmlDiffView';
import { PmlProblemsPanel } from './PmlProblemsPanel';

/**
 * The code pane (shared program E4a4f3, from Portify): the document as PML source. Apply parses it through the host's
 * save gate and hands back the nodes, so Visual and Code share one tree; a failure shows its located reason inline and
 * applies nothing. The assistant's edits arrive as a diff in the editor frame, and nothing changes until accepted.
 */
export function PmlCodePane({
  pageId,
  adapter,
  onApply,
  onCancel,
  historyKey = DEFAULT_COPILOT_HISTORY_KEY,
}: {
  pageId: string;
  /** The document's adapter: its code port, and its assistant when the host has one (absent, no assistant actions). */
  adapter: Pick<DocumentAdapter, 'code'> & Partial<Pick<DocumentAdapter, 'assistant'>>;
  onApply: (nodes: PmlNode[]) => void;
  onCancel: () => void;
  /** The localStorage prefix for prompt history, so a host keeps the history its people already have. */
  historyKey?: string;
}): React.JSX.Element {
  const host = useBuilderHost();
  const name = host.assistantName?.trim() || undefined;
  // How the pane names the assistant in a sentence: its name, or "the assistant" ("The assistant" to start one).
  const assistantPhrase = name ?? 'the assistant';
  const who = name ?? 'The assistant';
  const assistant = adapter.assistant;
  const code = adapter.code;
  const diagnoseApi = useMemo<PmlDiagnosticsApi>(() => ({ diagnosePml: async (id, text) => ({ diagnostics: (await code.diagnose?.(id, text)) ?? [] }) }), [code]);
  const completionApi = useMemo<PmlCompletionApi | undefined>(
    () => (assistant ? { completePml: (id, prefix, suffix, context) => assistant.complete(id, prefix, suffix, context) } : undefined),
    [assistant],
  );
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The the assistant copilot: describe a change, the assistant rewrites the source above (review, then Apply).
  const [instruction, setInstruction] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantNotice, setAssistantNotice] = useState<string | null>(null);
  // the assistant's proposed rewrite, awaiting review. It is shown as a diff; Accept sets the buffer, Discard
  // drops it. `source` never changes until the consultant accepts, so an AI edit is never silent.
  const [proposal, setProposal] = useState<string | null>(null);
  // Shell-style prompt history: past submitted instructions, browsable with Up/Down. `draft` holds
  // the in-progress text while browsing, so Down past the newest entry restores it.
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  // Live diagnostics: the Code view is already Scale-gated (the pane only mounts for a Scale
  // consultant), so this rides that gate - no new flag. Enabled once the source has loaded.
  const editorRef = useRef<PmlCodeEditorHandle>(null);
  const { diagnostics } = usePmlDiagnostics(diagnoseApi, pageId, source, !loading && typeof code.diagnose === 'function');

  useEffect(() => {
    let alive = true;

    code
      .source(pageId)
      .then((text) => {
        if (alive) setSource(text);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load this page as PML.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [code, pageId]);

  // Rehydrate the prompt history for this page (survives reloads, and re-syncs if the page changes
  // without a remount). Resets the browsing cursor so Up starts from the newest saved prompt. Done
  // during render against the last-seen page (history is only read by key handlers, never painted,
  // and loadCopilotHistory is SSR-safe), so it needs no effect.
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  if (historyFor !== pageId) {
    setHistoryFor(pageId);
    setHistory(loadCopilotHistory(historyKey, pageId));
    setHistoryIndex(null);
    setDraft('');
  }

  const apply = async () => {
    setApplying(true);
    setError(null);

    try {
      const nodes = await code.parse(pageId, source);
      onApply(nodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This PML could not be applied. Check it and try again.');
    } finally {
      setApplying(false);
    }
  };

  // Ask the assistant to rewrite the whole page from the current source + an instruction. On success the new
  // source is held as a `proposal` and shown as a diff; the buffer only changes if the consultant
  // Accepts, and nothing is saved until they review it and click Apply.
  const askAssistant = async () => {
    if (!assistant) return;
    const text = instruction.trim();
    if (text.length < 3 || assistantBusy || loading) return;

    // Submit: record it in history (skip an immediate duplicate), persist it so it survives a reload,
    // clear the box, and exit browsing.
    const nextHistory = (history[history.length - 1] === text ? history : [...history, text]).slice(
      -COPILOT_HISTORY_LIMIT,
    );
    setHistory(nextHistory);
    persistCopilotHistory(historyKey, pageId, nextHistory);
    setInstruction('');
    setHistoryIndex(null);
    setDraft('');

    setAssistantBusy(true);
    setAssistantNotice(null);
    setError(null);

    try {
      const result = await assistant.edit(pageId, text, source);

      if (result.unavailable || !result.source) {
        setAssistantNotice(`${who} could not update the code just now. Your code is untouched; try again in a moment or rephrase.`);
        return;
      }

      setProposal(result.source);
    } catch (err) {
      // An API failure is surfaced in the assistant by the interceptors; keep the pane as-is.
      host.onError(err);
    } finally {
      setAssistantBusy(false);
    }
  };

  // Cmd-K selection edit: the assistant rewrites ONLY the selected fragment (whole source as context), then
  // the replacement is spliced back into the buffer at the range and shown as the SAME diff the
  // copilot uses. Nothing changes until Accept; Apply re-validates the spliced whole.
  const handleSelectionEdit = async (
    selectionText: string,
    range: { start: number; end: number },
    instruction: string,
  ) => {
    if (!assistant) return;
    if (assistantBusy) return;

    setAssistantBusy(true);
    setAssistantNotice(null);
    setError(null);

    try {
      const result = await assistant.editSelection(pageId, instruction, source, selectionText);

      if (result.unavailable || !result.replacement) {
        setAssistantNotice(`${who} could not rewrite that selection just now. Your code is untouched; try again or rephrase.`);
        return;
      }

      const candidate = source.slice(0, range.start) + result.replacement + source.slice(range.end);
      setProposal(candidate);
    } catch (err) {
      host.onError(err);
    } finally {
      setAssistantBusy(false);
    }
  };

  // Scaffold from a comment: the ✨ pill hands up a comment line's instruction + language context.
  // the assistant drafts the block (gated); it is inserted on a NEW LINE BELOW the comment (the comment is
  // kept as documentation), then shown as the SAME diff. Nothing changes until Accept; Apply
  // re-validates the spliced whole. Refused / unavailable surface as the pane's soft notice.
  const handleScaffold = async ({ line, comment, context }: { line: number; comment: string; context: PmlEditContext }) => {
    if (!assistant) return;
    if (assistantBusy) return;

    setAssistantBusy(true);
    setAssistantNotice(null);
    setError(null);

    try {
      const result = await assistant.scaffold(pageId, comment, source, context);

      if (result.refused) {
        setAssistantNotice(result.reason ?? `${who} could not scaffold that safely. Try wording the comment differently.`);
        return;
      }

      if (result.unavailable || !result.block) {
        setAssistantNotice(`${who} could not scaffold that just now. Your code is untouched; try again in a moment.`);
        return;
      }

      // Insert the block on a new line just after the comment line's text (before its newline), so the
      // comment stays above its generated code.
      const lines = source.split('\n');
      const idx = Math.min(Math.max(line - 1, 0), lines.length - 1);
      let offset = 0;
      for (let i = 0; i < idx; i++) offset += lines[i].length + 1;
      offset += lines[idx].length;

      setProposal(source.slice(0, offset) + '\n' + result.block + source.slice(offset));
    } catch (err) {
      host.onError(err);
    } finally {
      setAssistantBusy(false);
    }
  };

  // "Fix with the assistant" from an error line's gutter: reuse the whole-page copilot with a composed
  // instruction so the assistant fixes JUST that error with full page context, previewed via the SAME diff.
  const handleFixError = async (line: number, message: string) => {
    if (!assistant) return;
    if (assistantBusy) return;

    setAssistantBusy(true);
    setAssistantNotice(null);
    setError(null);

    try {
      const result = await assistant.edit(
        pageId,
        `Fix the error on line ${line}: ${message}. Change ONLY what is needed to fix this error and keep everything else exactly as it is.`,
        source,
      );

      if (result.unavailable || !result.source) {
        setAssistantNotice(`${who} could not fix that just now. Your code is untouched; try again in a moment.`);
        return;
      }

      setProposal(result.source);
    } catch (err) {
      host.onError(err);
    } finally {
      setAssistantBusy(false);
    }
  };

  // Enter submits; Shift+Enter is a newline. Up/Down browse prompt history, but only when the caret
  // is on the first/last line, so they still move within a multi-line draft.
  const onInstructionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void askAssistant();
      return;
    }

    const el = e.currentTarget;

    if (e.key === 'ArrowUp' && history.length > 0) {
      const caretOnFirstLine = !el.value.slice(0, el.selectionStart).includes('\n');
      if (!caretOnFirstLine) return;
      e.preventDefault();
      if (historyIndex === null) setDraft(instruction);
      const next = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(next);
      setInstruction(history[next]);
      return;
    }

    if (e.key === 'ArrowDown' && historyIndex !== null) {
      const caretOnLastLine = !el.value.slice(el.selectionStart).includes('\n');
      if (!caretOnLastLine) return;
      e.preventDefault();
      if (historyIndex >= history.length - 1) {
        setHistoryIndex(null);
        setInstruction(draft);
      } else {
        const next = historyIndex + 1;
        setHistoryIndex(next);
        setInstruction(history[next]);
      }
      return;
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Code view</h2>
          <p className="text-xs text-[var(--pb-muted)]">
            Edit your page as PML. Apply to update the canvas; nothing changes until you do.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={applying}
            className="whitespace-nowrap outline-none"
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void apply()}
            disabled={applying || loading}
            className="whitespace-nowrap outline-none"
          >
            {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Apply
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-300/60 bg-red-50/70 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin opacity-60" />
        </div>
      ) : (
        <>
          <PmlCodeEditor
            ref={editorRef}
            value={source}
            onChange={setSource}
            diagnostics={diagnostics}
            onSelectionEdit={assistant ? (text, range, instruction) => void handleSelectionEdit(text, range, instruction) : undefined}
            onScaffold={assistant ? (params) => void handleScaffold(params) : undefined}
            onFixError={assistant ? (line, message) => void handleFixError(line, message) : undefined}
            pageId={pageId}
            completionApi={completionApi}
            completionEnabled={!loading}
            className="h-[60vh]"
            // the assistant's proposed change is reviewed INSIDE the editor frame (same box, same size), not in
            // a duplicate panel stacked above it. Accept sets the buffer; nothing is saved until Apply.
            reviewOverlay={
              proposal !== null ? (
                <PmlDiffView
                  before={source}
                  after={proposal}
                  title={assistantsLabel(name, 'proposed change', 'Proposed change')}
                  className="h-full rounded-none border-0 bg-white/95 shadow-none backdrop-blur"
                  onAccept={() => {
                    setSource(proposal);
                    setProposal(null);
                    setAssistantNotice(null);
                  }}
                  onDiscard={() => setProposal(null)}
                />
              ) : undefined
            }
          />
          <div className="mt-3">
            <PmlProblemsPanel
              diagnostics={diagnostics}
              onJump={(line, col) => editorRef.current?.jumpTo(line, col)}
            />
          </div>
        </>
      )}

      {!loading && assistant ? (
        <CopilotBox
          assistant={assistantPhrase}
          value={instruction}
          onChange={(text) => {
            setInstruction(text);
            if (historyIndex !== null) setHistoryIndex(null);
          }}
          onKeyDown={onInstructionKeyDown}
          busy={assistantBusy}
          canSend={!assistantBusy && !applying && instruction.trim().length >= 3}
          onSend={() => void askAssistant()}
          notice={assistantNotice}
        />
      ) : null}
    </div>
  );
}
