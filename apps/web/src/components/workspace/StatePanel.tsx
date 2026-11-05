import Link from 'next/link';
import type { ReactNode } from 'react';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { presentError } from '@/lib/workspace/errors';

export function LoadingState({ label = 'Loading workspace' }: { label?: string }) {
  return <div role="status" aria-label={label} className="space-y-5 rounded-3xl border border-line p-6">
    <span className="block h-8 w-2/3 max-w-sm animate-pulse rounded bg-gray-100" />
    {[0, 1, 2, 3].map((row) => <span key={row} className="block h-16 animate-pulse rounded-xl bg-gray-50" />)}
  </div>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <section className="rounded-3xl border border-dashed border-line px-5 py-12 text-center">
    <h2 className="font-heading text-xl font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm text-subtle">{description}</p>
    {action ? <div className="mx-auto mt-6 max-w-xs">{action}</div> : null}
  </section>;
}
export function NoAccessState({ title = 'You do not have access', description = 'Ask your business owner or platform administrator to grant access.' }: { title?: string; description?: string }) {
  return <section role="status" className="rounded-3xl border border-line p-6 md:p-10"><h1 className="font-heading text-2xl font-semibold">{title}</h1><p className="mt-3 text-sm text-subtle">{description}</p><Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4">Go to dashboard</Link></section>;
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const presentation = presentError(error);
  return <section className="rounded-3xl border border-line p-6 md:p-8"><InlineError className="text-base">{presentation.message}</InlineError>
    {presentation.kind === 'auth' ? <Link href="/auth/login" className="mt-5 inline-flex min-h-11 items-center font-semibold text-primary underline">Log in again</Link> : presentation.retryable && retry ? <div className="mt-5 max-w-xs"><PrimaryButton shape="rounded" onClick={retry}>Try again</PrimaryButton></div> : null}
  </section>;
}
