import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type AuthCardProps = {
  children: ReactNode;
  className?: string;
};

/**
 * The white card every auth step sits in: 36px radius, 1px border, soft shadow,
 * centred content. Full width on mobile, capped at 632px on desktop.
 */
export function AuthCard({ children, className }: AuthCardProps) {
  return (
    <section
      className={cn(
        'flex w-full max-w-card flex-col items-center gap-8 rounded-card border border-line bg-surface px-5 py-10 text-center shadow-card sm:px-9 sm:py-12',
        className,
      )}
    >
      {children}
    </section>
  );
}
