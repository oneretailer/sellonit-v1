import { cn } from '@/lib/cn';

/** The pill container used by every text-like field. */
export function pillFieldClass(hasError: boolean, disabled = false): string {
  return cn(
    'flex h-14 w-full items-center gap-3 rounded-xl border bg-surface px-5 transition-[border-color,box-shadow] sm:h-[60px]',
    hasError
      ? 'border-danger focus-within:ring-4 focus-within:ring-danger/15'
      : 'border-line focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15',
    disabled && 'bg-canvas',
  );
}

/** The bare input inside a pill. */
export const pillInputClass =
  'h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-gray-500 disabled:cursor-not-allowed disabled:text-gray-500';
