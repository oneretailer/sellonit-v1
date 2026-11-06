'use client';

/**
 * Reusable product photo uploader. Backend-agnostic: files are handed to the
 * `uploadFn` adapter as soon as they are selected; per-file progress, cancel,
 * retry and replace are tracked here. Tiles flow and wrap; nothing has a fixed
 * page width. The first uploaded photo is the main photo.
 *
 * Tile ids ARE the server image ids once uploaded, so the form can build
 * `imageIds` directly from `value`. While uploading, a temporary local id is
 * used and swapped for the server id on success.
 */
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { cn } from '@/lib/cn';
import { DashboardIcon } from '@/components/dashboard/icons';
import { InlineError } from '@/components/reuseable/InlineError';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_SIZE_BYTES,
  MAX_PRODUCT_IMAGES,
} from '@/lib/products/constants';
import type { UploadedImage, UploadImageOptions } from '@/lib/products/types';

export type UploaderImage = {
  id: string;
  url: string;
  status: 'uploading' | 'uploaded' | 'failed';
  progress: number;
  /** Local blob preview while uploading; revoked when settled/removed. */
  previewUrl?: string;
  error?: string;
};

export type UploadFn = (file: File, options: UploadImageOptions) => Promise<UploadedImage>;

let localIdCounter = 0;
function nextLocalId(): string {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

function validateFile(file: File): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return `"${file.name}" isn't a JPG or PNG. Use JPG or PNG photos.`;
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return `"${file.name}" is larger than 5MB. Use a smaller photo.`;
  }
  return null;
}

export function ProductImageUploader({
  value,
  onChange,
  uploadFn,
  disabled = false,
  error,
}: {
  value: UploaderImage[];
  onChange: (images: UploaderImage[]) => void;
  uploadFn: UploadFn;
  disabled?: boolean;
  /** Field-level error (e.g. "Add at least one photo.") shown under the tiles. */
  error?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);
  const abortRef = useRef(new Map<string, AbortController>());
  const filesRef = useRef(new Map<string, File>());
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const [dragOver, setDragOver] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  // Mirror the latest value/callback into refs so async uploads never patch
  // stale state. `commit` also advances valueRef synchronously, so an upload
  // that resolves before React re-renders still sees the freshly added tile.
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  function commit(images: UploaderImage[]) {
    valueRef.current = images;
    onChangeRef.current(images);
  }
  useEffect(
    () => () => {
      for (const controller of abortRef.current.values()) controller.abort();
    },
    [],
  );

  const atMax = value.length >= MAX_PRODUCT_IMAGES;

  function patch(id: string, changes: Partial<UploaderImage>) {
    commit(valueRef.current.map((image) => (image.id === id ? { ...image, ...changes } : image)));
  }

  async function startUpload(localId: string, file: File, previewUrl: string) {
    const controller = new AbortController();
    abortRef.current.set(localId, controller);
    try {
      const uploaded = await uploadFn(file, {
        signal: controller.signal,
        onProgress: (percent) => patch(localId, { progress: percent }),
      });
      URL.revokeObjectURL(previewUrl);
      filesRef.current.delete(localId);
      filesRef.current.set(uploaded.id, file);
      // Swap the temporary id for the server id in a single update.
      commit(
        valueRef.current.map((image) =>
          image.id === localId
            ? { id: uploaded.id, url: uploaded.url, status: 'uploaded', progress: 100 }
            : image,
        ),
      );
    } catch (caught) {
      if (controller.signal.aborted) return;
      patch(localId, {
        status: 'failed',
        error: caught instanceof Error ? caught.message : 'Upload failed. Try again.',
      });
    } finally {
      abortRef.current.delete(localId);
    }
  }

  function addFiles(files: FileList | File[]) {
    if (disabled) return;
    const errors: string[] = [];
    const accepted: { image: UploaderImage; file: File }[] = [];
    let slots = MAX_PRODUCT_IMAGES - valueRef.current.length;
    for (const file of Array.from(files)) {
      const problem = validateFile(file);
      if (problem) {
        errors.push(problem);
        continue;
      }
      if (slots <= 0) {
        errors.push(`You can add up to ${MAX_PRODUCT_IMAGES} photos. Remove one to add another.`);
        continue;
      }
      slots -= 1;
      const id = nextLocalId();
      filesRef.current.set(id, file);
      accepted.push({
        image: {
          id,
          url: '',
          previewUrl: URL.createObjectURL(file),
          status: 'uploading',
          progress: 0,
        },
        file,
      });
    }
    setRejected(errors);
    if (accepted.length === 0) return;
    commit([...valueRef.current, ...accepted.map((entry) => entry.image)]);
    for (const entry of accepted)
      void startUpload(entry.image.id, entry.file, entry.image.previewUrl as string);
  }

  function remove(id: string) {
    const image = valueRef.current.find((entry) => entry.id === id);
    abortRef.current.get(id)?.abort();
    abortRef.current.delete(id);
    filesRef.current.delete(id);
    if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
    commit(valueRef.current.filter((entry) => entry.id !== id));
  }

  function retry(id: string) {
    const image = valueRef.current.find((entry) => entry.id === id);
    const file = filesRef.current.get(id);
    if (!image || !file) return;
    patch(id, { status: 'uploading', progress: 0, error: undefined });
    void startUpload(id, file, image.previewUrl ?? '');
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files?.length) addFiles(event.target.files);
    event.target.value = '';
  }

  function onReplaceSelected(event: ChangeEvent<HTMLInputElement>) {
    const target = replaceTargetRef.current;
    const file = event.target.files?.[0];
    event.target.value = '';
    replaceTargetRef.current = null;
    if (!target || !file) return;
    const problem = validateFile(file);
    if (problem) {
      setRejected([problem]);
      return;
    }
    setRejected([]);
    const existing = valueRef.current.find((entry) => entry.id === target);
    if (!existing) return;
    abortRef.current.get(target)?.abort();
    if (existing.previewUrl) URL.revokeObjectURL(existing.previewUrl);
    const localId = nextLocalId();
    filesRef.current.delete(target);
    filesRef.current.set(localId, file);
    const previewUrl = URL.createObjectURL(file);
    commit(
      valueRef.current.map((entry) =>
        entry.id === target
          ? { id: localId, url: '', previewUrl, status: 'uploading', progress: 0 }
          : entry,
      ),
    );
    void startUpload(localId, file, previewUrl);
  }

  function onDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
  }

  const hasImages = value.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        multiple
        className="sr-only"
        aria-label="Upload product photos"
        disabled={disabled || atMax}
        onChange={onInputChange}
      />
      <input
        ref={replaceRef}
        type="file"
        accept="image/jpeg,image/png"
        className="sr-only"
        aria-label="Replace photo"
        disabled={disabled}
        onChange={onReplaceSelected}
      />

      {!hasImages ? (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || undefined}
          aria-describedby={error ? 'product-photos-error' : undefined}
          onClick={() => {
            if (!disabled) inputRef.current?.click();
          }}
          onKeyDown={(event) => {
            if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition-colors',
            error
              ? 'border-danger'
              : dragOver
                ? 'border-primary bg-orange-50'
                : 'border-line bg-white hover:border-primary/60',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-12 items-center justify-center rounded-full bg-orange-50 text-primary"
          >
            <DashboardIcon name="upload" className="size-6" />
          </span>
          <p className="text-sm font-semibold text-ink">
            {dragOver ? 'Drop your photos to upload' : 'Drag and drop photos here'}
          </p>
          {!dragOver ? (
            <p className="text-sm text-subtle">
              or{' '}
              <span className="font-semibold text-primary underline underline-offset-2">
                Browse files
              </span>
            </p>
          ) : null}
          <p className="text-xs text-subtle">
            JPG or PNG. Use clear, well-lit photos of your product.
          </p>
        </div>
      ) : (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled && !atMax) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-wrap gap-3 rounded-2xl p-1',
            dragOver && 'bg-orange-50 outline-2 outline-dashed outline-primary',
          )}
        >
          {value.map((image, index) => (
            <div key={image.id} className="relative flex w-28 flex-col gap-1 sm:w-32">
              <div
                className={cn(
                  'relative aspect-square w-full overflow-hidden rounded-xl border bg-canvas',
                  image.status === 'failed' ? 'border-danger bg-red-50' : 'border-line',
                )}
              >
                {image.status === 'uploading' ? (
                  <>
                    <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-orange-100">
                      <span
                        className="block h-full bg-primary transition-[width]"
                        style={{ width: `${image.progress}%` }}
                      />
                    </span>
                    {image.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local blob preview before upload completes.
                      <img
                        src={image.previewUrl}
                        alt=""
                        className="size-full object-cover opacity-60"
                      />
                    ) : null}
                    <span
                      role="status"
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs font-medium text-subtle"
                    >
                      Uploading…
                      <span
                        aria-hidden="true"
                        className="h-1 w-3/4 overflow-hidden rounded-full bg-orange-100"
                      >
                        <span
                          className="block h-full bg-primary"
                          style={{ width: `${image.progress}%` }}
                        />
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(image.id)}
                        className="font-semibold text-primary underline underline-offset-2"
                      >
                        Cancel
                      </button>
                    </span>
                  </>
                ) : image.status === 'failed' ? (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center text-xs text-danger">
                    <DashboardIcon name="alert" className="size-5" />
                    Upload failed
                    <button
                      type="button"
                      onClick={() => retry(image.id)}
                      className="font-semibold text-primary underline underline-offset-2"
                    >
                      Retry
                    </button>
                  </span>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- uploaded product photo served from the API. */}
                    <img
                      src={image.url}
                      alt={`Product photo ${index + 1}`}
                      className="size-full object-cover"
                    />
                    {index === 0 ? (
                      <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        Main photo
                      </span>
                    ) : null}
                    <span className="absolute right-1 top-1 flex gap-1">
                      <button
                        type="button"
                        aria-label={`Replace photo ${index + 1}`}
                        disabled={disabled}
                        onClick={() => {
                          replaceTargetRef.current = image.id;
                          replaceRef.current?.click();
                        }}
                        className="flex size-6 items-center justify-center rounded-md bg-white/90 text-ink shadow hover:bg-white"
                      >
                        <DashboardIcon name="upload" className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove photo ${index + 1}`}
                        disabled={disabled}
                        onClick={() => remove(image.id)}
                        className="flex size-6 items-center justify-center rounded-md bg-white/90 text-danger shadow hover:bg-white"
                      >
                        <DashboardIcon name="trash" className="size-3.5" />
                      </button>
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
          {!atMax ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square w-28 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-subtle transition-colors hover:border-primary hover:text-primary sm:w-32"
            >
              <DashboardIcon name="plus" className="size-5" />
              <span className="text-xs font-medium">Add photo</span>
            </button>
          ) : null}
        </div>
      )}

      {error ? <InlineError id="product-photos-error">{error}</InlineError> : null}
      {rejected.length > 0 ? (
        <div className="flex flex-col gap-1">
          {rejected.map((message) => (
            <InlineError key={message}>{message}</InlineError>
          ))}
        </div>
      ) : null}

      <p className="text-xs leading-5 text-subtle">
        {hasImages
          ? 'The first photo is used as the main photo. Use Replace or Remove to change a photo.'
          : 'Photo previews appear here as soon as they finish uploading.'}
      </p>
    </div>
  );
}
