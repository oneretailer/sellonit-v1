'use client';

/**
 * Supplier Business Profile screen (`/dashboard/business-profile`).
 *
 * Synced to the live backend routes & approval workflow:
 * - `GET  /api/v1/supplier/:businessId/profile`
 * - `PUT  /api/v1/supplier/:businessId/profile`
 * - `POST /api/v1/supplier/:businessId/profile/submit` (`DRAFT -> PENDING_REVIEW`)
 */
import { useState, type FormEvent } from 'react';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { Input, Select, Textarea } from '@/components/workspace/Field';
import { ErrorState, LoadingState } from '@/components/workspace/StatePanel';
import { StatusBanner, StatusChip } from '@/components/workspace/StatusBanner';
import { useToast } from '@/components/workspace/ToastProvider';
import { useBusiness } from '@/lib/business/BusinessProvider';
import {
  useSaveSupplierProfileMutation,
  useSubmitSupplierProfileMutation,
  useSupplierProfileQuery,
  type RetailerAccessMode,
  type SupplierProfileRecord,
} from '@/lib/supplier/supplierProfileApi';
import {
  canEditSupplierProfileStatus,
  canSubmitSupplierProfileStatus,
  MAX_ADDRESS_LINE1_LENGTH,
  MAX_CITY_LENGTH,
  MAX_CONTACT_PHONE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_LEGAL_NAME_LENGTH,
  MAX_STATE_LENGTH,
  toSupplierProfilePayload,
  validateSupplierProfile,
  type SupplierProfileErrors,
  type SupplierProfileFieldKey,
  type SupplierProfileFormValues,
  type SupplierProfileValidationMode,
} from '@/lib/supplier/validation';
import { presentError } from '@/lib/workspace/errors';

function initialValues(
  profile: SupplierProfileRecord,
  fallbackBusinessName: string,
): SupplierProfileFormValues {
  const origin = profile.originLocation ?? {};
  return {
    legalName: profile.legalName ?? fallbackBusinessName,
    contactPhone: profile.contactPhone ?? '',
    description: profile.description ?? '',
    retailerAccess: profile.retailerAccess ?? 'APPROVAL_REQUIRED',
    addressLine1: typeof origin.addressLine1 === 'string' ? origin.addressLine1 : '',
    city: typeof origin.city === 'string' ? origin.city : '',
    state: typeof origin.state === 'string' ? origin.state : '',
    country: typeof origin.country === 'string' && origin.country ? origin.country : 'NG',
  };
}

function statusLockMessage(status: SupplierProfileRecord['status']): string | null {
  switch (status) {
    case 'PENDING_REVIEW':
      return 'Your verification details are locked while an administrator reviews your application.';
    case 'REJECTED':
      return 'Resubmission is locked for rejected applications. Contact support if you need a manual re-evaluation.';
    case 'SUSPENDED':
      return 'Your supplier account is suspended. Profile updates are disabled until an administrator reinstates your account.';
    case 'DRAFT':
    case 'APPROVED':
      return null;
  }
}

function SupplierProfileEditor({
  businessId,
  businessName,
  profile,
  canEditRole,
  onConflictRefresh,
}: {
  businessId: string;
  businessName: string;
  profile: SupplierProfileRecord;
  canEditRole: boolean;
  onConflictRefresh: () => Promise<unknown>;
}) {
  const notify = useToast();
  const [values, setValues] = useState<SupplierProfileFormValues>(() =>
    initialValues(profile, businessName),
  );
  const [errors, setErrors] = useState<SupplierProfileErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const saveMutation = useSaveSupplierProfileMutation(businessId);
  const submitMutation = useSubmitSupplierProfileMutation(businessId);
  const busy = saveMutation.isPending || submitMutation.isPending;

  const statusEditable = canEditSupplierProfileStatus(profile.status);
  const canEdit = canEditRole && statusEditable;
  const canSubmitForReview = canEditRole && canSubmitSupplierProfileStatus(profile.status);
  const lockNotice = statusLockMessage(profile.status);

  function updateField<K extends SupplierProfileFieldKey>(
    key: K,
    value: SupplierProfileFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
    setFormError(null);
  }

  function runValidation(mode: SupplierProfileValidationMode): boolean {
    const nextErrors = validateSupplierProfile(values, mode);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || busy) return;
    setFormError(null);
    if (!runValidation('save')) return;
    try {
      await saveMutation.mutateAsync(toSupplierProfilePayload(values));
      notify('Supplier profile saved.');
    } catch (caught) {
      const presented = presentError(caught);
      if (presented.kind === 'conflict') {
        await onConflictRefresh();
      }
      setFormError(presented.message);
    }
  }

  async function handleSubmitForReview() {
    if (!canSubmitForReview || busy) return;
    setFormError(null);
    if (!runValidation('submit')) return;
    try {
      await submitMutation.mutateAsync(toSupplierProfilePayload(values));
      notify('Supplier profile submitted for review.');
    } catch (caught) {
      const presented = presentError(caught);
      if (presented.kind === 'conflict') {
        await onConflictRefresh();
      }
      setFormError(presented.message);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink md:text-[28px]">
            Business profile
          </h1>
          <p className="mt-1 text-sm text-subtle">
            Manage your supplier verification details and retailer access preferences.
          </p>
        </div>
        <StatusChip status={profile.status} />
      </div>

      <StatusBanner status={profile.status} />

      {!canEditRole ? (
        <p
          role="status"
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-subtle"
        >
          Only business owners and managers can edit or submit the supplier profile.
        </p>
      ) : lockNotice ? (
        <p
          role="status"
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-subtle"
        >
          {lockNotice}
        </p>
      ) : null}

      <form
        onSubmit={(event) => void handleSave(event)}
        noValidate
        className="flex flex-col gap-6 rounded-3xl border border-line bg-white p-5 md:p-7"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <Input
            id="supplier-legal-name"
            label="Legal business name"
            required
            maxLength={MAX_LEGAL_NAME_LENGTH}
            value={values.legalName}
            onChange={(event) => updateField('legalName', event.target.value)}
            error={errors.legalName ?? null}
            disabled={!canEdit || busy}
          />
          <Input
            id="supplier-contact-phone"
            label="Contact phone"
            required={canSubmitForReview}
            type="tel"
            inputMode="tel"
            maxLength={MAX_CONTACT_PHONE_LENGTH}
            placeholder="08031234567"
            value={values.contactPhone}
            onChange={(event) => updateField('contactPhone', event.target.value)}
            error={errors.contactPhone ?? null}
            disabled={!canEdit || busy}
          />
        </div>

        <Textarea
          id="supplier-description"
          label="Business description"
          required={canSubmitForReview}
          maxLength={MAX_DESCRIPTION_LENGTH}
          helper="Required before submitting for verification (at least 10 characters)."
          placeholder="Describe the products you supply and your wholesale capabilities"
          value={values.description}
          onChange={(event) => updateField('description', event.target.value)}
          error={errors.description ?? null}
          disabled={!canEdit || busy}
        />

        <Select
          id="supplier-retailer-access"
          label="Retailer access"
          helper="Controls how retailers on Sellonit can access your wholesale catalogue."
          value={values.retailerAccess}
          onChange={(event) =>
            updateField('retailerAccess', event.target.value as RetailerAccessMode)
          }
          error={errors.retailerAccess ?? null}
          disabled={!canEdit || busy}
        >
          <option value="OPEN">Open to all retailers</option>
          <option value="APPROVAL_REQUIRED">Require approval before access</option>
          <option value="PRIVATE">Private (invite only)</option>
        </Select>

        <fieldset className="flex flex-col gap-4 border-t border-line pt-5">
          <legend className="text-sm font-semibold text-ink">Origin / dispatch location</legend>
          <p className="text-xs text-subtle">
            Complete dispatch location details are required before submitting for administrator
            verification.
          </p>
          <div className="grid gap-5 md:grid-cols-2">
            <Input
              id="supplier-origin-line1"
              label="Street address"
              required={canSubmitForReview}
              maxLength={MAX_ADDRESS_LINE1_LENGTH}
              placeholder="12 Marina Road"
              value={values.addressLine1}
              onChange={(event) => updateField('addressLine1', event.target.value)}
              error={errors.addressLine1 ?? null}
              disabled={!canEdit || busy}
            />
            <Input
              id="supplier-origin-city"
              label="City"
              required={canSubmitForReview}
              maxLength={MAX_CITY_LENGTH}
              placeholder="Lagos"
              value={values.city}
              onChange={(event) => updateField('city', event.target.value)}
              error={errors.city ?? null}
              disabled={!canEdit || busy}
            />
            <Input
              id="supplier-origin-state"
              label="State"
              required={canSubmitForReview}
              maxLength={MAX_STATE_LENGTH}
              placeholder="Lagos"
              value={values.state}
              onChange={(event) => updateField('state', event.target.value)}
              error={errors.state ?? null}
              disabled={!canEdit || busy}
            />
            <Input
              id="supplier-origin-country"
              label="Country"
              required={canSubmitForReview}
              maxLength={2}
              placeholder="NG"
              value={values.country}
              onChange={(event) => updateField('country', event.target.value.toUpperCase())}
              error={errors.country ?? null}
              disabled={!canEdit || busy}
            />
          </div>
        </fieldset>

        {formError ? <InlineError>{formError}</InlineError> : null}

        {canEdit ? (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-5">
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-gray-50 disabled:opacity-60"
            >
              {saveMutation.isPending ? 'Saving…' : 'Save profile'}
            </button>
            {canSubmitForReview ? (
              <div className="w-full sm:w-auto">
                <PrimaryButton
                  type="button"
                  shape="rounded"
                  loading={submitMutation.isPending}
                  disabled={busy}
                  onClick={() => void handleSubmitForReview()}
                  className="min-h-11 px-6 text-sm"
                >
                  {submitMutation.isPending ? 'Submitting…' : 'Submit for review'}
                </PrimaryButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}

export function SupplierProfilePage() {
  const { activeBusiness, can } = useBusiness();
  const businessId = activeBusiness?.id ?? null;
  const profileQuery = useSupplierProfileQuery(businessId);
  const canEditRole = can('product:write');

  if (profileQuery.isPending || !activeBusiness) {
    return <LoadingState label="Loading supplier profile" />;
  }
  if (profileQuery.isError || !profileQuery.data) {
    return <ErrorState error={profileQuery.error} retry={() => void profileQuery.refetch()} />;
  }

  return (
    <SupplierProfileEditor
      key={`${activeBusiness.id}:${profileQuery.data.updatedAt ?? profileQuery.data.status}`}
      businessId={activeBusiness.id}
      businessName={activeBusiness.name}
      profile={profileQuery.data}
      canEditRole={canEditRole}
      onConflictRefresh={() => profileQuery.refetch()}
    />
  );
}
