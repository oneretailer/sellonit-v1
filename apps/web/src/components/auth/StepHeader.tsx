import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type AuthCardHeaderProps = {
  title: string;
  children?: ReactNode;
  icon?: ReactNode;
  align?: 'center' | 'left';
};

/** Heading group shared by auth cards; optional artwork is provided by the screen. */
export function AuthCardHeader({ title, children, icon, align = 'center' }: AuthCardHeaderProps) {
  return (
    <div className={cn('flex w-full flex-col', align === 'left' ? 'text-left' : 'text-center')}>
      {icon ? <div className="mb-4 flex w-full justify-center md:mb-6">{icon}</div> : null}
      <div className="flex w-full flex-col gap-2">
        <h1 className="auth-heading">{title}</h1>
        {children ? <p className="text-base text-subtle sm:text-lg">{children}</p> : null}
      </div>
    </div>
  );
}

/** Backwards-compatible name for existing auth screens. */
export const StepHeader = AuthCardHeader;
