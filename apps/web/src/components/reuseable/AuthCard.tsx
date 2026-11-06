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
 * centred content. Full width on mobile (capped at 416px), and from `md` up a
 * fluid `w-full` card capped at a per-screen max width (632px by default; the
 * create-business step widens it to 800px via `auth-card--business`). Height
 * always hugs the content — there is no fixed height at any breakpoint, so the
 * page scrolls instead of clipping on short laptops. Vertical padding and gaps
 * scale with the viewport (see `.auth-card` in globals.css).
 */
export function AuthCard({ children, className, gapClassName = 'gap-6 md:gap-12' }: AuthCardProps) {
  return (
    <div className=" w-full flex items-center justify-center mt-10">
      <section
        className={cn(
          'auth-card flex w-full max-w-card flex-col items-stretch shadow-lg shadow-Gray/100 rounded-card border border-line bg-surface px-[18px] py-6 text-center  md:px-9 ',
          gapClassName,
          className,
        )}
      >
        {children}
      </section>
    </div>
  );
}
