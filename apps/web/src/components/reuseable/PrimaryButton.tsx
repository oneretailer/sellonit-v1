import Link from 'next/link';
import type { Route } from 'next';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

/** Shared look for every full-width primary pill. */
const pillBase =
  'inline-flex h-14 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-bold text-ink transition-colors';

export type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Shows a spinner and locks the button while a request is in flight. */
  loading?: boolean;
};

/**
 * Orange pill button with two inactive looks:
 * - `disabled`: pale peach, dark label, not clickable (e.g. code not yet 6 digits)
 * - `loading`: solid orange with a spinner, not clickable (request in flight)
 */
export function PrimaryButton({
  loading = false,
  disabled = false,
  type = 'button',
  className,
  children,
  ...rest
}: PrimaryButtonProps) {
  const locked = disabled || loading;
  return (
    <button
      type={type}
      disabled={locked}
      aria-busy={loading || undefined}
      className={cn(
        pillBase,
        disabled && !loading
          ? 'cursor-not-allowed bg-primary-disabled'
          : 'bg-primary hover:bg-primary-hover',
        loading && 'cursor-progress',
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export type PrimaryLinkButtonProps = {
  href: Route;
  children: ReactNode;
  className?: string;
};

/** The same orange pill, rendered as a link (for navigation such as "Get Started"). */
export function PrimaryLinkButton({ href, children, className }: PrimaryLinkButtonProps) {
  return (
    <Link href={href} className={cn(pillBase, 'bg-primary hover:bg-primary-hover', className)}>
      {children}
    </Link>
  );
}
