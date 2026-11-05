import type { SupplierStatus } from '@/lib/workspace/types';

export function supplierStatusMessage(status: SupplierStatus | null): string | null {
  switch (status) {
    case 'APPROVED': return null;
    case 'PENDING_REVIEW': return 'Your supplier account is awaiting review. You can prepare products; publishing unlocks after approval.';
    case 'REJECTED': return 'Your supplier application was not approved. Contact support to review your application.';
    case 'SUSPENDED': return 'Your supplier account is suspended. Publishing is disabled until it is reinstated.';
    case 'DRAFT': return 'Your supplier profile is still a draft. Complete setup before submitting for review.';
    case null: return 'Supplier status is not available. Publishing remains disabled until approval is confirmed.';
  }
}
export function StatusBanner({ status }: { status: SupplierStatus | null }) {
  const message = supplierStatusMessage(status);
  if (!message) return null;
  return <aside role="status" className="mb-6 rounded-2xl border border-primary/30 bg-orange-50 px-4 py-3 text-sm leading-6 text-ink"><strong className="font-semibold">Supplier account: {status?.replaceAll('_', ' ').toLowerCase() ?? 'unknown'}. </strong>{message}</aside>;
}
export function StatusChip({ status }: { status: string }) {
  const approved = status === 'APPROVED' || status === 'PUBLISHED';
  const warning = status === 'PENDING_REVIEW' || status === 'DRAFT' || status === 'UNPUBLISHED';
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${approved ? 'bg-green-50 text-success' : warning ? 'bg-orange-50 text-amber-800' : 'bg-red-50 text-danger'}`}>{status.replaceAll('_', ' ')}</span>;
}
