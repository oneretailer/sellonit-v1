import type { ReactNode } from 'react';

export type StepHeaderProps = {
  title: string;
  children?: ReactNode;
};

/** Heading and supporting line at the top of an auth step card. Same markup as the original screens. */
export function StepHeader({ title, children }: StepHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold text-ink">{title}</h1>
      {children ? <p className="text-sm text-subtle">{children}</p> : null}
    </div>
  );
}
