import Link from 'next/link';
import type { Route } from 'next';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Shared look for every full-width primary pill. */
const pillBase =
  'inline-flex min-h-11 h-16 w-full items-center justify-center gap-2 px-6 text-xl font-semibold text-white transition-colors';

export type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Shows loading state and locks the button while a request is in flight. */
  loading?: boolean;
  shape?: 'pill' | 'rounded';
};

/**
 * Orange pill button with two inactive looks:
 * - `disabled`: pale peach, dark label, not clickable (e.g. code not yet 6 digits)
 * - `loading`: solid orange with a spinner, not clickable (request in flight)
 */
export function PrimaryButton({
  loading = false,
  shape = 'pill',
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
        shape === 'pill' ? 'rounded-full' : 'rounded-button',
        disabled && !loading
          ? 'cursor-not-allowed bg-primary-disabled text-ink'
          : loading
            ? 'cursor-not-allowed bg-[#CC7000]'
            : 'bg-primary text-ink hover:bg-primary-hover',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export type PrimaryLinkButtonProps = {
  href: Route;
  children: ReactNode;
  className?: string;
};

/** The same orange pill, rendered as a navigational link. */
export function PrimaryLinkButton({ href, children, className }: PrimaryLinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(pillBase, 'rounded-full bg-primary hover:bg-primary-hover', className)}
    >
      {children}
    </Link>
  );
}
