import type { ReactNode } from 'react';
import { AlertCircleIcon } from './icons';

export type InlineErrorProps = {
  id?: string;
  children: ReactNode;
};

/**
 * Error message directly under the field it belongs to: small red text with a
 * red circled "!" on the left. Announced politely so it does not interrupt
 * the user.
 */
export function InlineError({ id, children }: InlineErrorProps) {
  return (
    <p id={id} aria-live="polite" className="flex items-start gap-2 text-left text-sm text-danger">
      <AlertCircleIcon className="mt-0.5 size-4" />
      <span>{children}</span>
    </p>
  );
}
