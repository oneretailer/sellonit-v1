/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductImageUploader, type UploaderImage } from './ProductImageUploader';
import { polyfillProductsEnv } from './testSupport';
import { MAX_PRODUCT_IMAGES } from '@/lib/products/constants';
import type { UploadImageOptions, UploadedImage } from '@/lib/products/types';

function Harness({ uploadFn, initial = [] }: {
  uploadFn: (file: File, options: UploadImageOptions) => Promise<UploadedImage>;
  initial?: UploaderImage[];
}) {
  const [images, setImages] = useState<UploaderImage[]>(initial);
  return (
    <>
      <ProductImageUploader value={images} onChange={setImages} uploadFn={uploadFn} />
      <output aria-label="ids">{images.filter((image) => image.status === 'uploaded').map((image) => image.id).join(',')}</output>
    </>
  );
}

function png(name = 'photo.png'): File {
  return new File(['x'], name, { type: 'image/png' });
}

beforeEach(() => polyfillProductsEnv());
afterEach(() => cleanup());

describe('product image uploader', () => {
  it('uploads immediately and exposes the server image id to the parent', async () => {
    const userEventSession = userEvent.setup();
    const uploadFn = vi.fn((file: File) => Promise.resolve({ id: `srv-${file.name}`, url: `https://cdn.example/${file.name}` }));
    render(<Harness uploadFn={uploadFn} />);
    await userEventSession.upload(screen.getByLabelText('Upload product photos'), png());
    await waitFor(() => expect(screen.getByLabelText('ids').textContent).toBe('srv-photo.png'));
    expect(uploadFn).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Main photo')).toBeTruthy();
  });

  it('rejects non-JPG/PNG files and files over 5MB with clear messages', async () => {
    const uploadFn = vi.fn(() => Promise.resolve({ id: 'x', url: 'x' }));
    render(<Harness uploadFn={uploadFn} />);
    const input = screen.getByLabelText('Upload product photos');
    // fireEvent bypasses the accept filter, like drag-drop of a wrong file.
    fireEvent.change(input, { target: { files: [new File(['x'], 'note.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText(/isn't a JPG or PNG/)).toBeTruthy();
    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 5 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByText(/is larger than 5MB/)).toBeTruthy();
    expect(uploadFn).not.toHaveBeenCalled();
  });

  it('offers Retry after a failed upload and succeeds on retry', async () => {
    const userEventSession = userEvent.setup();
    const uploadFn = vi.fn()
      .mockRejectedValueOnce(new Error('Upload failed. Try again.'))
      .mockResolvedValue({ id: 'srv-1', url: 'https://cdn.example/photo.png' });
    render(<Harness uploadFn={uploadFn} />);
    await userEventSession.upload(screen.getByLabelText('Upload product photos'), png());
    await waitFor(() => expect(screen.getByText('Upload failed')).toBeTruthy());
    await userEventSession.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByLabelText('ids').textContent).toBe('srv-1'));
    expect(uploadFn).toHaveBeenCalledTimes(2);
  });

  it('cancels an in-flight upload via AbortSignal and removes the tile', async () => {
    const userEventSession = userEvent.setup();
    let captured: UploadImageOptions | null = null;
    const uploadFn = vi.fn((_file: File, options: UploadImageOptions) => {
      captured = options;
      return new Promise<UploadedImage>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    });
    render(<Harness uploadFn={uploadFn} />);
    await userEventSession.upload(screen.getByLabelText('Upload product photos'), png());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy());
    await userEventSession.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull());
    expect((captured as UploadImageOptions | null)?.signal?.aborted).toBe(true);
    expect(screen.getByText('Drag and drop photos here')).toBeTruthy();
  });

  it('removes an uploaded photo and hides the Add photo tile at the max', async () => {
    const userEventSession = userEvent.setup();
    const uploadFn = vi.fn(() => Promise.resolve({ id: 'x', url: 'x' }));
    const initial: UploaderImage[] = Array.from({ length: MAX_PRODUCT_IMAGES }, (_, index) => ({
      id: `img-${index}`, url: `https://cdn.example/${index}.jpg`, status: 'uploaded', progress: 100,
    }));
    render(<Harness uploadFn={uploadFn} initial={initial} />);
    expect(screen.queryByRole('button', { name: 'Add photo' })).toBeNull();
    expect(screen.getByLabelText('Upload product photos')).toHaveProperty('disabled', true);
    await userEventSession.click(screen.getByRole('button', { name: 'Remove photo 1' }));
    expect(screen.getByRole('button', { name: 'Add photo' })).toBeTruthy();
    expect(screen.getByLabelText('ids').textContent).not.toContain('img-0');
  });

  it('is keyboard accessible: Enter on the drop zone opens the file picker', async () => {
    const userEventSession = userEvent.setup();
    const uploadFn = vi.fn(() => Promise.resolve({ id: 'x', url: 'x' }));
    render(<Harness uploadFn={uploadFn} />);
    const zone = screen.getByRole('button', { name: /Drag and drop photos here/ });
    zone.focus();
    const click = vi.spyOn(HTMLInputElement.prototype, 'click');
    await userEventSession.keyboard('{Enter}');
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});
