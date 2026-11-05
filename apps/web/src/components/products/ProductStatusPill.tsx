'use client';

import { cn } from '@/lib/cn';
import type { ProductStatus } from '@/lib/products/types';
import { stockLevel, stockText } from '@/lib/products/stock';

export function ProductStatusPill({ status }: { status: ProductStatus }) {
  const published = status === 'published';
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
      published ? 'bg-green-50 text-success' : 'bg-gray-100 text-subtle',
    )}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', published ? 'bg-success' : 'bg-gray-400')} />
      {published ? 'Published' : 'Draft'}
    </span>
  );
}

export function StockText({ quantity, lowStock }: { quantity: number; lowStock?: boolean }) {
  const level = stockLevel(quantity, lowStock);
  return (
    <span className={cn(
      'text-sm',
      level === 'out-of-stock' ? 'font-medium text-danger' : level === 'low-stock' ? 'font-medium text-primary' : 'text-ink',
    )}>
      {stockText(quantity, lowStock)}
    </span>
  );
}
