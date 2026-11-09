'use client';

import { cn } from '@/lib/cn';
import type { ProductStatus } from '@/lib/products/types';
import { stockLevel, stockText, type StockLevel } from '@/lib/products/stock';

export function ProductStatusPill({ status }: { status: ProductStatus }) {
  const published = status === 'published';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        published ? 'bg-green-50 text-success' : 'bg-gray-100 text-subtle',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', published ? 'bg-success' : 'bg-gray-400')}
      />
      {published ? 'Published' : 'Draft'}
    </span>
  );
}

const STOCK_PILL_STYLES: Record<StockLevel, { wrapper: string; dot: string; label: string }> = {
  'out-of-stock': {
    wrapper: 'bg-red-50 text-danger',
    dot: 'bg-danger',
    label: 'Out of stock',
  },
  'low-stock': {
    wrapper: 'bg-orange-50 text-primary',
    dot: 'bg-primary',
    label: 'Low stock',
  },
  'in-stock': {
    wrapper: 'bg-green-50 text-success',
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
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium',
        style.wrapper,
      )}
    >
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', style.dot)} />
      {style.label}
    </span>
  );
}

export function StockText({ quantity, lowStock }: { quantity: number; lowStock?: boolean }) {
  const level = stockLevel(quantity, lowStock);
  return (
    <span
      className={cn(
        'text-sm',
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
