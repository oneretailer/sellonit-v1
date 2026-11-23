import type { SupplierStatus } from '@/lib/workspace/types';
import { cn } from '@/lib/cn';

export function supplierStatusMessage(status: SupplierStatus | null): string | null {
  switch (status) {
    case 'APPROVED':
      return null;
    case 'PENDING_REVIEW':
      return 'Your supplier account is awaiting review. You can prepare products; publishing unlocks after approval.';
    case 'REJECTED':
      return 'Your supplier application was not approved. Contact support to review your application.';
    case 'SUSPENDED':
      return 'Your supplier account is suspended. Publishing is disabled until it is reinstated.';
    case 'DRAFT':
      return 'Your supplier profile is still a draft. Complete your verification details before submitting for review.';
    case null:
      return 'Supplier status is not available. Publishing remains disabled until approval is confirmed.';
  }
}

export function StatusBanner({
  status,
  reason,
  className,
}: {
  status: SupplierStatus | null;
  reason?: string | null;
  className?: string;
}) {
  const message = supplierStatusMessage(status);
  if (!message) return null;
  const isDanger = status === 'REJECTED' || status === 'SUSPENDED';

  return (
    <aside
      role="status"
      className={cn(
        'rounded-ws-card border px-4 py-3.5 text-[length:var(--text-ws-body)] leading-6 text-ink',
        isDanger ? 'border-danger/30 bg-danger-tint' : 'border-primary/25 bg-primary-tint',
        className,
      )}
    >
      <div>
        <strong className="font-semibold">
          Supplier account: {status?.replaceAll('_', ' ').toLowerCase() ?? 'unknown'}.{' '}
        </strong>
        <span className="text-subtle">{message}</span>
      </div>
      {reason?.trim() ? (
        <p className="mt-1.5 text-[length:var(--text-ws-label)] text-ink">
          <span className="font-semibold">Review note:</span> {reason.trim()}
        </p>
      ) : null}
    </aside>
  );
}

export function StatusChip({ status }: { status: string }) {
  const approved = status === 'APPROVED' || status === 'PUBLISHED';
  const pending = status === 'PENDING_REVIEW';
  const neutral = status === 'DRAFT' || status === 'UNPUBLISHED';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-ws-pill px-3 py-1 text-[length:var(--text-ws-caption)] font-medium',
        approved
          ? 'bg-status-published-bg text-status-published-fg'
          : pending
            ? 'bg-primary-tint text-primary-hover'
            : neutral
              ? 'bg-status-draft-bg text-status-draft-fg'
              : 'bg-danger-tint text-danger',
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {status.replaceAll('_', ' ')}
    </span>
  );
}
