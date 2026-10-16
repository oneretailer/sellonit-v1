import Image from 'next/image';
import Link from 'next/link';
import type { Route } from 'next';
import { cn } from '@/lib/cn';

export type NavbarLink = {
  label: string;
  href: Route;
  /** `pill` renders a small white chip; `text` renders a plain gray link. */
  variant?: 'pill' | 'text';
};

export type NavbarProps = {
  /** The right-hand link. Configured per page; omit for no link. */
  rightLink?: NavbarLink;
};

/** Page header: wordmark on the left, one configurable link on the right. */
export function Navbar({ rightLink }: NavbarProps) {
  return (
    <header className="w-full">
      <nav className="mx-auto flex h-20 w-full max-w-page items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" aria-label="Sellonit home" className="shrink-0 rounded-md">
          <Image
            src="/wordmark.svg"
            alt="Sellonit"
            width={160}
            height={36}
            priority
            className="h-8 w-auto sm:h-9"
          />
        </Link>
        {rightLink ? (
          <Link
            href={rightLink.href}
            className={cn(
              'text-[24px] font-medium hidden lg:flex text-subtle transition-colors hover:text-ink',
              rightLink.variant === 'pill' &&
                'rounded-[12px] bg-surface px-5 py-2 hover:bg-canvas',
            )}
          >
            {rightLink.label}
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
