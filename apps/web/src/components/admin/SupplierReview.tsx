'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TextField } from '@/components/reuseable/TextField';
import { InlineError } from '@/components/reuseable/InlineError';
import { ApiError } from '@/lib/api-client';
import { ConfirmDialog } from '@/components/workspace/ConfirmDialog';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { ErrorState, LoadingState } from '@/components/workspace/StatePanel';
import { StatusChip } from '@/components/workspace/StatusBanner';
import { useToast } from '@/components/workspace/ToastProvider';
import { useSession } from '@/lib/auth/AuthSessionProvider';
import { getSupplier, transitionSupplier } from '@/lib/workspace/adminApi';
import { availableSupplierActions } from '@/lib/workspace/adminActions';
import { presentError } from '@/lib/workspace/errors';
import { workspaceKeys } from '@/lib/workspace/queryKeys';
import type { SupplierAction, SupplierDetail, SupplierPlan } from '@/lib/workspace/types';

const MAX_REASON_LENGTH = 2000;
const VALID_PLANS: readonly SupplierPlan[] = ['ENTERPRISE', 'ENTERPRISE_PLUS'];

const labels: Record<SupplierAction, string> = {
  approve: 'Approve supplier',
  reject: 'Reject supplier',
  suspend: 'Suspend supplier',
  reinstate: 'Reinstate supplier',
};

function formatRetailerAccess(access: SupplierDetail['profile']['retailerAccess']): string {
  switch (access) {
    case 'OPEN':
      return 'Open to all retailers';
    case 'APPROVAL_REQUIRED':
      return 'Approval required';
    case 'PRIVATE':
      return 'Private (invite only)';
    case undefined:
      return 'Not specified';
  }
}

function formatOriginLocation(profile: SupplierDetail['profile'] | undefined): string {
  const origin = profile?.originLocation as Record<string, unknown> | null | undefined;
  if (!origin || typeof origin !== 'object') return 'Not provided';
  const parts = [origin.addressLine1, origin.addressLine2, origin.city, origin.state, origin.country]
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
  return parts.length > 0 ? parts.join(', ') : 'Not provided';
}

export function SupplierReview({ id }: { id: string }) {
  const { user, refreshSession } = useSession();
  const queryClient = useQueryClient();
  const notify = useToast();
  const query = useQuery({
    queryKey: workspaceKeys.supplier(user?.id ?? '', id),
    queryFn: ({ signal }) => getSupplier(id, signal),
    enabled: !!user,
  });
  const [action, setAction] = useState<SupplierAction | null>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<SupplierPlan>('ENTERPRISE');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!action) throw new Error('Choose an action.');
      const trimmedNote = note.trim();
      return transitionSupplier(id, action, {
        reason: reason.trim(),
        plan,
        ...(action === 'approve' && trimmedNote ? { note: trimmedNote } : {}),
      });
    },
    onSuccess: async (supplier) => {
      queryClient.setQueryData(workspaceKeys.supplier(user?.id ?? '', id), supplier);
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.suppliers(user?.id ?? '') });
      setAction(null);
      notify(`Supplier ${supplier.status.toLowerCase().replaceAll('_', ' ')}.`);
    },
    onError: async (error) => {
      const presented = presentError(error);
      if (presented.kind === 'auth') await refreshSession();
      if (presented.kind === 'conflict') {
        await query.refetch();
        setAction(null);
        notify(presented.message, 'error');
      }
      if (presented.kind === 'validation') {
        const fields = error instanceof ApiError ? error.fields : null;
        if (fields?.reason) {
          setFieldError(fields.reason);
        } else if (action === 'reject' || action === 'suspend') {
          setFieldError(presented.message);
        }
        if (fields?.plan) {
          setPlanError(fields.plan);
        } else if (action === 'approve') {
          setPlanError(presented.message);
        }
      }
    },
  });

  if (query.isPending) return <LoadingState label="Loading supplier profile" />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;

  const supplier = query.data;
  const profileRecord = supplier.profile as SupplierDetail['profile'] & {
    reviewedAt?: string | null;
  };
  const actions = availableSupplierActions(supplier.status);
  const needsReason = action === 'reject' || action === 'suspend';

  function confirm() {
    if (action === 'approve') {
      if (!VALID_PLANS.includes(plan)) {
        setPlanError('Select Enterprise or Enterprise Plus.');
        return;
      }
      if (note.trim().length > MAX_REASON_LENGTH) {
        setFieldError(`Note must be ${MAX_REASON_LENGTH.toLocaleString('en-US')} characters or fewer.`);
        return;
      }
    }
    if (needsReason) {
      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        setFieldError('A reason is required.');
        return;
      }
      if (trimmedReason.length > MAX_REASON_LENGTH) {
        setFieldError(
          `Reason must be ${MAX_REASON_LENGTH.toLocaleString('en-US')} characters or fewer.`,
        );
        return;
      }
    }
    setFieldError(null);
    setPlanError(null);
    mutation.mutate();
  }

  return (
    <section className="max-w-5xl min-w-0">
      <Link
        href="/admin/suppliers"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
      >
        Back to suppliers
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold md:text-3xl">
            {supplier.businessName}
          </h1>
          <p className="mt-2 text-sm text-subtle">
            Submitted{' '}
            {supplier.submittedAt
              ? new Date(supplier.submittedAt).toLocaleDateString('en-NG')
              : 'Not yet submitted'}
            {profileRecord?.reviewedAt
              ? ` · Last reviewed ${new Date(profileRecord.reviewedAt).toLocaleDateString('en-NG')}`
              : ''}
          </p>
        </div>
        <StatusChip status={supplier.status} />
      </div>

      <dl className="mt-6 grid gap-5 rounded-3xl border border-line bg-white p-6 sm:grid-cols-2">
        {[
          ['Owner', supplier.ownerName || 'Not provided'],
          ['Phone', supplier.ownerPhone || 'Not provided'],
          ['Email', supplier.ownerEmail || 'Not provided'],
          ['Plan', supplier.plan?.replaceAll('_', ' ') ?? 'Not assigned'],
          ['Legal business name', supplier.profile?.legalName || 'Not provided'],
          ['Business contact phone', supplier.profile?.contactPhone || 'Not provided'],
          ['Retailer access', formatRetailerAccess(supplier.profile?.retailerAccess)],
          ['Origin / dispatch address', formatOriginLocation(supplier.profile)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-subtle">{label}</dt>
            <dd className="mt-1 break-words text-sm">{value}</dd>
          </div>
        ))}
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold text-subtle">Business description</dt>
          <dd className="mt-2 whitespace-pre-wrap text-sm leading-6">
            {supplier.profile?.description || supplier.description || 'No description provided.'}
          </dd>
        </div>
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        {actions.map((next) => (
          <div key={next} className="w-full sm:w-auto">
            <PrimaryButton
              shape="rounded"
              className="text-base"
              onClick={() => {
                setAction(next);
                setReason('');
                setNote('');
                setFieldError(null);
                setPlanError(null);
                mutation.reset();
              }}
            >
              {labels[next]}
            </PrimaryButton>
          </div>
        ))}
      </div>
      {!actions.length ? (
        <p className="mt-4 text-sm text-subtle">No review actions are available for this status.</p>
      ) : null}

      <section className="mt-9">
        <h2 className="font-heading text-xl font-semibold">Audit history</h2>
        {!supplier.auditHistory.length ? (
          <p className="mt-4 text-sm text-subtle">No review events yet.</p>
        ) : (
          <ol className="mt-5 space-y-4">
            {[...supplier.auditHistory].reverse().map((event) => (
              <li key={event.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className="text-sm">{event.action.replaceAll('_', ' ')}</strong>
                  <time dateTime={event.createdAt} className="text-xs text-subtle">
                    {new Date(event.createdAt).toLocaleString('en-NG')}
                  </time>
                </div>
                <p className="mt-2 text-sm text-subtle">
                  {event.actorName} · {event.fromStatus?.replaceAll('_', ' ') ?? 'New'} →{' '}
                  {event.toStatus.replaceAll('_', ' ')}
                </p>
                {event.reason ? <p className="mt-2 text-sm">{event.reason}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <ConfirmDialog
        open={action !== null}
        title={action ? labels[action] : 'Confirm action'}
        description="This changes the supplier’s account access. The decision will be recorded in the audit history."
        confirmLabel={action ? labels[action] : 'Confirm'}
        pending={mutation.isPending}
        error={
          fieldError ??
          planError ??
          (mutation.isError ? presentError(mutation.error).message : null)
        }
        onClose={() => {
          setAction(null);
          mutation.reset();
        }}
        onConfirm={confirm}
      >
        {action === 'approve' ? (
          <div className="flex flex-col gap-4">
            <label className="block text-sm font-medium">
              Approval plan
              <select
                aria-label="Approval plan"
                value={plan}
                onChange={(event) => {
                  setPlan(event.target.value as SupplierPlan);
                  setPlanError(null);
                }}
                disabled={mutation.isPending}
                className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-3"
              >
                <option value="ENTERPRISE">Enterprise</option>
                <option value="ENTERPRISE_PLUS">Enterprise Plus</option>
              </select>
              {planError ? <InlineError className="mt-2">{planError}</InlineError> : null}
            </label>
            <TextField
              id="approval-note"
              label="Approval note (optional)"
              placeholder="Optional note recorded in audit history"
              value={note}
              onChange={(value) => {
                setNote(value);
                setFieldError(null);
              }}
              error={fieldError}
              maxLength={MAX_REASON_LENGTH}
              disabled={mutation.isPending}
            />
          </div>
        ) : null}
        {needsReason ? (
          <TextField
            id="review-reason"
            label="Reason (required)"
            value={reason}
            onChange={(value) => {
              setReason(value);
              setFieldError(null);
            }}
            error={fieldError}
            maxLength={MAX_REASON_LENGTH}
            disabled={mutation.isPending}
          />
        ) : null}
      </ConfirmDialog>
    </section>
  );
}
