import type { SVGProps } from 'react';
import { cn } from '@/lib/cn';

export const BAG_MARK_SIZE_CLASS = 'w-9 md:w-12 2xl:w-14';

export type BagMarkProps = {
  className?: string;
  title?: string;
};

/** Placeholder brand bag art; replace its paths with the final mark, preserving this API. */
export function BagMark({ className = BAG_MARK_SIZE_CLASS, title }: BagMarkProps) {
  const accessibility: SVGProps<SVGSVGElement> = title
    ? { role: 'img', 'aria-labelledby': 'bag-mark-title' }
    : { 'aria-hidden': true };
  return (
    <svg
      viewBox="0 0 56 60"
      width="100%"
      height="auto"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      className={cn('text-primary', className)}
      {...accessibility}
    >
      {/* PLACEHOLDER ARTWORK: replace the paths below with the final brand asset. Keep the viewBox, props and stroke="currentColor" so nothing else needs to change. */}
      {title ? <title id="bag-mark-title">{title}</title> : null}
      <path d="M12 20.5h32l2.1 32.3a4 4 0 0 1-4 4.2H13.9a4 4 0 0 1-4-4.2L12 20.5Z" />
      <path d="M18 20.5v-5.2a10 10 0 0 1 20 0v5.2" />
      <path d="M22 31v10.5a4 4 0 1 0 8 0V31m-8 5.2h8m4-5.2v10.5a4 4 0 1 0 8 0V31m-8 5.2h8" />
    </svg>
  );
}
