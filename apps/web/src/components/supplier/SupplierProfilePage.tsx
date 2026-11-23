'use client';

/**
 * Supplier Business Profile screen (`/dashboard/business-profile`).
 *
 * Synced to the live backend routes & approval workflow:
 * - `GET  /api/v1/supplier/:businessId/profile`
 * - `PUT  /api/v1/supplier/:businessId/profile`
 * - `POST /api/v1/supplier/:businessId/profile/submit` (`DRAFT -> PENDING_REVIEW`)
 */
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { DashboardIcon } from '@/components/dashboard/icons';
import { Spinner } from '@/components/reuseable/Spinner';
import { ConfirmDialog } from '@/components/workspace/ConfirmDialog';
import { Dialog, dialogPrimaryClass, dialogSecondaryClass } from '@/components/workspace/Dialog';
import { Input, Select, Textarea } from '@/components/workspace/Field';
import { useOptionalNavigationGuard } from '@/components/workspace/NavigationGuard';
import { ErrorState, LoadingState } from '@/components/workspace/StatePanel';
import { StatusBanner, StatusChip } from '@/components/workspace/StatusBanner';
import { useToast } from '@/components/workspace/ToastProvider';
import {
  businessPlanLabel,
  businessRoleLabel,
  type SwitcherBusiness,
} from '@/lib/business/businessesApi';
import { useBusiness } from '@/lib/business/BusinessProvider';
import { normalizePhone } from '@/lib/auth/identifier';
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
  MAX_ADDRESS_LINE2_LENGTH,
  MAX_AREA_LENGTH,
  MAX_CITY_LENGTH,
  MAX_CONTACT_PHONE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_LEGAL_NAME_LENGTH,
  MAX_RECIPIENT_NAME_LENGTH,
  MAX_STATE_LENGTH,
  MIN_ADDRESS_LINE1_LENGTH,
  MIN_DESCRIPTION_SUBMIT_LENGTH,
  MIN_LEGAL_NAME_LENGTH,
  NIGERIA_STATES,
  SUPPORTED_COUNTRIES,
  SUPPLIER_PROFILE_FIELD_ORDER,
  toSupplierProfilePayload,
  validateSupplierProfile,
  type SupplierProfileErrors,
  type SupplierProfileFieldKey,
  type SupplierProfileFormValues,
  type SupplierProfileValidationMode,
} from '@/lib/supplier/validation';
import { presentError } from '@/lib/workspace/errors';

const FIELD_DOM_IDS: Record<SupplierProfileFieldKey, string> = {
  legalName: 'supplier-legal-name',
  contactPhone: 'supplier-contact-phone',
  description: 'supplier-description',
  retailerAccess: 'supplier-retailer-access',
  addressLine1: 'supplier-origin-line1',
  addressLine2: 'supplier-origin-line2',
  area: 'supplier-origin-area',
  city: 'supplier-origin-city',
  state: 'supplier-origin-state',
  country: 'supplier-origin-country',
  dispatchRecipientName: 'supplier-dispatch-recipient',
  dispatchPhone: 'supplier-dispatch-phone',
};

function initialValues(
  profile: SupplierProfileRecord,
  fallbackBusinessName: string,
): SupplierProfileFormValues {
  const origin = profile.originLocation ?? {};
  const legalName = profile.legalName ?? fallbackBusinessName;
  const contactPhone = profile.contactPhone ?? '';
  const originRecipient = typeof origin.recipientName === 'string' ? origin.recipientName : '';
  const originPhone = typeof origin.phone === 'string' ? origin.phone : '';

  return {
    legalName,
    contactPhone,
    description: profile.description ?? '',
    retailerAccess: profile.retailerAccess ?? 'OPEN',
    addressLine1: typeof origin.addressLine1 === 'string' ? origin.addressLine1 : '',
    addressLine2: typeof origin.addressLine2 === 'string' ? origin.addressLine2 : '',
    area: typeof origin.area === 'string' ? origin.area : '',
    city: typeof origin.city === 'string' ? origin.city : '',
    state: typeof origin.state === 'string' ? origin.state : '',
    country: typeof origin.country === 'string' && origin.country ? origin.country : 'NG',
    dispatchRecipientName: originRecipient && originRecipient !== legalName ? originRecipient : '',
    dispatchPhone:
      originPhone &&
      normalizePhone(originPhone) !== (contactPhone ? normalizePhone(contactPhone) : null) &&
      originPhone !== contactPhone
        ? originPhone
        : '',
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

function formatProfileTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-ws-card border border-line bg-surface p-5 shadow-ws-card sm:p-6">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description ? (
          <p className="mt-1 text-[length:var(--text-ws-caption)] text-caption">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function CheckDot({ done }: { done: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={
        done
          ? 'flex size-5 shrink-0 items-center justify-center rounded-ws-pill bg-status-published-bg text-status-published-fg'
          : 'flex size-5 shrink-0 items-center justify-center rounded-ws-pill border border-line bg-canvas text-caption'
      }
    >
      {done ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="size-3"
        >
          <path d="m5 12 5 5 9-10" />
        </svg>
      ) : null}
    </span>
  );
}

function SupplierProfileEditor({
  business,
  profile,
  canEditRole,
  onConflictRefresh,
}: {
  business: SwitcherBusiness;
  profile: SupplierProfileRecord;
  canEditRole: boolean;
  onConflictRefresh: () => Promise<unknown>;
}) {
  const notify = useToast();
  const guard = useOptionalNavigationGuard();
  const baseline = useMemo(() => initialValues(profile, business.name), [business.name, profile]);
  const [values, setValues] = useState<SupplierProfileFormValues>(baseline);
  const [errors, setErrors] = useState<SupplierProfileErrors>({});
  const [attemptedMode, setAttemptedMode] = useState<SupplierProfileValidationMode | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const saveMutation = useSaveSupplierProfileMutation(business.id);
  const submitMutation = useSubmitSupplierProfileMutation(business.id);
  const busy = saveMutation.isPending || submitMutation.isPending;

  const statusEditable = canEditSupplierProfileStatus(profile.status);
  const canEdit = canEditRole && statusEditable;
  const canSubmitForReview = canEditRole && canSubmitSupplierProfileStatus(profile.status);
  const lockNotice = statusLockMessage(profile.status);
  const reviewReason = profile.rejectionReason ?? profile.latestReviewReason ?? null;

  const isDirty = useMemo(
    () => SUPPLIER_PROFILE_FIELD_ORDER.some((key) => (values[key] ?? '') !== (baseline[key] ?? '')),
    [baseline, values],
  );

  const resetToBaseline = useCallback(() => {
    setValues(baseline);
    setErrors({});
    setAttemptedMode(null);
    setFormError(null);
    setAlertDismissed(false);
  }, [baseline]);

  useEffect(() => {
    if (!guard) return;
    guard.registerGuard(
      isDirty && canEdit
        ? {
            isDirty: true,
            discardTitle: 'Discard unsaved changes?',
            discardDescription:
              "You have unsaved supplier profile changes. If you leave now, your edits won't be kept.",
            onDiscard: resetToBaseline,
          }
        : null,
    );
    return () => guard.registerGuard(null);
  }, [canEdit, guard, isDirty, resetToBaseline]);

  useEffect(() => {
    if (!isDirty || !canEdit) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [canEdit, isDirty]);

  function updateField<K extends SupplierProfileFieldKey>(
    key: K,
    value: SupplierProfileFormValues[K],
  ) {
    const nextValues = { ...values, [key]: value };
    setValues(nextValues);
    if (attemptedMode) {
      setErrors(validateSupplierProfile(nextValues, attemptedMode));
    } else {
      setErrors((current) => {
        if (!current[key]) return current;
        const next = { ...current };
        delete next[key];
        return next;
      });
    }
    setFormError(null);
  }

  function handleFieldBlur(key: SupplierProfileFieldKey) {
    if (!canEdit) return;
    const mode: SupplierProfileValidationMode = attemptedMode ?? 'save';
    const next = validateSupplierProfile(values, mode);
    setErrors((current) => {
      if (next[key]) return { ...current, [key]: next[key] };
      if (!current[key]) return current;
      const copy = { ...current };
      delete copy[key];
      return copy;
    });
  }

  function focusFirstInvalid(nextErrors: SupplierProfileErrors) {
    const first = SUPPLIER_PROFILE_FIELD_ORDER.find((key) => Boolean(nextErrors[key]));
    if (!first) return;
    document.getElementById(FIELD_DOM_IDS[first])?.focus();
  }

  function runValidation(mode: SupplierProfileValidationMode): boolean {
    setAttemptedMode(mode);
    setAlertDismissed(false);
    const nextErrors = validateSupplierProfile(values, mode);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(nextErrors);
      return false;
    }
    return true;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || busy) return;
    setFormError(null);
    if (!runValidation('save')) return;
    try {
      await saveMutation.mutateAsync(toSupplierProfilePayload(values, profile.originLocation));
      setAttemptedMode(null);
      notify({
        title: 'Profile saved',
        description: 'Your supplier profile changes have been saved.',
        tone: 'success',
      });
    } catch (caught) {
      const presented = presentError(caught);
      if (presented.kind === 'conflict') {
        await onConflictRefresh();
      }
      setFormError(presented.message);
    }
  }

  function requestSubmitForReview() {
    if (!canSubmitForReview || busy) return;
    setFormError(null);
    if (!runValidation('submit')) return;
    setConfirmSubmitOpen(true);
  }

  async function confirmSubmitForReview() {
    if (!canSubmitForReview || busy) return;
    setFormError(null);
    try {
      await submitMutation.mutateAsync(toSupplierProfilePayload(values, profile.originLocation));
      setConfirmSubmitOpen(false);
      setAttemptedMode(null);
      notify({
        title: 'Submitted for review',
        description: 'Your supplier profile is now awaiting administrator verification.',
        tone: 'success',
      });
    } catch (caught) {
      setConfirmSubmitOpen(false);
      const presented = presentError(caught);
      if (presented.kind === 'conflict') {
        await onConflictRefresh();
      }
      setFormError(presented.message);
    }
  }

  const checklist = useMemo(() => {
    const hasLegalName = values.legalName.trim().length >= MIN_LEGAL_NAME_LENGTH;
    const hasPhone = normalizePhone(values.contactPhone.trim()) !== null;
    const hasDescription = values.description.trim().length >= MIN_DESCRIPTION_SUBMIT_LENGTH;
    const hasAddress =
      values.addressLine1.trim().length >= MIN_ADDRESS_LINE1_LENGTH &&
      values.city.trim().length > 0 &&
      values.state.trim().length > 0 &&
      /^[A-Z]{2}$/.test(values.country.trim().toUpperCase());
    return [
      { label: 'Legal business name', done: hasLegalName },
      { label: 'Business contact phone', done: hasPhone },
      { label: 'Business description (10+ characters)', done: hasDescription },
      { label: 'Origin / dispatch address', done: hasAddress },
    ];
  }, [values]);

  const errorCount = Object.keys(errors).length;
  const submittedLabel = formatProfileTimestamp(profile.submittedAt);
  const reviewedLabel = formatProfileTimestamp(profile.reviewedAt);
  const planLabel = businessPlanLabel(business.plan);
  const countryOptions = useMemo(() => {
    const code = values.country.trim().toUpperCase();
    if (!code || SUPPORTED_COUNTRIES.some((item) => item.code === code)) {
      return SUPPORTED_COUNTRIES;
    }
    return [...SUPPORTED_COUNTRIES, { code, name: code }];
  }, [values.country]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-[length:var(--text-ws-page-title)] font-semibold text-ink">
            Business profile
          </h1>
          <p className="mt-1 text-[length:var(--text-ws-body)] text-subtle">
            Manage your supplier verification details, catalogue access, and dispatch origin.
          </p>
        </div>
        <StatusChip status={profile.status} />
      </div>

      <StatusBanner status={profile.status} reason={reviewReason} />

      {/* Top validation / API error alerts */}
      {attemptedMode && errorCount > 0 && !alertDismissed ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-ws-card border border-danger/30 bg-danger-tint px-4 py-3.5 text-[length:var(--text-ws-body)] text-danger"
        >
          <div className="flex items-start gap-3">
            <DashboardIcon name="alert" className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">
                {attemptedMode === 'submit' ? 'Profile not submitted' : 'Profile not saved'}
              </p>
              <p className="mt-0.5">
                Fix the{' '}
                {errorCount === 1 ? 'highlighted field' : `${errorCount} highlighted fields`} and
                try again.
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss alert"
            onClick={() => setAlertDismissed(true)}
            className="-m-1 flex size-8 items-center justify-center rounded-ws-control text-danger hover:bg-danger/10"
          >
            <DashboardIcon name="close" className="size-4" />
          </button>
        </div>
      ) : null}

      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-ws-card border border-danger/30 bg-danger-tint px-4 py-3.5 text-[length:var(--text-ws-body)] text-danger"
        >
          <DashboardIcon name="alert" className="mt-0.5 size-5 shrink-0" />
          <span>{formError}</span>
        </div>
      ) : null}

      {!canEditRole ? (
        <p
          role="status"
          className="rounded-ws-card border border-line bg-surface px-4 py-3.5 text-[length:var(--text-ws-body)] text-subtle shadow-ws-card"
        >
          Only business owners and managers can edit or submit the supplier profile.
        </p>
      ) : lockNotice ? (
        <p
          role="status"
          className="rounded-ws-card border border-line bg-surface px-4 py-3.5 text-[length:var(--text-ws-body)] text-subtle shadow-ws-card"
        >
          {lockNotice}
        </p>
      ) : null}

      {/* Two-column Supplier Workspace form layout */}
      <form
        onSubmit={(event) => void handleSave(event)}
        noValidate
        className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_352px]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          {/* Card 1 — Business & verification details */}
          <SectionCard
            title="Business & verification details"
            description="Official business details reviewed by Sellonit administrators and shown to connected retailers."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id={FIELD_DOM_IDS.legalName}
                label="Legal business name"
                required
                maxLength={MAX_LEGAL_NAME_LENGTH}
                placeholder="e.g. Okechukwu Fashion Ltd"
                value={values.legalName}
                onChange={(event) => updateField('legalName', event.target.value)}
                onBlur={() => handleFieldBlur('legalName')}
                error={errors.legalName ?? null}
                disabled={!canEdit || busy}
              />
              <Input
                id={FIELD_DOM_IDS.contactPhone}
                label="Contact phone"
                required={canSubmitForReview}
                type="tel"
                inputMode="tel"
                maxLength={MAX_CONTACT_PHONE_LENGTH}
                placeholder="08031234567"
                helper="Primary business phone for verification and retailer enquiries."
                value={values.contactPhone}
                onChange={(event) => updateField('contactPhone', event.target.value)}
                onBlur={() => handleFieldBlur('contactPhone')}
                error={errors.contactPhone ?? null}
                disabled={!canEdit || busy}
              />
            </div>

            <div className="flex flex-col gap-1">
              <Textarea
                id={FIELD_DOM_IDS.description}
                label="Business description"
                required={canSubmitForReview}
                maxLength={MAX_DESCRIPTION_LENGTH}
                helper="Required before submitting for verification (at least 10 characters)."
                placeholder="Describe the products you supply, minimum order terms, and wholesale capabilities"
                value={values.description}
                onChange={(event) => updateField('description', event.target.value)}
                onBlur={() => handleFieldBlur('description')}
                error={errors.description ?? null}
                disabled={!canEdit || busy}
              />
              <p className="self-end text-[length:var(--text-ws-caption)] tabular-nums text-caption">
                {values.description.length.toLocaleString('en-NG')} /{' '}
                {MAX_DESCRIPTION_LENGTH.toLocaleString('en-NG')}
              </p>
            </div>
          </SectionCard>

          {/* Card 2 — Catalogue access */}
          <SectionCard
            title="Catalogue access"
            description="Choose how retailers on Sellonit discover and request access to your wholesale catalogue."
          >
            <Select
              id={FIELD_DOM_IDS.retailerAccess}
              label="Retailer access"
              helper="Controls how retailers on Sellonit can access your wholesale catalogue."
              value={values.retailerAccess}
              onChange={(event) =>
                updateField('retailerAccess', event.target.value as RetailerAccessMode)
              }
              onBlur={() => handleFieldBlur('retailerAccess')}
              error={errors.retailerAccess ?? null}
              disabled={!canEdit || busy}
            >
              <option value="OPEN">Open to all retailers</option>
              <option value="APPROVAL_REQUIRED">Require approval before access</option>
              <option value="PRIVATE">Private (invite only)</option>
            </Select>
          </SectionCard>

          {/* Card 3 — Origin / dispatch location */}
          <SectionCard
            title="Origin / dispatch location"
            description="Primary warehouse or dispatch address used for order pickup, shipping estimates, and verification."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id={FIELD_DOM_IDS.addressLine1}
                label="Street address"
                required={canSubmitForReview}
                maxLength={MAX_ADDRESS_LINE1_LENGTH}
                placeholder="12 Marina Road"
                value={values.addressLine1}
                onChange={(event) => updateField('addressLine1', event.target.value)}
                onBlur={() => handleFieldBlur('addressLine1')}
                error={errors.addressLine1 ?? null}
                disabled={!canEdit || busy}
              />
              <Input
                id={FIELD_DOM_IDS.addressLine2}
                label="Suite, building, or landmark"
                maxLength={MAX_ADDRESS_LINE2_LENGTH}
                placeholder="Optional — e.g. Block B, Warehouse 4"
                value={values.addressLine2 ?? ''}
                onChange={(event) => updateField('addressLine2', event.target.value)}
                onBlur={() => handleFieldBlur('addressLine2')}
                error={errors.addressLine2 ?? null}
                disabled={!canEdit || busy}
              />
              <Input
                id={FIELD_DOM_IDS.area}
                label="Area / LGA"
                maxLength={MAX_AREA_LENGTH}
                placeholder="Optional — e.g. Apapa"
                value={values.area ?? ''}
                onChange={(event) => updateField('area', event.target.value)}
                onBlur={() => handleFieldBlur('area')}
                error={errors.area ?? null}
                disabled={!canEdit || busy}
              />
              <Input
                id={FIELD_DOM_IDS.city}
                label="City"
                required={canSubmitForReview}
                maxLength={MAX_CITY_LENGTH}
                placeholder="Lagos"
                value={values.city}
                onChange={(event) => updateField('city', event.target.value)}
                onBlur={() => handleFieldBlur('city')}
                error={errors.city ?? null}
                disabled={!canEdit || busy}
              />
              <div>
                <Input
                  id={FIELD_DOM_IDS.state}
                  label="State"
                  required={canSubmitForReview}
                  maxLength={MAX_STATE_LENGTH}
                  placeholder="Lagos"
                  list={
                    values.country.toUpperCase() === 'NG' ? 'supplier-nigeria-states' : undefined
                  }
                  value={values.state}
                  onChange={(event) => updateField('state', event.target.value)}
                  onBlur={() => handleFieldBlur('state')}
                  error={errors.state ?? null}
                  disabled={!canEdit || busy}
                />
                <datalist id="supplier-nigeria-states">
                  {NIGERIA_STATES.map((stateName) => (
                    <option key={stateName} value={stateName} />
                  ))}
                </datalist>
              </div>
              <Select
                id={FIELD_DOM_IDS.country}
                label="Country"
                required={canSubmitForReview}
                value={values.country.toUpperCase()}
                onChange={(event) => updateField('country', event.target.value.toUpperCase())}
                onBlur={() => handleFieldBlur('country')}
                error={errors.country ?? null}
                disabled={!canEdit || busy}
              >
                {countryOptions.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <Input
                id={FIELD_DOM_IDS.dispatchRecipientName}
                label="Dispatch contact name"
                maxLength={MAX_RECIPIENT_NAME_LENGTH}
                placeholder={values.legalName.trim() || 'Warehouse manager or business name'}
                helper="Optional. Defaults to your legal business name."
                value={values.dispatchRecipientName ?? ''}
                onChange={(event) => updateField('dispatchRecipientName', event.target.value)}
                onBlur={() => handleFieldBlur('dispatchRecipientName')}
                error={errors.dispatchRecipientName ?? null}
                disabled={!canEdit || busy}
              />
              <Input
                id={FIELD_DOM_IDS.dispatchPhone}
                label="Dispatch phone"
                type="tel"
                inputMode="tel"
                maxLength={MAX_CONTACT_PHONE_LENGTH}
                placeholder={values.contactPhone.trim() || '08031234567'}
                helper="Optional. Defaults to your business contact phone."
                value={values.dispatchPhone ?? ''}
                onChange={(event) => updateField('dispatchPhone', event.target.value)}
                onBlur={() => handleFieldBlur('dispatchPhone')}
                error={errors.dispatchPhone ?? null}
                disabled={!canEdit || busy}
              />
            </div>
          </SectionCard>
        </div>

        {/* Sticky right column: Verification checklist + actions + read-only Business account card */}
        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-6">
          <section className="flex flex-col gap-4 rounded-ws-card border border-line bg-surface p-5 shadow-ws-card sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-ink">Verification status</h2>
                <p className="mt-1 text-[length:var(--text-ws-caption)] leading-5 text-caption">
                  {canSubmitForReview
                    ? 'Complete all four items below before submitting your profile for review.'
                    : profile.status === 'APPROVED'
                      ? 'Your supplier business is verified. Keep your contact and dispatch details up to date.'
                      : 'Review status and timestamps for your supplier verification.'}
                </p>
              </div>
            </div>

            <ul className="flex flex-col gap-2.5 border-y border-line py-3.5">
              {checklist.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-2.5 text-[length:var(--text-ws-label)] text-ink"
                >
                  <CheckDot done={item.done} />
                  <span className={item.done ? 'text-ink' : 'text-subtle'}>{item.label}</span>
                </li>
              ))}
            </ul>

            {submittedLabel || reviewedLabel ? (
              <dl className="flex flex-col gap-1.5 text-[length:var(--text-ws-caption)] text-caption">
                {submittedLabel ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt>Submitted</dt>
                    <dd className="font-medium text-ink">{submittedLabel}</dd>
                  </div>
                ) : null}
                {reviewedLabel ? (
                  <div className="flex items-center justify-between gap-2">
                    <dt>Last reviewed</dt>
                    <dd className="font-medium text-ink">{reviewedLabel}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}

            {canEdit ? (
              <div className="flex flex-col gap-2.5 pt-1">
                {canSubmitForReview ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={requestSubmitForReview}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-ws-control bg-primary px-5 text-[length:var(--text-ws-body)] font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-primary-disabled"
                  >
                    {submitMutation.isPending ? <Spinner /> : null}
                    {submitMutation.isPending ? 'Submitting…' : 'Submit for review'}
                  </button>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className={
                    canSubmitForReview
                      ? 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-ws-control border border-primary bg-surface px-5 text-[length:var(--text-ws-body)] font-semibold text-primary transition-colors hover:bg-primary-tint disabled:cursor-not-allowed disabled:opacity-50'
                      : 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-ws-control bg-primary px-5 text-[length:var(--text-ws-body)] font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-primary-disabled'
                  }
                >
                  {saveMutation.isPending ? <Spinner /> : null}
                  {saveMutation.isPending ? 'Saving…' : 'Save profile'}
                </button>

                {isDirty ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDiscardOpen(true)}
                    className="inline-flex min-h-10 w-full items-center justify-center rounded-ws-control px-4 text-[length:var(--text-ws-body)] font-medium text-subtle transition-colors hover:bg-canvas hover:text-ink disabled:opacity-50"
                  >
                    Discard changes
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* Read-only active Business account summary */}
          <section className="flex flex-col gap-3.5 rounded-ws-card border border-line bg-surface p-5 shadow-ws-card sm:p-6">
            <div>
              <h2 className="text-base font-semibold text-ink">Business account</h2>
              <p className="mt-1 text-[length:var(--text-ws-caption)] text-caption">
                Workspace membership and subscription details for this supplier business.
              </p>
            </div>
            <dl className="flex flex-col gap-2.5 border-t border-line pt-3.5 text-[length:var(--text-ws-label)]">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-subtle">Display name</dt>
                <dd className="text-right font-medium text-ink">{business.name}</dd>
              </div>
              {business.slug ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-subtle">Workspace slug</dt>
                  <dd className="text-right font-mono text-[length:var(--text-ws-caption)] text-ink">
                    {business.slug}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <dt className="text-subtle">Your role</dt>
                <dd className="text-right font-medium text-ink">
                  {businessRoleLabel(business.role)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-subtle">Plan</dt>
                <dd className="text-right font-medium text-ink">
                  {planLabel ?? 'Assigned on approval'}
                </dd>
              </div>
              {business.email ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-subtle">Business email</dt>
                  <dd className="break-all text-right font-medium text-ink">{business.email}</dd>
                </div>
              ) : null}
              {business.phone ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-subtle">Registered phone</dt>
                  <dd className="text-right font-medium text-ink">{business.phone}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </aside>
      </form>

      {/* Confirm submission modal (locks profile during review) */}
      <ConfirmDialog
        open={confirmSubmitOpen}
        title="Submit profile for review?"
        description="Once submitted, your verification details will be locked while a Sellonit administrator reviews your application."
        cancelLabel="Cancel"
        confirmLabel="Confirm & submit"
        pending={submitMutation.isPending}
        onClose={() => {
          if (!submitMutation.isPending) setConfirmSubmitOpen(false);
        }}
        onConfirm={() => void confirmSubmitForReview()}
      />

      {/* Discard unsaved edits modal */}
      <Dialog
        open={discardOpen}
        tone="warning"
        title="Discard unsaved changes?"
        description="Your unsaved edits to this supplier profile will be lost."
        onClose={() => setDiscardOpen(false)}
        actions={
          <>
            <button
              type="button"
              className={dialogSecondaryClass}
              onClick={() => {
                resetToBaseline();
                setDiscardOpen(false);
              }}
            >
              Discard
            </button>
            <button
              type="button"
              data-dialog-safe
              className={dialogPrimaryClass}
              onClick={() => setDiscardOpen(false)}
            >
              Keep editing
            </button>
          </>
        }
      />
    </div>
  );
}

export function SupplierProfilePage() {
  const { activeBusiness, can } = useBusiness();
  const businessId = activeBusiness?.id ?? null;
  const profileQuery = useSupplierProfileQuery(businessId);
  const canEditRole = can('supplier_profile:write');

  if (profileQuery.isPending || !activeBusiness) {
    return <LoadingState label="Loading supplier profile" />;
  }
  if (profileQuery.isError || !profileQuery.data) {
    return <ErrorState error={profileQuery.error} retry={() => void profileQuery.refetch()} />;
  }

  return (
    <SupplierProfileEditor
      key={`${activeBusiness.id}:${profileQuery.data.updatedAt ?? profileQuery.data.status}`}
      business={activeBusiness}
      profile={profileQuery.data}
      canEditRole={canEditRole}
      onConflictRefresh={() => profileQuery.refetch()}
    />
  );
}
