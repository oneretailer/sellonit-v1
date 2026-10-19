import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
};

/**
 * Full-width pill with a very light peach background and a dark bold label
 * (e.g. "Back to login", "Resend code"). Uses the existing pale peach token.
 */
export function SecondaryButton({
  loading = false,
  disabled = false,
  type = 'button',
  className,
  children,
  ...rest
}: SecondaryButtonProps) {
  const locked = disabled || loading;
  return (
    <button
      type={type}
      disabled={locked}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex h-14 w-full items-center justify-center gap-2 rounded-full bg-primary-disabled px-6 text-base font-bold text-ink transition-colors',
        locked ? 'cursor-not-allowed opacity-70' : 'hover:bg-[#fbe0bb]',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
