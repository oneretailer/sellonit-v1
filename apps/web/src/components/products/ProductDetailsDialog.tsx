'use client';

/**
 * PROTOTYPE SIMULATION — Product details modal (`ProductDetailsDialog`).
 *
 * Not confirmed for MVP. Intentionally built as an isolated, self-contained
 * component so removing it requires only deleting this file and its single
 * import/state hook in `ProductsListPage.tsx`.
 *
 * Uses neutral inline vector placeholder views (no shipped image assets, no
 * hardcoded hex) whenever a product has no uploaded gallery photos.
 */
import { useState } from 'react';
import { Dialog } from '@/components/workspace/Dialog';
import { cn } from '@/lib/cn';
import { formatNaira } from '@/lib/money';
import type { Product } from '@/lib/products/types';
import { ProductStatusPill, StockText } from './ProductStatusPill';

type PlaceholderVariant = 'front' | 'detail' | 'label';

const PLACEHOLDER_SLIDES: readonly { id: string; label: string; variant: PlaceholderVariant }[] = [
  { id: 'placeholder-front', label: 'Front placeholder view', variant: 'front' },
  { id: 'placeholder-detail', label: 'Fabric detail placeholder view', variant: 'detail' },
  { id: 'placeholder-label', label: 'Tag placeholder view', variant: 'label' },
];

function NeutralProductPlaceholder({
  variant,
  compact = false,
}: {
  variant: PlaceholderVariant;
  compact?: boolean;
}) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-2 bg-canvas text-caption">
      <svg
        aria-hidden="true"
        viewBox="0 0 80 80"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={compact ? 'size-6' : 'size-20'}
      >
        {variant === 'front' ? (
          <>
            <path d="M27 18 16 26l5 10 7-4v28h24V32l7 4 5-10-11-8c-2 4-6 6-13 6s-11-2-13-6Z" />
          </>
        ) : variant === 'detail' ? (
          <>
            <rect x="18" y="18" width="44" height="44" rx="6" />
            <path d="M18 32h44M18 48h44M32 18v44M48 18v44" />
          </>
        ) : (
          <>
            <path d="M44 16H24a4 4 0 0 0-4 4v20l22 22a4 4 0 0 0 5.6 0l14.4-14.4a4 4 0 0 0 0-5.6L44 16Z" />
            <circle cx="30" cy="28" r="3" />
          </>
        )}
      </svg>
      {!compact ? (
        <span className="text-[length:var(--text-ws-caption)] text-caption">
          Product preview placeholder
        </span>
      ) : null}
    </div>
  );
}

export function ProductDetailsDialog({
  open,
  product,
  categoryLabel,
  returnFocusTo,
  onClose,
}: {
  open: boolean;
  product: Product;
  categoryLabel?: string;
  returnFocusTo?: HTMLElement | null;
  onClose: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const hasUploadedImages = product.images.length > 0;
  const galleryCount = hasUploadedImages ? product.images.length : PLACEHOLDER_SLIDES.length;
  const activeIndex = selectedIndex < galleryCount ? selectedIndex : 0;
  const activeUploaded = hasUploadedImages ? product.images[activeIndex] : undefined;
  const activePlaceholder = !hasUploadedImages
    ? (PLACEHOLDER_SLIDES[activeIndex] ?? PLACEHOLDER_SLIDES[0]!)
    : undefined;

  return (
    <Dialog
      open={open}
      title="Product details"
      size="2xl"
      hideIcon
      showCloseButton
      closeLabel="Close product details"
      returnFocusTo={returnFocusTo}
      onClose={onClose}
    >
      <div className="grid gap-6 md:min-h-[456px] md:grid-cols-[275px_minmax(0,1fr)] md:gap-8">
        {/* Left column: 275px square main image + 52px thumbnail strip */}
        <div className="flex flex-col gap-3">
          <div className="aspect-square w-full max-w-[275px] overflow-hidden rounded-ws-card border border-line bg-canvas">
            {activeUploaded ? (
              // eslint-disable-next-line @next/next/no-img-element -- product photo served from API.
              <img src={activeUploaded.url} alt={product.name} className="size-full object-cover" />
            ) : (
              <NeutralProductPlaceholder variant={activePlaceholder?.variant ?? 'front'} />
            )}
          </div>

          <div
            role="group"
            aria-label="Product photo thumbnails"
            className="flex flex-wrap items-center gap-2.5"
          >
            {hasUploadedImages
              ? product.images.map((image, index) => {
                  const selected = index === activeIndex;
                  return (
                    <button
                      key={image.id}
                      type="button"
                      aria-label={`View photo ${index + 1} of ${product.images.length}`}
                      aria-pressed={selected}
                      onClick={() => setSelectedIndex(index)}
                      className={cn(
                        'size-[52px] shrink-0 overflow-hidden rounded-ws-control bg-canvas transition-colors',
                        selected
                          ? 'border-2 border-primary'
                          : 'border border-line hover:border-primary/60',
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- thumbnail photo served from API. */}
                      <img src={image.url} alt="" className="size-full object-cover" />
                    </button>
                  );
                })
              : PLACEHOLDER_SLIDES.map((slide, index) => {
                  const selected = index === activeIndex;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      aria-label={slide.label}
                      aria-pressed={selected}
                      onClick={() => setSelectedIndex(index)}
                      className={cn(
                        'size-[52px] shrink-0 overflow-hidden rounded-ws-control bg-canvas transition-colors',
                        selected
                          ? 'border-2 border-primary'
                          : 'border border-line hover:border-primary/60',
                      )}
                    >
                      <NeutralProductPlaceholder variant={slide.variant} compact />
                    </button>
                  );
                })}
          </div>
        </div>

        {/* Right column: name, SKU, divider, 2x2 metadata grid, outlined orange Close button */}
        <div className="flex min-w-0 flex-col justify-between gap-6">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold text-ink">{product.name}</h3>
            <p className="mt-1 text-[length:var(--text-ws-caption)] text-caption">
              {product.sku || '—'}
            </p>
            {product.description.trim() ? (
              <p className="mt-3 text-[length:var(--text-ws-body)] leading-6 text-subtle">
                {product.description}
              </p>
            ) : null}

            <hr className="my-5 border-line" />

            <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-[length:var(--text-ws-caption)] text-caption">Category</dt>
                <dd className="truncate text-[length:var(--text-ws-body)] font-medium text-ink">
                  {categoryLabel || product.category || '—'}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-[length:var(--text-ws-caption)] text-caption">
                  Wholesale price
                </dt>
                <dd className="truncate text-[length:var(--text-ws-body)] font-semibold text-ink">
                  {formatNaira(product.wholesalePrice)}
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-[length:var(--text-ws-caption)] text-caption">Stock</dt>
                <dd>
                  <StockText quantity={product.stockQuantity} lowStock={product.lowStock} />
                </dd>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <dt className="text-[length:var(--text-ws-caption)] text-caption">Status</dt>
                <dd>
                  <ProductStatusPill status={product.status} />
                </dd>
              </div>
            </dl>
          </div>

          <button
            type="button"
            data-dialog-safe
            onClick={onClose}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-ws-control border border-primary bg-surface px-5 text-[length:var(--text-ws-body)] font-semibold text-primary transition-colors hover:bg-primary-tint"
          >
            Close
          </button>
        </div>
      </div>
    </Dialog>
  );
}
