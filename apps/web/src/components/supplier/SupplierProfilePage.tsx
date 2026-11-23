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
  type SupplierOriginAddress,
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

const FIELD_LABELS: Record<SupplierProfileFieldKey, string> = {
  legalName: 'Legal business name',
  contactPhone: 'Contact phone',
  description: 'Business description',
  retailerAccess: 'Retailer access',
  addressLine1: 'Street address',
  addressLine2: 'Suite, building, or landmark',
  area: 'Area / LGA',
  city: 'City',
  state: 'State',
  country: 'Country',
  dispatchRecipientName: 'Dispatch contact name',
  dispatchPhone: 'Dispatch phone',
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
    // Unsaved drafts initialize to `'OPEN'` to match Prisma `@default(OPEN)` (`schema.prisma:163`).
    description: profile.description ?? '',
    retailerAccess: profile.retailerAccess ?? 'OPEN',
    addressLine1: typeof origin.addressLine1 === 'string' ? origin.addressLine1 : '',
    addressLine2: typeof origin.addressLine2 === 'string' ? origin.addressLine2 : '',
    area: typeof origin.area === 'string' ? origin.area : '',
    city: typeof origin.city === 'string' ? origin.city : '',
    state: typeof origin.state === 'string' ? origin.state : '',
    country:
      typeof origin.country === 'string' && origin.country ? origin.country.toUpperCase() : 'NG',
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

  const [savedOrigin, setSavedOrigin] = useState<SupplierOriginAddress | null | undefined>(
    () => profile.originLocation,
  );
  const [savedBaseline, setSavedBaseline] = useState<SupplierProfileFormValues>(() =>
    initialValues(profile, business.name),
  );
  const [values, setValues] = useState<SupplierProfileFormValues>(savedBaseline);
  const [errors, setErrors] = useState<SupplierProfileErrors>({});
  const [erroredFields, setErroredFields] = useState<
    Partial<Record<SupplierProfileFieldKey, boolean>>
  >({});
  const [attemptedMode, setAttemptedMode] = useState<SupplierProfileValidationMode | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);

  const saveMutation = useSaveSupplierProfileMutation(business.id);
  const submitMutation = useSubmitSupplierProfileMutation(business.id);
  const busy = saveMutation.isPending || submitMutation.isPending;

  const statusEditable = canEditSupplierProfileStatus(profile.status);
  const canEdit = canEditRole && statusEditable;
  const canSubmitForReview = canEditRole && canSubmitSupplierProfileStatus(profile.status);
  const lockNotice = statusLockMessage(profile.status);

  // TODO(BE-004 / BE-006): once `GET /api/v1/supplier/:businessId/profile` includes
  // `rejectionReason` / `latestReviewReason` from `SupplierReviewEvent`, it renders
  // automatically below for REJECTED and SUSPENDED accounts.
  const reviewReason = profile.rejectionReason ?? profile.latestReviewReason ?? null;

  const isDirty = useMemo(
    () =>
      SUPPLIER_PROFILE_FIELD_ORDER.some(
        (key) => (values[key] ?? '') !== (savedBaseline[key] ?? ''),
      ),
    [savedBaseline, values],
  );

  const resetToBaseline = useCallback(() => {
    setValues(savedBaseline);
    setErrors({});
    setErroredFields({});
    setAttemptedMode(null);
    setFormError(null);
    setAlertDismissed(false);
  }, [savedBaseline]);

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

  function validationModeForBlur(): SupplierProfileValidationMode {
    return attemptedMode ?? (canSubmitForReview ? 'submit' : 'save');
  }

  function updateField<K extends SupplierProfileFieldKey>(
    key: K,
    value: SupplierProfileFormValues[K],
  ) {
    const nextValues = { ...values, [key]: value };
    setValues(nextValues);
    if (attemptedMode) {
      setErrors(validateSupplierProfile(nextValues, attemptedMode));
    } else if (erroredFields[key]) {
      const next = validateSupplierProfile(nextValues, validationModeForBlur());
      setErrors((current) => {
        if (next[key]) return { ...current, [key]: next[key] };
        const copy = { ...current };
        delete copy[key];
        return copy;
      });
    }
    setFormError(null);
  }

  function handleFieldBlur(key: SupplierProfileFieldKey) {
    if (!canEdit) return;
    const next = validateSupplierProfile(values, validationModeForBlur());
    if (next[key]) {
      setErroredFields((current) => ({ ...current, [key]: true }));
      setErrors((current) => ({ ...current, [key]: next[key] }));
    } else if (errors[key]) {
      setErrors((current) => {
        const copy = { ...current };
        delete copy[key];
        return copy;
      });
    }
  }

  function focusField(key: SupplierProfileFieldKey) {
    document.getElementById(FIELD_DOM_IDS[key])?.focus();
  }

  function focusFirstInvalid(nextErrors: SupplierProfileErrors) {
    const first = SUPPLIER_PROFILE_FIELD_ORDER.find((key) => Boolean(nextErrors[key]));
    if (first) focusField(first);
  }

  function runValidation(mode: SupplierProfileValidationMode): boolean {
    setAttemptedMode(mode);
    setAlertDismissed(false);
    const nextErrors = validateSupplierProfile(values, mode);
    setErrors(nextErrors);
    const flagged: Partial<Record<SupplierProfileFieldKey, boolean>> = {};
    for (const key of SUPPLIER_PROFILE_FIELD_ORDER) {
      if (nextErrors[key]) flagged[key] = true;
    }
    setErroredFields(flagged);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(nextErrors);
      return false;
    }
    return true;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !isDirty || busy) return;
    setFormError(null);
    if (!runValidation('save')) return;
    try {
      const saved = await saveMutation.mutateAsync(toSupplierProfilePayload(values, savedOrigin));
      const nextBaseline = initialValues(saved, business.name);
      setSavedOrigin(saved.originLocation);
      setSavedBaseline(nextBaseline);
      setValues(nextBaseline);
      setErrors({});
      setErroredFields({});
      setAttemptedMode(null);
      notify({
        title: 'Profile saved',
        message: 'Your supplier profile changes have been saved.',
        tone: 'success',
      });
    } catch (caught) {
      const presented = presentError(caught);
      if (presented.kind === 'conflict') {
        await onConflictRefresh();
      }
      setFormError(presented.message);
      notify({
        title: 'Could not save profile',
        message: presented.message,
        tone: 'error',
      });
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
      const submitted = await submitMutation.mutateAsync(
        toSupplierProfilePayload(values, savedOrigin),
      );
      const nextBaseline = initialValues(submitted, business.name);
      setSavedOrigin(submitted.originLocation);
      setSavedBaseline(nextBaseline);
      setValues(nextBaseline);
      setErrors({});
      setErroredFields({});
      setConfirmSubmitOpen(false);
      setAttemptedMode(null);
      notify({
        title: 'Submitted for review',
        message: 'Your supplier profile is now awaiting administrator verification.',
        tone: 'success',
      });
    } catch (caught) {
      setConfirmSubmitOpen(false);
      const presented = presentError(caught);
      if (presented.kind === 'conflict') {
        await onConflictRefresh();
      }
      setFormError(presented.message);
      notify({
        title: 'Could not submit profile',
        message: presented.message,
        tone: 'error',
      });
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

  const orderedErrors = useMemo(
    () =>
      SUPPLIER_PROFILE_FIELD_ORDER.filter((key) => Boolean(errors[key])).map((key) => ({
        key,
        label: FIELD_LABELS[key],
        message: errors[key]!,
      })),
    [errors],
  );
  const errorCount = orderedErrors.length;
  const submittedLabel = formatProfileTimestamp(profile.submittedAt);
  const reviewedLabel = formatProfileTimestamp(profile.reviewedAt);
  const planLabel = businessPlanLabel(business.plan);
  const isNigeria = values.country.trim().toUpperCase() === 'NG';

  const countryOptions = useMemo(() => {
    const code = values.country.trim().toUpperCase();
    if (!code || SUPPORTED_COUNTRIES.some((item) => item.code === code)) {
      return SUPPORTED_COUNTRIES;
    }
    return [...SUPPORTED_COUNTRIES, { code, name: code }];
  }, [values.country]);

  const nigeriaStateOptions = useMemo(() => {
    const current = values.state.trim();
    if (!current || NIGERIA_STATES.includes(current)) {
      return NIGERIA_STATES;
    }
    return [current, ...NIGERIA_STATES];
  }, [values.state]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Page header */}
      <div>
        <h1 className="font-heading text-[length:var(--text-ws-page-title)] font-semibold text-ink">
          Business profile
        </h1>
        <p className="mt-1 text-[length:var(--text-ws-body)] text-subtle">
          Manage your supplier verification details, catalogue access, and dispatch origin.
        </p>
      </div>

      <StatusBanner status={profile.status} reason={reviewReason} />

      {/* Top validation summary with clickable field-focus links */}
      {attemptedMode && errorCount > 0 && !alertDismissed ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-ws-card border border-danger/30 bg-danger-tint px-4 py-3.5 text-[length:var(--text-ws-body)] text-danger"
        >
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <DashboardIcon name="alert" className="mt-0.5 size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {attemptedMode === 'submit' ? 'Profile not submitted' : 'Profile not saved'} — fix{' '}
                {errorCount === 1 ? '1 field' : `${errorCount} fields`}
              </p>
              <ul className="mt-1.5 flex flex-col gap-1 text-[length:var(--text-ws-label)]">
                {orderedErrors.map((entry) => (
                  <li key={entry.key}>
                    <button
                      type="button"
                      onClick={() => focusField(entry.key)}
                      className="text-left underline underline-offset-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"
                    >
                      {`${entry.label}: ${entry.message}`}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss alert"
            onClick={() => setAlertDismissed(true)}
            className="-m-1 flex size-8 shrink-0 items-center justify-center rounded-ws-control text-danger hover:bg-danger/10"
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

      {/* Two-column Supplier Workspace layout matching Add Product */}
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

          {/* Card 3 — Origin / dispatch address */}
          <SectionCard
            title="Origin / dispatch address"
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
              <Select
                id={FIELD_DOM_IDS.country}
                label="Country"
                required={canSubmitForReview}
                value={values.country.toUpperCase()}
                onChange={(event) => {
                  const nextCountry = event.target.value.toUpperCase();
                  const nextValues = {
                    ...values,
                    country: nextCountry,
                    // Reset state if switching between Nigeria's state list and another country.
                    state: nextCountry === values.country.toUpperCase() ? values.state : '',
                  };
                  setValues(nextValues);
                  if (attemptedMode) {
                    setErrors(validateSupplierProfile(nextValues, attemptedMode));
                  }
                  setFormError(null);
                }}
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
              {isNigeria ? (
                <Select
                  id={FIELD_DOM_IDS.state}
                  label="State"
                  required={canSubmitForReview}
                  value={values.state}
                  onChange={(event) => updateField('state', event.target.value)}
                  onBlur={() => handleFieldBlur('state')}
                  error={errors.state ?? null}
                  disabled={!canEdit || busy}
                >
                  <option value="">Select a state</option>
                  {nigeriaStateOptions.map((stateName) => (
                    <option key={stateName} value={stateName}>
                      {stateName}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={FIELD_DOM_IDS.state}
                  label="State / region"
                  required={canSubmitForReview}
                  maxLength={MAX_STATE_LENGTH}
                  placeholder="State, province, or region"
                  value={values.state}
                  onChange={(event) => updateField('state', event.target.value)}
                  onBlur={() => handleFieldBlur('state')}
                  error={errors.state ?? null}
                  disabled={!canEdit || busy}
                />
              )}
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

        {/* Sticky right column: Verification status / summary card + read-only Business account card */}
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
              <StatusChip status={profile.status} />
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

            {(profile.status === 'REJECTED' || profile.status === 'SUSPENDED') &&
            reviewReason?.trim() ? (
              <div className="rounded-ws-control border border-danger/30 bg-danger-tint px-3.5 py-2.5 text-[length:var(--text-ws-caption)] leading-5 text-ink">
                <span className="font-semibold text-danger">Review reason: </span>
                <span>{reviewReason.trim()}</span>
              </div>
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
                  disabled={!isDirty || busy}
                  className={
                    canSubmitForReview
                      ? 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-ws-control border border-primary bg-surface px-5 text-[length:var(--text-ws-body)] font-semibold text-primary transition-colors hover:bg-primary-tint disabled:cursor-not-allowed disabled:opacity-40'
                      : 'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-ws-control bg-primary px-5 text-[length:var(--text-ws-body)] font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-primary-disabled'
                  }
                >
                  {saveMutation.isPending ? <Spinner /> : null}
                  {saveMutation.isPending ? 'Saving…' : 'Save profile'}
                </button>

                <button
                  type="button"
                  disabled={!isDirty || busy}
                  onClick={resetToBaseline}
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-ws-control px-4 text-[length:var(--text-ws-body)] font-medium text-subtle transition-colors hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Discard changes
                </button>
              </div>
            ) : null}
          </section>

          {/* Read-only active Business account summary (TODO(BE-004): PATCH /api/v1/businesses/:businessId is not live yet; do not attempt a PATCH call) */}
          <section className="flex flex-col gap-3.5 rounded-ws-card border border-line bg-surface p-5 shadow-ws-card sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-ink">Business account</h2>
                <p className="mt-1 text-[length:var(--text-ws-caption)] leading-5 text-caption">
                  These account details are read-only and can be edited once business updates are
                  available.
                </p>
              </div>
              <span className="shrink-0 rounded-ws-pill bg-status-draft-bg px-2.5 py-0.5 text-[length:var(--text-ws-caption)] font-medium text-status-draft-fg">
                Read-only
              </span>
            </div>
            <dl className="flex flex-col gap-2.5 border-t border-line pt-3.5 text-[length:var(--text-ws-label)]">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-subtle">Trading / display name</dt>
                <dd className="text-right font-medium text-ink">{business.name}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-subtle">Workspace slug</dt>
                <dd className="text-right font-mono text-[length:var(--text-ws-caption)] text-ink">
                  {business.slug || 'Not set'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-subtle">Business email</dt>
                <dd className="break-all text-right font-medium text-ink">
                  {business.email || 'Not provided'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-subtle">Business phone</dt>
                <dd className="text-right font-medium text-ink">
                  {business.phone || 'Not provided'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-subtle">Subscription plan</dt>
                <dd className="text-right font-medium text-ink">
                  {planLabel ?? 'Assigned on approval'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-subtle">Your role</dt>
                <dd className="text-right font-medium text-ink">
                  {businessRoleLabel(business.role)}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </form>

      {/* Confirm submission modal (locks profile during review) */}
      <ConfirmDialog
        open={confirmSubmitOpen}
        title="Submit profile for review?"
        description="Once submitted, your supplier profile will be locked until a Sellonit administrator reviews your application."
        cancelLabel="Cancel"
        confirmLabel="Submit for review"
        pending={submitMutation.isPending}
        onClose={() => {
          if (!submitMutation.isPending) setConfirmSubmitOpen(false);
        }}
        onConfirm={() => void confirmSubmitForReview()}
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
