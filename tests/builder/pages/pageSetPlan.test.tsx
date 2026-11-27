import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { PageSetPlan, type PageBuildResult, type PageSetPlanPort, type PageSetProposal, type ProposedPage } from '../../../src/builder/pages/PageSetPlan';

const PROPOSAL: PageSetProposal = {
  summary: 'A webinar landing page with its agenda and a thank-you page.',
  pages: [
    { title: 'Agenda', address: 'agenda', purpose: 'What it covers.', holds: ['the talks'], form: false, thank_you: false },
    { title: 'Questions', address: 'questions', purpose: 'Common questions.', holds: ['three questions'], form: false, thank_you: false },
    { title: 'Thank you', address: 'thank-you', purpose: 'Confirm the sign-up.', holds: ['what happens next'], form: false, thank_you: true },
  ],
  form_on_first_page: true,
  question: null,
};

function port(build: (page: ProposedPage, signal: AbortSignal) => Promise<PageBuildResult> = async () => ({ ok: true })) {
  return {
    plan: vi.fn(async () => structuredClone(PROPOSAL)),
    buildPage: vi.fn(async (page: ProposedPage, _p: PageSetProposal, signal: AbortSignal) => build(page, signal)),
    finish: vi.fn(async () => undefined),
  } satisfies PageSetPlanPort;
}

async function planned(p: PageSetPlanPort) {
  render(<PageSetPlan port={p} />);
  fireEvent.change(screen.getByLabelText('What should the landing page hold?'), { target: { value: 'Our spring webinar' } });
  fireEvent.click(screen.getByRole('button', { name: 'Plan the pages' }));
  await screen.findByText(PROPOSAL.summary);
}

describe('PageSetPlan', () => {
  it('creates nothing until Build these pages, then builds the edited pages in order', async () => {
    const p = port();
    await planned(p);
    expect(p.buildPage).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Title', { selector: '#pml-psp-title-0' }), { target: { value: 'The agenda' } });
    fireEvent.click(screen.getByRole('button', { name: 'Leave out Questions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Build these pages' }));

    await waitFor(() => expect(p.finish).toHaveBeenCalled());
    expect(p.buildPage.mock.calls.map((c) => c[0].title)).toEqual(['The agenda', 'Thank you']);
    expect(screen.getAllByText('Built')).toHaveLength(2);
  });

  it('puts the form on one page only, never the thank-you page', async () => {
    const p = port();
    await planned(p);
    const select = screen.getByLabelText('The sign-up form goes on') as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(['The first page (as it is now)', 'Agenda', 'Questions']);

    fireEvent.change(select, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Build these pages' }));
    await waitFor(() => expect(p.buildPage).toHaveBeenCalledTimes(3));
    expect(p.buildPage.mock.calls.map((c) => c[0].form)).toEqual([false, true, false]);
    expect(p.buildPage.mock.calls[0][1].form_on_first_page).toBe(false);
  });

  it('a failed page does not stop the others and can be tried again', async () => {
    let fail = true;
    const p = port(async (page) => (page.title === 'Questions' && fail ? { ok: false, message: 'I could not build that page.' } : { ok: true }));
    await planned(p);
    fireEvent.click(screen.getByRole('button', { name: 'Build these pages' }));

    await screen.findByText('I could not build that page.');
    await waitFor(() => expect(p.buildPage).toHaveBeenCalledTimes(3));
    expect(screen.getAllByText('Built')).toHaveLength(2);

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }));
    await waitFor(() => expect(screen.getAllByText('Built')).toHaveLength(3));
    expect(p.buildPage.mock.calls.at(-1)![0].title).toBe('Questions');
  });

  it('Stop ends the run after the page being built', async () => {
    let release: () => void = () => undefined;
    const p = port((page) => (page.title === 'Agenda' ? new Promise((r) => { release = () => r({ ok: true }); }) : Promise.resolve({ ok: true })));
    await planned(p);
    fireEvent.click(screen.getByRole('button', { name: 'Build these pages' }));

    fireEvent.click(await screen.findByRole('button', { name: /Stop after this page/ }));
    release();

    await waitFor(() => expect(screen.getAllByText('Not started')).toHaveLength(2));
    expect(p.buildPage).toHaveBeenCalledTimes(1);
    expect(p.finish).not.toHaveBeenCalled();
  });

  it('an unclear brief shows one question with its recommended option, and an answer plans again', async () => {
    const p = port();
    p.plan.mockResolvedValueOnce({ summary: '', pages: [], form_on_first_page: true, question: { text: 'One event or a series?', options: ['One event', 'A series'], recommended: 1 } });
    render(<PageSetPlan port={p} />);
    fireEvent.change(screen.getByLabelText('What should the landing page hold?'), { target: { value: 'Webinars' } });
    fireEvent.click(screen.getByRole('button', { name: 'Plan the pages' }));

    expect(await screen.findByText('(recommended)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /A series/ }));
    await screen.findByText(PROPOSAL.summary);
    expect(p.plan).toHaveBeenLastCalledWith('Webinars', ['One event or a series? A series']);
  });
});
