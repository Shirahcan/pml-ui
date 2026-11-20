/**
 * The builder's picture picker (shared program E4a4f4, moved from Portify with its tests).
 *
 * Two defects found in Portify's E4d Loop 2 (2026-11-13): deleting an image left the "N of M images" line stale until
 * the picker was reopened, and the delete ran on one click with no confirm, although a delete removes the file every
 * page using it points at. And one found in the move: the description printed a literal "5 MB" instead of the host's
 * one upload limit.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { DocumentMediaPort } from '../../../src/builder/document';
import { BuilderHostProvider } from '../../../src/builder/editor/host';
import { MediaPickerDialog } from '../../../src/builder/editor/MediaField';

globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

const image = (id: string) => ({ id, url: `https://example.com/media/${id}`, mime: 'image/png', bytes: 1000, width: 10, height: 10, alt: null });
const quota = (files: number) => ({ used: files * 1000, limit: 50 * 1024 * 1024, files: { used: files, limit: 200 } });
const LIMIT = { known: true, maxMb: 5, maxBytes: 5 * 1024 * 1024 };

function port(remove: ReturnType<typeof vi.fn>): DocumentMediaPort {
  return {
    list: vi
      .fn()
      .mockResolvedValueOnce({ media: [image('m1'), image('m2')], quota: quota(2) })
      .mockResolvedValue({ media: [image('m2')], quota: quota(1) }),
    upload: vi.fn(),
    remove,
  } as unknown as DocumentMediaPort;
}

function renderPicker(media: DocumentMediaPort, onError = vi.fn(), uploadLimit: typeof LIMIT | null = LIMIT) {
  render(
    <BuilderHostProvider onError={onError}>
      <MediaPickerDialog open onOpenChange={() => {}} onSelect={() => {}} media={media} uploadLimit={uploadLimit} />
    </BuilderHostProvider>,
  );
}

describe('MediaPickerDialog', () => {
  it("a library whose removal keeps the address working says so, in its own words (0.7.85: a Growth library)", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const growth = {
      ...port(remove),
      removeWords: {
        action: 'Remove from the library',
        title: 'Remove this picture from the library?',
        description: 'It leaves this library. Posts and newsletters that already show it keep showing it.',
        confirm: 'Remove',
      },
    } as DocumentMediaPort;
    renderPicker(growth);

    await screen.findByText(/2 of 200 images/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove from the library' })[0]);

    expect(await screen.findByText('Remove this picture from the library?')).toBeTruthy();
    expect(screen.queryByText(/already published/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith('m1'));
  });

  it('asks before it deletes, and Keep it deletes nothing', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    renderPicker(port(remove));

    await screen.findByText(/2 of 200 images/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete image' })[0]);

    expect(await screen.findByText('Delete this image?')).toBeTruthy();
    expect(screen.getByText(/already published/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    await waitFor(() => expect(screen.queryByText('Delete this image?')).toBeNull());
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText(/2 of 200 images/)).toBeTruthy();
  });

  it('a confirmed delete removes the tile and the count drops at once', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    renderPicker(port(remove));

    await screen.findByText(/2 of 200 images/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete image' })[0]);
    await screen.findByText('Delete this image?');

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Delete image' }).at(-1)!);
    });

    expect(remove).toHaveBeenCalledWith('m1');
    expect(await screen.findByText(/1 of 200 images/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Delete this image?')).toBeNull());
  });

  it('a failed delete keeps the image and the count, and says why through the host', async () => {
    const failure = new Error('Image not found.');
    const onError = vi.fn();
    renderPicker(port(vi.fn().mockRejectedValue(failure)), onError);

    await screen.findByText(/2 of 200 images/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete image' })[0]);
    await screen.findByText('Delete this image?');

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Delete image' }).at(-1)!);
    });

    expect(onError).toHaveBeenCalledWith(failure);
    expect(screen.getByText(/2 of 200 images/)).toBeTruthy();
  });

  it("states the host's upload limit, never a literal, and refuses a larger file before uploading it", async () => {
    const media = port(vi.fn());
    const onError = vi.fn();
    renderPicker(media, onError);

    expect(await screen.findByText(/JPEG, PNG, or WebP, up to 5 MB\./)).toBeTruthy();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [big] } });

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('up to 5 MB'));
    expect(media.upload).not.toHaveBeenCalled();
  });

  it('names no figure while the limit is unknown, so a stale number never refuses a good file', async () => {
    renderPicker(port(vi.fn()), vi.fn(), null);

    expect(await screen.findByText(/JPEG, PNG, or WebP\. We re-encode/)).toBeTruthy();
  });

  it('keeps Keep it focusable but inert while a delete runs, so focus never falls into the hidden picker', async () => {
    let finish: () => void = () => {};
    const remove = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    renderPicker(port(remove));

    await screen.findByText(/2 of 200 images/);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete image' })[0]);
    await screen.findByText('Delete this image?');
    const keep = screen.getByRole('button', { name: 'Keep it' });
    keep.focus();

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Delete image' }).at(-1)!);
    });

    expect(keep.hasAttribute('disabled')).toBe(false);
    expect(keep.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(keep);
    fireEvent.click(keep);
    expect(screen.getByText('Delete this image?')).toBeTruthy();

    await act(async () => finish());
    await waitFor(() => expect(screen.queryByText('Delete this image?')).toBeNull());
  });
});

