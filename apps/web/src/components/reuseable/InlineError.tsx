import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { AlertCircleIcon } from './icons';

export type InlineErrorProps = {
  id?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Error message directly under the field it belongs to: small red text with a
 * red circled "!" on the left. Announced politely so it does not interrupt
 * the user.
 */
export function InlineError({ id, children, className }: InlineErrorProps) {
  return (
    <p
      id={id}
      aria-live="polite"
      className={cn('flex items-start gap-2 text-left text-sm text-danger', className)}
    >
      <AlertCircleIcon className="mt-0.5 size-4" />
      <span>{children}</span>
    </p>
  );
}
