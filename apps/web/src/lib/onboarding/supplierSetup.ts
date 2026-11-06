/**
 * The ONE source of truth for supplier onboarding setup.
 *
 * The dashboard progress widget, the Supplier Setup checklist and any modal all
 * derive from `SUPPLIER_SETUP_STEPS` + `computeSupplierSetupProgress`, so they
 * can never disagree. Progress is `completed steps / total steps` (6).
 *
 * Server-backed steps:
 * - Step 1 (`business-information`): complete when an active `SUPPLIER` business
 *   exists on `GET /businesses` (with local Create Business draft fallback).
 * - Step 2 (`supplier-profile`): complete when `GET /supplier/:businessId/profile`
 *   reports `PENDING_REVIEW` or `APPROVED`.
 * - Steps 3–6 (`product-catalogue`, `inventory`, `pricing`, `website`):
 *   TODO(BE-002, BE-003, BE-012) — merged from `backendCompletedStepIds` once
 *   the supplier dashboard / products / inventory / pricing endpoints exist.
 */
import { useContext, useMemo, useSyncExternalStore } from 'react';
import type { Route } from 'next';
import {
  parseOnboardingBusiness,
  readOnboardingBusinessRaw,
  subscribeOnboardingBusiness,
  type OnboardingBusinessDraft,
} from '@/lib/auth/flowState';
import { BusinessContext } from '@/lib/business/BusinessContext';
import {
  isSupplierProfileStepComplete,
  useOptionalSupplierProfile,
  type SupplierProfileRecord,
} from '@/lib/supplier/supplierProfileApi';

export type SupplierSetupStepId =
  | 'business-information'
  | 'supplier-profile'
  | 'product-catalogue'
  | 'inventory'
  | 'pricing'
  | 'website';

export type SupplierSetupStep = {
  id: SupplierSetupStepId;
  label: string;
  /** Where "Complete setup" sends the user to finish this step. */
  href: Route;
};

/** Ordered checklist. Business information is first; it is done by Create Business. */
export const SUPPLIER_SETUP_STEPS = [
  { id: 'business-information', label: 'Business information', href: '/auth/create-business' },
  { id: 'supplier-profile', label: 'Supplier profile', href: '/dashboard/business-profile' },
  { id: 'product-catalogue', label: 'Product catalogue', href: '/dashboard/products' },
  { id: 'inventory', label: 'Inventory', href: '/dashboard/inventory' },
  { id: 'pricing', label: 'Pricing', href: '/dashboard/pricing' },
  // TODO(BE-012): Website / B2C storefront section is not yet implemented on the backend.
  { id: 'website', label: 'Website', href: '/dashboard/website' },
] as const satisfies readonly SupplierSetupStep[];

export const SUPPLIER_SETUP_STEP_IDS: readonly SupplierSetupStepId[] = SUPPLIER_SETUP_STEPS.map(
  (step) => step.id,
);

export type SupplierSetupStepStatus = SupplierSetupStep & { complete: boolean };

export type SupplierSetupProgress = {
  steps: SupplierSetupStepStatus[];
  completed: number;
  total: number;
  percent: number;
  /** The first incomplete step, or null when everything is done. */
  nextStep: SupplierSetupStepStatus | null;
};

export type SupplierSetupSources = {
  hasServerSupplierBusiness?: boolean;
  supplierProfile?: SupplierProfileRecord | null;
};

/**
 * Pure progress math. Merges `backendCompletedStepIds` with server-confirmed
 * business + supplier-profile state (and the Create Business draft fallback).
 */
export function computeSupplierSetupProgress(
  backendCompletedStepIds: readonly string[],
  business: OnboardingBusinessDraft | null,
  sources: SupplierSetupSources = {},
): SupplierSetupProgress {
  const known = new Set<string>(SUPPLIER_SETUP_STEP_IDS);
  const completedIds = new Set<string>(backendCompletedStepIds.filter((id) => known.has(id)));
  if (business || sources.hasServerSupplierBusiness) {
    completedIds.add('business-information');
  }
  if (isSupplierProfileStepComplete(sources.supplierProfile)) {
    completedIds.add('supplier-profile');
  }
  const steps: SupplierSetupStepStatus[] = SUPPLIER_SETUP_STEPS.map((step) => ({
    ...step,
    complete: completedIds.has(step.id),
  }));
  const completed = steps.filter((step) => step.complete).length;
  const total = steps.length;
  const nextStep = steps.find((step) => !step.complete) ?? null;
  return {
    steps,
    completed,
    total,
    percent: Math.round((completed / total) * 100),
    nextStep,
  };
}

/**
 * Reactive progress for React components. Reads the active business from
 * `BusinessProvider` (`GET /businesses`), the business's `SupplierProfile`
 * (`GET /supplier/:businessId/profile`), and any backend-reported step IDs.
 *
 * TODO(BE-003): once `GET /supplier/dashboard` returns `setup.completedStepIds`
 * for Steps 3–6, they merge automatically through `backendCompletedStepIds`.
 */
export function useSupplierSetupProgress(
  backendCompletedStepIds: readonly string[] = [],
): SupplierSetupProgress {
  const businessContext = useContext(BusinessContext);
  const activeBusiness = businessContext?.activeBusiness ?? null;
  const supplierBusinessId = activeBusiness?.type === 'SUPPLIER' ? activeBusiness.id : null;
  const supplierProfile = useOptionalSupplierProfile(supplierBusinessId);

  const raw = useSyncExternalStore(
    subscribeOnboardingBusiness,
    readOnboardingBusinessRaw,
    () => null,
  );
  const draft = useMemo(() => parseOnboardingBusiness(raw), [raw]);
  // If BusinessProvider is mounted and has finished loading, trust the active
  // server business rather than a stale sessionStorage draft from another business.
  const effectiveDraft = businessContext && !businessContext.isLoading ? null : draft;
  const hasServerSupplierBusiness = Boolean(supplierBusinessId);

  const idsKey = backendCompletedStepIds.join('|');
  return useMemo(
    () =>
      computeSupplierSetupProgress(idsKey.length ? idsKey.split('|') : [], effectiveDraft, {
        hasServerSupplierBusiness,
        supplierProfile,
      }),
    [effectiveDraft, hasServerSupplierBusiness, idsKey, supplierProfile],
  );
}
