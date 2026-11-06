'use client';

/**
 * Workspace state panels. `StatePanel` is the single large-card state used by
 * the dashboard access/error screens (and reused by products empty/error).
 * The older LoadingState/EmptyState/ErrorState/NoAccessState remain for the
 * admin workspace; new screens should prefer StatePanel.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { DashboardIcon, type DashboardIconName } from '@/components/dashboard/icons';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { presentError } from '@/lib/workspace/errors';

export type StateTone = 'gray' | 'cream' | 'red' | 'green';

const toneTile: Record<StateTone, string> = {
  gray: 'bg-gray-100 text-subtle',
  cream: 'bg-orange-50 text-primary',
  red: 'bg-red-50 text-danger',
  green: 'bg-green-50 text-success',
};

/** One large white rounded card with a centered icon, title, body and actions. */
export function StatePanel({
  icon,
  tone = 'gray',
  title,
  description,
  actions,
  className,
}: {
  icon: DashboardIconName;
  tone?: StateTone;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'flex min-h-[50vh] w-full flex-col items-center justify-center gap-5 rounded-3xl border border-line bg-white p-6 text-center sm:p-10 lg:p-12',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('flex size-14 items-center justify-center rounded-full', toneTile[tone])}
      >
        <DashboardIcon name={icon} className="size-7" />
      </span>
      <h2 className="font-heading text-xl font-semibold text-ink md:text-2xl">{title}</h2>
      <p className="max-w-[420px] text-sm leading-6 text-subtle">{description}</p>
      {actions ? (
        <div className="flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:flex-row">{actions}</div>
      ) : null}
    </section>
  );
}

export function LoadingState({ label = 'Loading workspace' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-5 rounded-3xl border border-line p-6">
      <span className="block h-8 w-2/3 max-w-sm animate-pulse rounded bg-gray-100" />
      {[0, 1, 2, 3].map((row) => (
        <span key={row} className="block h-16 animate-pulse rounded-xl bg-gray-50" />
      ))}
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-dashed border-line px-5 py-12 text-center">
      <h2 className="font-heading text-xl font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-subtle">{description}</p>
      {action ? <div className="mx-auto mt-6 max-w-xs">{action}</div> : null}
    </section>
  );
}
export function NoAccessState({
  title = 'You do not have access',
  description = 'Ask your business owner or platform administrator to grant access.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <section role="status" className="rounded-3xl border border-line p-6 md:p-10">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-subtle">{description}</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
      >
        Go to dashboard
      </Link>
    </section>
  );
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const presentation = presentError(error);
  return (
    <section className="rounded-3xl border border-line p-6 md:p-8">
      <InlineError className="text-base">{presentation.message}</InlineError>
      {presentation.kind === 'auth' ? (
        <Link
          href="/auth/login"
          className="mt-5 inline-flex min-h-11 items-center font-semibold text-primary underline"
        >
          Log in again
        </Link>
      ) : presentation.retryable && retry ? (
        <div className="mt-5 max-w-xs">
          <PrimaryButton shape="rounded" onClick={retry}>
            Try again
          </PrimaryButton>
        </div>
      ) : null}
    </section>
  );
}
