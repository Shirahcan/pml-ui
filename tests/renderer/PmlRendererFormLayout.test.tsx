import React from 'react';
import { render } from '@testing-library/react';

import { PmlRenderer } from '../../src/renderer/PmlRenderer';
import type { PmlSite as PublicSite } from '../../src/renderer/PmlRenderer';
import type { PmlNode } from '../../src/pml/primitives';

/**
 * A form's `layout` (2026-11-08). A mirrored hero's ask box (one box to write in, a round arrow
 * button inside it) became a full labelled form with a full-width Send button, so the copy looked
 * nothing like its source. `prompt` and `inline` draw the compact shapes; `stacked` stays as it was.
 */
const site = { theme: {} } as unknown as PublicSite;

function form(layout?: string): PmlNode {
  return {
    primitive: 'form',
    props: { key: 'ask', submit_label: 'Find talent', consent_notice: 'You agree to be contacted.', ...(layout ? { layout } : {}) },
    children: [
      { primitive: 'field', props: { name: 'role', label: 'The role you want to fill', kind: 'textarea' } },
      { primitive: 'field', props: { name: 'email', label: 'Your email', kind: 'email', required: true } },
    ],
  };
}

function renderForm(layout?: string) {
  return render(<PmlRenderer nodes={[form(layout)]} site={site} />).container;
}

describe('PmlRenderer form layouts', () => {
  it('draws a prompt as one box with a round send button inside it, named for screen readers', () => {
    const c = renderForm('prompt');
    const send = c.querySelector('button[type="submit"]');

    expect(send).not.toBeNull();
    expect(send!.getAttribute('aria-label')).toBe('Find talent');
    expect(send!.textContent).toBe('');
    // The button sits in the same box as the fields.
    expect(send!.parentElement!.querySelector('textarea')).not.toBeNull();
    // Labels stay for screen readers and show as placeholders.
    expect(c.querySelector('textarea')!.getAttribute('placeholder')).toBe('The role you want to fill');
    expect(c.querySelector('label span.sr-only')!.textContent).toBe('The role you want to fill');
    expect(c.querySelector('input[type="email"]')!.getAttribute('placeholder')).toBe('Your email');
    // The consent checkbox is still there.
    expect(c.querySelector('input[name="consent"]')).not.toBeNull();
  });

  it('draws inline fields and a worded button on one line', () => {
    const c = renderForm('inline');
    const send = c.querySelector('button[type="submit"]');

    expect(send!.textContent).toBe('Find talent');
    expect(send!.parentElement!.querySelector('input[type="email"]')).not.toBeNull();
    expect(c.querySelector('label span.sr-only')).not.toBeNull();
  });

  it('keeps the stacked form exactly as before when no layout is given', () => {
    const c = renderForm();
    const send = c.querySelector('button[type="submit"]');

    expect(send!.textContent).toBe('Find talent');
    expect(send!.className).toContain('w-full');
    expect(c.querySelector('label span.sr-only')).toBeNull();
    expect(c.querySelector('textarea')!.getAttribute('placeholder')).toBe('');
  });
});
