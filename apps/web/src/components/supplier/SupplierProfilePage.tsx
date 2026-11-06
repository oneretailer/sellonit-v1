'use client';

/**
 * Supplier Business Profile screen (`/dashboard/business-profile`).
 *
 * Synced to the live backend routes:
 * - `GET  /api/v1/supplier/:businessId/profile`
 * - `PUT  /api/v1/supplier/:businessId/profile`
 * - `POST /api/v1/supplier/:businessId/profile/submit`
 */
import { useState, type FormEvent } from 'react';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { Input, Select, Textarea } from '@/components/workspace/Field';
import { ErrorState, LoadingState } from '@/components/workspace/StatePanel';
import { StatusBanner, StatusChip } from '@/components/workspace/StatusBanner';
import { useToast } from '@/components/workspace/ToastProvider';
import { normalizePhone } from '@/lib/auth/identifier';
import { useBusiness } from '@/lib/business/BusinessProvider';
import {
  useSaveSupplierProfileMutation,
  useSubmitSupplierProfileMutation,
  useSupplierProfileQuery,
  type RetailerAccessMode,
  type SupplierProfileRecord,
  type UpsertSupplierProfilePayload,
} from '@/lib/supplier/supplierProfileApi';
import { presentError } from '@/lib/workspace/errors';

type ProfileFormValues = {
  legalName: string;
  contactPhone: string;
  description: string;
  retailerAccess: RetailerAccessMode;
  addressLine1: string;
  city: string;
  state: string;
  country: string;
};

function initialValues(
  profile: SupplierProfileRecord,
  fallbackBusinessName: string,
): ProfileFormValues {
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

function toPayload(values: ProfileFormValues): UpsertSupplierProfilePayload {
  const hasOrigin =
    values.addressLine1.trim().length > 0 ||
    values.city.trim().length > 0 ||
    values.state.trim().length > 0;
  return {
    legalName: values.legalName.trim(),
    contactPhone: normalizePhone(values.contactPhone) ?? values.contactPhone.trim(),
    description: values.description.trim(),
    retailerAccess: values.retailerAccess,
    ...(hasOrigin
      ? {
          originLocation: {
            recipientName: values.legalName.trim(),
            phone: normalizePhone(values.contactPhone) ?? values.contactPhone.trim(),
            addressLine1: values.addressLine1.trim(),
            city: values.city.trim(),
            state: values.state.trim(),
            country: values.country.trim() || 'NG',
          },
        }
      : {}),
  };
}

function SupplierProfileEditor({
  businessId,
  businessName,
  profile,
  canEdit,
}: {
  businessId: string;
  businessName: string;
  profile: SupplierProfileRecord;
  canEdit: boolean;
}) {
  const notify = useToast();
  const [values, setValues] = useState<ProfileFormValues>(() =>
    initialValues(profile, businessName),
  );
  const [errors, setErrors] = useState<Partial<Record<'legalName' | 'contactPhone', string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const saveMutation = useSaveSupplierProfileMutation(businessId);
  const submitMutation = useSubmitSupplierProfileMutation(businessId);
  const busy = saveMutation.isPending || submitMutation.isPending;
  const canSubmitForReview =
    canEdit && (profile.status === 'DRAFT' || profile.status === 'REJECTED');

  function validate(): boolean {
    const nextErrors: Partial<Record<'legalName' | 'contactPhone', string>> = {};
    if (values.legalName.trim().length < 2) {
      nextErrors.legalName = 'Enter your legal business name.';
    }
    if (values.contactPhone.trim().length > 0 && normalizePhone(values.contactPhone) === null) {
      nextErrors.contactPhone = 'Enter a valid Nigerian phone number.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || busy) return;
    setFormError(null);
    if (!validate()) return;
    try {
      await saveMutation.mutateAsync(toPayload(values));
      notify('Supplier profile saved.');
    } catch (caught) {
      setFormError(presentError(caught).message);
    }
  }

  async function handleSubmitForReview() {
    if (!canSubmitForReview || busy) return;
    setFormError(null);
    if (!validate()) return;
    try {
      await submitMutation.mutateAsync(toPayload(values));
      notify('Supplier profile submitted for review.');
    } catch (caught) {
      setFormError(presentError(caught).message);
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

      {!canEdit ? (
        <p
          role="status"
          className="rounded-2xl border border-line bg-white px-4 py-3 text-sm text-subtle"
        >
          Only business owners and managers can edit or submit the supplier profile.
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
            value={values.legalName}
            onChange={(event) => {
              setValues((current) => ({ ...current, legalName: event.target.value }));
              setErrors((current) => ({ ...current, legalName: undefined }));
              setFormError(null);
            }}
            error={errors.legalName ?? null}
            disabled={!canEdit || busy}
          />
          <Input
            id="supplier-contact-phone"
            label="Contact phone"
            type="tel"
            inputMode="tel"
            placeholder="08031234567"
            value={values.contactPhone}
            onChange={(event) => {
              setValues((current) => ({ ...current, contactPhone: event.target.value }));
              setErrors((current) => ({ ...current, contactPhone: undefined }));
              setFormError(null);
            }}
            error={errors.contactPhone ?? null}
            disabled={!canEdit || busy}
          />
        </div>

        <Textarea
          id="supplier-description"
          label="Business description"
          placeholder="Describe the products you supply and your wholesale capabilities"
          value={values.description}
          onChange={(event) => {
            setValues((current) => ({ ...current, description: event.target.value }));
            setFormError(null);
          }}
          disabled={!canEdit || busy}
        />

        <Select
          id="supplier-retailer-access"
          label="Retailer access"
          helper="Controls how retailers on Sellonit can access your wholesale catalogue."
          value={values.retailerAccess}
          onChange={(event) => {
            setValues((current) => ({
              ...current,
              retailerAccess: event.target.value as RetailerAccessMode,
            }));
            setFormError(null);
          }}
          disabled={!canEdit || busy}
        >
          <option value="OPEN">Open to all retailers</option>
          <option value="APPROVAL_REQUIRED">Require approval before access</option>
          <option value="PRIVATE">Private (invite only)</option>
        </Select>

        <fieldset className="flex flex-col gap-4 border-t border-line pt-5">
          <legend className="text-sm font-semibold text-ink">Origin / dispatch location</legend>
          <div className="grid gap-5 md:grid-cols-2">
            <Input
              id="supplier-origin-line1"
              label="Street address"
              placeholder="12 Marina Road"
              value={values.addressLine1}
              onChange={(event) =>
                setValues((current) => ({ ...current, addressLine1: event.target.value }))
              }
              disabled={!canEdit || busy}
            />
            <Input
              id="supplier-origin-city"
              label="City"
              placeholder="Lagos"
              value={values.city}
              onChange={(event) =>
                setValues((current) => ({ ...current, city: event.target.value }))
              }
              disabled={!canEdit || busy}
            />
            <Input
              id="supplier-origin-state"
              label="State"
              placeholder="Lagos"
              value={values.state}
              onChange={(event) =>
                setValues((current) => ({ ...current, state: event.target.value }))
              }
              disabled={!canEdit || busy}
            />
            <Input
              id="supplier-origin-country"
              label="Country"
              placeholder="NG"
              value={values.country}
              onChange={(event) =>
                setValues((current) => ({ ...current, country: event.target.value }))
              }
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
  const canEdit = can('product:write');

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
      canEdit={canEdit}
    />
  );
}
