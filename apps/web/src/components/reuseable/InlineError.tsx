import type { ReactNode } from 'react';

export type InlineErrorProps = {
  id?: string;
  children: ReactNode;
};

/** Error message shown directly under the field (or form) it belongs to. */
export function InlineError({ id, children }: InlineErrorProps) {
  return (
    <p id={id} role="alert" className="text-left text-sm text-danger">
      {children}
    </p>
  );
}
