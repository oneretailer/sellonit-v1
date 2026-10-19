import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type SecondaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  shape?: 'pill' | 'rounded';
  appearance?: 'peach' | 'outline';
};

/**
 * Full-width pill with a very light peach background and a dark bold label
 * (e.g. "Back to login", "Resend code"). Uses the existing pale peach token.
 */
export function SecondaryButton({
  loading = false,
  shape = 'pill',
  appearance = 'peach',
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
        cn(
          'inline-flex min-h-14 h-16 w-full items-center justify-center gap-3 px-6 text-base font-medium text-ink transition-colors',
          shape === 'pill' ? 'rounded-full' : 'rounded-button',
          appearance === 'outline'
            ? 'border border-line bg-white hover:bg-canvas'
            : 'bg-primary-disabled hover:bg-[#fbe0bb]',
        ),
        locked ? 'cursor-not-allowed opacity-70' : null,
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
