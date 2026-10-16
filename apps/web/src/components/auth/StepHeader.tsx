import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type StepHeaderProps = {
  title: string;
  children?: ReactNode;
  /** Centred on the login screen; left-aligned on the others. Defaults to centred. */
  align?: 'center' | 'left';
};

/** Heading and supporting line at the top of an auth step card. */
export function StepHeader({ title, children, align = 'center' }: StepHeaderProps) {
  return (
    <div
      className={cn('flex w-full flex-col gap-3', align === 'left' ? 'text-left' : 'text-center')}
    >
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      {children ? <p className="text-sm text-subtle">{children}</p> : null}
    </div>
  );
}
