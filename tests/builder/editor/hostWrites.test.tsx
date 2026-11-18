import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';

import type { DocumentAdapter, DocumentFieldsPort } from '../../../src/builder/document';
import { DocumentFieldsPanel } from '../../../src/builder/editor/DocumentFieldsPanel';
import { EmailInbox } from '../../../src/builder/editor/emailInbox';
import { FieldsEpochContext, mergeFreshRead } from '../../../src/builder/editor/fieldsEpoch';
import { useDocumentEditor } from '../../../src/builder/editor/useDocumentEditor';
import type { PmlNode } from '../../../src/language';

const heading = (uid: string, text: string) => ({ primitive: 'heading', uid, props: { text, level: 1 } }) as unknown as PmlNode;
const said = () => ({ onSuccess: vi.fn(), onWarning: vi.fn(), onError: vi.fn() });

/** What the host wrote elsewhere reaches the open editor without a remount (2026-11-18, portify-1c). */
describe('adoptSavedDraft', () => {
  function adapterWith(load: ReturnType<typeof vi.fn>) {
    return {
      load,
      saveDraft: vi.fn(async () => ({ revision: 'r9' })),
      preview: vi.fn(async (_id: string, nodes: PmlNode[]) => ({ tree: nodes, natives: null, error: null })),
      preflight: vi.fn(async () => ({ mayPublish: true, findings: [] })),
    } as unknown as DocumentAdapter & { saveDraft: ReturnType<typeof vi.fn> };
  }

  it("takes the worker's draft and revision as one undo step, saves nothing, and the next save goes from the new revision", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ document: { nodes: [heading('abc111', 'Before')] }, revision: 'r1', meta: {} })
      .mockResolvedValueOnce({ document: { nodes: [heading('abc111', 'Written by the assistant')] }, revision: 'r2', meta: {} });
    const adapter = adapterWith(load);
    const { result } = renderHook(() => useDocumentEditor(adapter, 'e1', said()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      expect(await result.current.adoptSavedDraft()).toBe(true);
    });
    expect(result.current.nodes[0].props?.text).toBe('Written by the assistant');
    expect(result.current.dirty).toBe(false);
    expect(adapter.saveDraft).not.toHaveBeenCalled();

    // Undo brings back the tree before it, and saves that from the ADOPTED revision.
    act(() => result.current.undoEdit());
    expect(result.current.nodes[0].props?.text).toBe('Before');
    await act(async () => {
      await result.current.flush();
    });
    expect(adapter.saveDraft.mock.calls[0][2]).toBe('r2');
  });

  it('refuses, changing nothing, while the person has an unsaved change', async () => {
    const load = vi.fn().mockResolvedValue({ document: { nodes: [heading('abc111', 'Before')] }, revision: 'r1', meta: {} });
    const adapter = adapterWith(load);
    const { result } = renderHook(() => useDocumentEditor(adapter, 'e1', said()));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.change([heading('abc111', 'Typing')]));
    await act(async () => {
      expect(await result.current.adoptSavedDraft()).toBe(false);
    });
    expect(result.current.nodes[0].props?.text).toBe('Typing');
    expect(load).toHaveBeenCalledTimes(1);
  });
});

describe('refreshFields (the fields epoch)', () => {
  function port(values: Array<Record<string, unknown>>) {
    let reads = 0;

    return {
      describe: vi.fn(async () => [
        { name: 'subject', label: 'Subject', kind: 'text' },
        { name: 'preheader', label: 'Preview text', kind: 'text' },
      ]),
      read: vi.fn(async () => ({ values: values[Math.min(reads++, values.length - 1)], revision: `f${reads}` })),
      write: vi.fn(async () => ({ revision: 'f9' })),
    } as unknown as DocumentFieldsPort & { read: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn> };
  }

  it('keeps a field the person is typing in and takes every other from the fresh read', () => {
    expect(mergeFreshRead({ subject: 'Mine', preheader: '' }, { subject: 'Old', preheader: '' }, { subject: 'Theirs', preheader: 'Written' })).toEqual({
      subject: 'Mine',
      preheader: 'Written',
    });
  });

  it("the inbox frame shows the preview text the host's assistant wrote, without a remount", async () => {
    const fields = port([
      { subject: 'Your letter', preheader: '' },
      { subject: 'Your letter', preheader: 'Confirm your letter of acceptance' },
    ]);
    const { rerender } = render(
      <FieldsEpochContext.Provider value={0}>
        <EmailInbox id="e1" fields={fields} session="s1" />
      </FieldsEpochContext.Provider>,
    );
    await waitFor(() => expect((screen.getByLabelText('Subject') as HTMLInputElement).value).toBe('Your letter'));
    expect((screen.getByLabelText('Preview text') as HTMLInputElement).value).toBe('');

    rerender(
      <FieldsEpochContext.Provider value={1}>
        <EmailInbox id="e1" fields={fields} session="s1" />
      </FieldsEpochContext.Provider>,
    );
    await waitFor(() => expect((screen.getByLabelText('Preview text') as HTMLInputElement).value).toBe('Confirm your letter of acceptance'));
  });

  it('a details form re-reads too, and a field being typed in keeps its words and saves on the fresh revision', async () => {
    const fields = port([
      { subject: 'Old subject', preheader: '' },
      { subject: 'Server subject', preheader: 'Written' },
    ]);
    const { rerender } = render(
      <FieldsEpochContext.Provider value={0}>
        <DocumentFieldsPanel id="e1" fields={fields} session="s1" />
      </FieldsEpochContext.Provider>,
    );
    const subject = (await screen.findByLabelText(/Subject/)) as HTMLInputElement;
    await waitFor(() => expect(subject.value).toBe('Old subject'));
    fireEvent.change(subject, { target: { value: 'Typed subject' } });

    rerender(
      <FieldsEpochContext.Provider value={1}>
        <DocumentFieldsPanel id="e1" fields={fields} session="s1" />
      </FieldsEpochContext.Provider>,
    );
    await waitFor(() => expect((screen.getByLabelText(/Preview text/) as HTMLInputElement).value).toBe('Written'));
    expect(subject.value).toBe('Typed subject');

    fireEvent.blur(subject);
    await waitFor(() => expect(fields.write).toHaveBeenCalled());
    expect(fields.write.mock.calls[0][3]).toBe('f2');
  });
});
