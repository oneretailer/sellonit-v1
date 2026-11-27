'use client';

import { cn } from '@/lib/cn';
import type { ProductStatus } from '@/lib/products/types';
import { stockLevel, stockText, type StockLevel } from '@/lib/products/stock';

const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  published: 'Published',
  draft: 'Draft',
  unpublished: 'Unpublished',
  archived: 'Archived',
};

export function ProductStatusPill({ status }: { status: ProductStatus }) {
  const published = status === 'published';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[length:var(--text-ws-caption)] font-medium',
        published ? 'bg-success-tint text-success' : 'bg-draft-tint text-draft',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', published ? 'bg-success' : 'bg-draft')}
      />
      {PRODUCT_STATUS_LABELS[status]}
    </span>
  );
}

const STOCK_PILL_STYLES: Record<StockLevel, { wrapper: string; dot: string; label: string }> = {
  'out-of-stock': {
    wrapper: 'bg-danger-tint text-danger',
    dot: 'bg-danger',
    label: 'Out of stock',
  },
  'low-stock': {
    wrapper: 'bg-primary-tint text-primary',
    dot: 'bg-primary',
    label: 'Low stock',
  },
  'in-stock': {
    wrapper: 'bg-success-tint text-success',
    dot: 'bg-success',
    label: 'In stock',
  },
};

export function StockStatusPill({
  quantity,
  status,
  lowStock,
}: {
  quantity: number;
  status?: StockLevel;
  lowStock?: boolean;
}) {
  const level = status ?? stockLevel(quantity, lowStock);
  const style = STOCK_PILL_STYLES[level];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[length:var(--text-ws-caption)] font-medium',
        style.wrapper,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}

export function StockText({
  quantity,
  lowStock,
}: {
  quantity: number | null;
  lowStock?: boolean;
}) {
  if (quantity === null) {
    return (
      <span className="text-[length:var(--text-ws-body)] text-caption">Not tracked</span>
    );
  }
  const level = stockLevel(quantity, lowStock);
  return (
    <span
      className={cn(
        'text-[length:var(--text-ws-body)]',
        level === 'out-of-stock'
          ? 'font-medium text-danger'
          : level === 'low-stock'
            ? 'font-medium text-primary'
            : 'text-ink',
      )}
    >
      {stockText(quantity, lowStock)}
    </span>
  );
}
