import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/lib/cn';

export type NavbarLink = {
  label: string;
  /**
   * Omit for plain header text (no navigation) — e.g. the "Account details"
   * label on Create account. Backwards compatible: every existing usage
   * passes an href and renders as before.
   */
  href?: Route;
  /** `pill` renders a small white chip; `text` renders a plain gray link. */
  variant?: 'pill' | 'text';
  className?: string;
};

export type NavbarProps = {
  /** The right-hand link. Configured per page; omit for no link. */
  rightLink?: NavbarLink;
};

/** Page header: wordmark on the left, one configurable link on the right. */
export function Navbar({ rightLink }: NavbarProps) {
  return (
    <header className="w-full h-3">
      <nav className="mx-auto flex h-[88px]  sm:px-5 w-full max-w-[1152px] md:pb-4 items-center md:items-end justify-between gap-4 px-5 sm:h-[110 px] sm:px-0">
        <Link href="/" aria-label="Sellonit home" className="shrink-0 md:pb-3 rounded-md">
          <Image
            src="/wordmark.svg"
            alt="Sellonit"
            width={160}
            height={36}
            priority
            className="h-8 w-[92px] sm:w-auto sm:h-9"
          />
        </Link>
        {rightLink?.href ? (
          <Link
            href={rightLink.href}
            className={cn(
              'text-sm font-medium text-subtle transition-colors hover:text-ink sm:text-base',
              rightLink.className,
            )}
          >
            <span className="text-[18px] md:text-[24px] "> {rightLink.label}</span>
          </Link>
        ) : rightLink ? (
          <span className={cn('text-sm font-medium text-subtle sm:text-base', rightLink.className)}>
            {rightLink.label}
          </span>
        ) : null}
      </nav>
    </header>
  );
}
