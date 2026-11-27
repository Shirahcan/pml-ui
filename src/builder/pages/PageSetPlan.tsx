'use client';

import React, { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Loader2, Plus, RotateCcw, Square, Trash2, X } from 'lucide-react';

import { Button, Input, Label } from '../ui/controls';
import { slugFromTitle } from './PageSwitcher';

/**
 * Porter plans a whole landing page from a brief (shared program E4i). Porter PROPOSES the pages; the person edits the
 * proposal here (rename, change an address, change what a page holds, choose the page with the form, mark the
 * thank-you page, reorder, drop, add) and approves it with "Build these pages". Nothing is created before that. Each
 * page is then added and built one at a time by the host, as an ordinary Build on that page's own console, so a failed
 * page never undoes the others and shows "Try again". Stop ends the run after the page being built.
 *
 * The host owns every call (planning on its worker, adding a page, the Build and its polling); this file holds only the
 * proposal and the order of work, so any product with a document set can use it.
 */
export interface ProposedPage {
  title: string;
  address: string;
  purpose: string;
  holds: string[];
  form: boolean;
  thank_you: boolean;
}

export interface PageSetProposal {
  summary: string;
  pages: ProposedPage[];
  form_on_first_page: boolean;
  question: { text: string; options: string[]; recommended: number } | null;
}

export type PageBuildResult = { ok: true; message?: string } | { ok: false; message: string };

export interface PageSetPlanPort {
  /** Porter's proposal for the brief (the host runs it on its worker and resolves when it lands). */
  plan(brief: string, answers?: string[]): Promise<PageSetProposal>;
  /** Add this page and build it; resolves when its Build has finished. `signal` aborts when the person presses Stop. */
  buildPage(page: ProposedPage, proposal: PageSetProposal, signal: AbortSignal): Promise<PageBuildResult>;
  /** After every page was built: for example send the form to the thank-you page. */
  finish?(proposal: PageSetProposal, built: ProposedPage[]): Promise<void>;
}

type PageStatus = 'waiting' | 'building' | 'done' | 'failed' | 'stopped';
type Phase = 'brief' | 'planning' | 'proposal' | 'building' | 'done';

const STATUS_WORDS: Record<PageStatus, string> = { waiting: 'Waiting', building: 'Building', done: 'Built', failed: 'Not built', stopped: 'Not started' };

function blankPage(n: number): ProposedPage {
  return { title: `New page ${n}`, address: `new-page-${n}`, purpose: '', holds: [], form: false, thank_you: false };
}

/** The form on at most ONE page, and never on the thank-you page. */
function withForm(pages: ProposedPage[], index: number | null): ProposedPage[] {
  return pages.map((p, i) => ({ ...p, form: i === index && !p.thank_you }));
}

export function PageSetPlan({ port, onBuilt }: { port: PageSetPlanPort; onBuilt?: () => void }): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>('brief');
  const [brief, setBrief] = useState('');
  const [proposal, setProposal] = useState<PageSetProposal | null>(null);
  const [status, setStatus] = useState<Record<number, { s: PageStatus; message?: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  // What each page came to, read after the loop (state updates are not visible inside it).
  const done = useRef<Record<number, PageStatus>>({});

  const ask = async (answers?: string[]) => {
    setPhase('planning');
    setError(null);
    try {
      const next = await port.plan(brief.trim(), answers);
      setProposal(next);
      setPhase('proposal');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('brief');
    }
  };

  const edit = (index: number, change: Partial<ProposedPage>) =>
    setProposal((p) => (p ? { ...p, pages: p.pages.map((page, i) => (i === index ? { ...page, ...change } : page)) } : p));
  const move = (index: number, by: -1 | 1) =>
    setProposal((p) => {
      if (!p || index + by < 0 || index + by >= p.pages.length) return p;
      const pages = [...p.pages];
      [pages[index], pages[index + by]] = [pages[index + by], pages[index]];
      return { ...p, pages };
    });
  const drop = (index: number) => setProposal((p) => (p ? { ...p, pages: p.pages.filter((_, i) => i !== index) } : p));
  const add = () => setProposal((p) => (p ? { ...p, pages: [...p.pages, blankPage(p.pages.length + 1)] } : p));
  const formOn = (index: number | null) =>
    setProposal((p) => (p ? { ...p, pages: withForm(p.pages, index), form_on_first_page: index === null } : p));

  /** Build the pages in order from `from`; a failure is recorded and the next page still builds. */
  const build = async (only: number | null = null) => {
    if (!proposal) return;
    const controller = new AbortController();
    abort.current = controller;
    setPhase('building');
    const order = only === null ? proposal.pages.map((_, i) => i) : [only];
    if (only === null) {
      done.current = {};
      setStatus(Object.fromEntries(proposal.pages.map((_, i) => [i, { s: 'waiting' as PageStatus }])));
    }

    for (const i of order) {
      if (controller.signal.aborted) {
        done.current[i] = 'stopped';
        setStatus((s) => ({ ...s, [i]: { s: 'stopped' } }));
        continue;
      }
      setStatus((s) => ({ ...s, [i]: { s: 'building' } }));
      let result: PageBuildResult;
      try {
        result = await port.buildPage(proposal.pages[i], proposal, controller.signal);
      } catch (e) {
        result = { ok: false, message: e instanceof Error ? e.message : String(e) };
      }
      done.current[i] = result.ok ? 'done' : 'failed';
      setStatus((s) => ({ ...s, [i]: result.ok ? { s: 'done', message: result.message } : { s: 'failed', message: result.message } }));
    }

    abort.current = null;
    setPhase('done');
    const built = proposal.pages.filter((_, i) => done.current[i] === 'done');
    if (port.finish && built.length > 0 && !controller.signal.aborted) {
      try {
        await port.finish(proposal, built);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
    onBuilt?.();
  };

  if (phase === 'brief' || phase === 'planning') {
    return (
      <div className="pml-page-set-plan space-y-3">
        <Label htmlFor="pml-page-set-brief">What should the landing page hold?</Label>
        <textarea
          id="pml-page-set-brief"
          className="w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-text)] px-3 py-2 text-sm outline-none focus:border-[var(--pb-accent)]"
          rows={5}
          value={brief}
          placeholder="For example: a page for our spring webinar with what it is, who it is for, the agenda, common questions and a thank-you page."
          onChange={(e) => setBrief(e.target.value)}
          disabled={phase === 'planning'}
        />
        <p className="text-xs text-[var(--pb-muted)]">I will propose the pages first. Nothing is created until you choose Build these pages.</p>
        {error ? <p role="alert" className="text-sm text-[var(--pb-danger)]">{error}</p> : null}
        <div className="flex justify-end">
          <Button type="button" onClick={() => void ask()} disabled={phase === 'planning' || brief.trim().length < 3}>
            {phase === 'planning' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {phase === 'planning' ? 'Planning the pages...' : 'Plan the pages'}
          </Button>
        </div>
      </div>
    );
  }

  if (!proposal) return <></>;

  if (proposal.question && proposal.pages.length === 0) {
    const q = proposal.question;
    return (
      <div className="pml-page-set-plan space-y-3">
        <p className="text-sm text-[var(--pb-text)]">{q.text}</p>
        <div className="space-y-2">
          {q.options.map((option, i) => (
            <button
              key={option}
              type="button"
              onClick={() => void ask([`${q.text} ${option}`])}
              className="block w-full whitespace-nowrap rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-text)] px-3 py-2 text-left text-sm outline-none hover:border-[var(--pb-accent)]"
            >
              {option}
              {i === q.recommended ? <span className="ml-2 text-xs text-[var(--pb-muted)]">(recommended)</span> : null}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const editing = phase === 'proposal';
  const formIndex = proposal.pages.findIndex((p) => p.form);

  return (
    <div className="pml-page-set-plan space-y-4">
      {proposal.summary ? <p className="text-sm text-[var(--pb-text)]">{proposal.summary}</p> : null}

      {editing ? (
        <div className="space-y-1.5">
          <Label htmlFor="pml-page-set-form">The sign-up form goes on</Label>
          <select
            id="pml-page-set-form"
            className="w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-text)] px-3 py-2 text-sm outline-none"
            value={formIndex < 0 ? 'first' : String(formIndex)}
            onChange={(e) => formOn(e.target.value === 'first' ? null : Number(e.target.value))}
          >
            <option value="first">The first page (as it is now)</option>
            {proposal.pages.map((p, i) => (p.thank_you ? null : <option key={i} value={i}>{p.title}</option>))}
          </select>
        </div>
      ) : null}

      <ol className="space-y-3" aria-label="Proposed pages">
        {proposal.pages.map((page, i) => {
          const st = status[i];
          return (
            <li key={i} className="rounded-2xl border border-[var(--pb-border)] bg-[var(--pb-surface)] p-3">
              {editing ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`pml-psp-title-${i}`}>Title</Label>
                      <Input id={`pml-psp-title-${i}`} value={page.title} onChange={(e) => edit(i, { title: e.target.value, address: page.address || slugFromTitle(e.target.value) })} />
                    </div>
                    <div className="flex shrink-0 gap-1 pt-6">
                      <Button type="button" variant="ghost" size="icon" aria-label={`Move ${page.title} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Move ${page.title} down`} disabled={i === proposal.pages.length - 1} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Leave out ${page.title}`} onClick={() => drop(i)}><Trash2 className="h-4 w-4 text-[var(--pb-danger)]" /></Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`pml-psp-address-${i}`}>Address</Label>
                    <Input id={`pml-psp-address-${i}`} value={page.address} onChange={(e) => edit(i, { address: slugFromTitle(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`pml-psp-holds-${i}`}>What it holds (one per line)</Label>
                    <textarea
                      id={`pml-psp-holds-${i}`}
                      rows={Math.max(2, page.holds.length)}
                      className="w-full rounded-xl border border-[var(--pb-border)] bg-[var(--pb-surface)] text-[var(--pb-text)] px-3 py-2 text-sm outline-none"
                      value={page.holds.join('\n')}
                      onChange={(e) => edit(i, { holds: e.target.value.split('\n') })}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-[var(--pb-text)]">
                    <input type="checkbox" checked={page.thank_you} onChange={(e) => edit(i, { thank_you: e.target.checked, form: e.target.checked ? false : page.form })} />
                    Send people here after they send the form (a thank-you page)
                  </label>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--pb-text)]">{page.title}</p>
                    <p className="text-xs text-[var(--pb-muted)]">/{page.address}{page.form ? ' · has the form' : ''}{page.thank_you ? ' · thank-you page' : ''}</p>
                    {st?.message ? <p className={`mt-1 text-xs ${st.s === 'failed' ? 'text-[var(--pb-danger)]' : 'text-[var(--pb-muted)]'}`}>{st.message}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--pb-muted)]">
                    {st?.s === 'building' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    {st?.s === 'done' ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : null}
                    {st?.s === 'failed' ? <X className="h-4 w-4 text-[var(--pb-danger)]" aria-hidden /> : null}
                    <span>{STATUS_WORDS[st?.s ?? 'waiting']}</span>
                    {phase === 'done' && (st?.s === 'failed' || st?.s === 'stopped') ? (
                      <Button type="button" variant="outline" size="sm" onClick={() => void build(i)}>
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {editing ? (
        <div className="flex flex-wrap justify-between gap-2">
          <Button type="button" variant="outline" onClick={add}><Plus className="h-4 w-4" aria-hidden /> Add a page</Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setPhase('brief')}>Change the brief</Button>
            <Button type="button" disabled={proposal.pages.length === 0 || proposal.pages.some((p) => p.title.trim() === '' || p.address === '')} onClick={() => void build()}>
              Build these pages
            </Button>
          </div>
        </div>
      ) : null}

      {phase === 'building' ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => abort.current?.abort()}>
            <Square className="h-3.5 w-3.5" aria-hidden /> Stop after this page
          </Button>
        </div>
      ) : null}
      {error ? <p role="alert" className="text-sm text-[var(--pb-danger)]">{error}</p> : null}
    </div>
  );
}
