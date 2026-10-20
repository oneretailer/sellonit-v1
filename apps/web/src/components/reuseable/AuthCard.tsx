import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type AuthCardProps = {
  children: ReactNode;
  className?: string;
  /**
   * Vertical gap between the card's sections. Defaults to 32px. The login card
   * uses 48px (`gap-12`); the other flow screens use 36px (`gap-9`).
   */
  gapClassName?: string;
};

/**
 * The white card every auth step sits in: 36px radius, 1px border, soft shadow,
 * centred content. Full width on mobile, capped at 632px on desktop. Padding
 * shrinks on small screens (20px sides, 40px top/bottom), and is 36px sides
 * and 48px top/bottom from the `sm` breakpoint.
 */
export function AuthCard({ children, className, gapClassName = 'gap-6 md:gap-12' }: AuthCardProps) {
  return (
    <section
      className={cn(
        'auth-card flex w-full max-w-card flex-col items-stretch  rounded-card border border-line bg-surface px-[18px] py-6 text-center  md:px-9 ',
        gapClassName,
        className,
      )}
    >
      {children}
    </section>
  );
}
