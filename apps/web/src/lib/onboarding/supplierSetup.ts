/**
 * The ONE source of truth for supplier onboarding setup.
 *
 * The dashboard progress widget, the Supplier Setup checklist and any modal all
 * derive from `SUPPLIER_SETUP_STEPS` + `computeSupplierSetupProgress`, so they
 * can never disagree. Progress is `completed steps / total steps` (6).
 *
 * "Business information" is completed by the Create Business onboarding step
 * (its draft lives in the shared onboarding state, see flowState.ts). The other
 * steps are completed inside the dashboard. Where the backend cannot yet report
 * a step's status we derive it from local state and leave a TODO.
 */
import { useMemo, useSyncExternalStore } from 'react';
import type { Route } from 'next';
import {
  parseOnboardingBusiness,
  readOnboardingBusinessRaw,
  subscribeOnboardingBusiness,
  type OnboardingBusinessDraft,
} from '@/lib/auth/flowState';

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
  // TODO(backend): there is no Website workspace section yet; the dashboard
  // catch-all renders a "coming soon" placeholder until one is built.
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

/**
 * Pure progress math. `backendCompletedStepIds` is whatever the API reports
 * (unknown ids are ignored); a completed business draft marks the first step.
 */
export function computeSupplierSetupProgress(
  backendCompletedStepIds: readonly string[],
  business: OnboardingBusinessDraft | null,
): SupplierSetupProgress {
  const known = new Set<string>(SUPPLIER_SETUP_STEP_IDS);
  const completedIds = new Set<string>(backendCompletedStepIds.filter((id) => known.has(id)));
  if (business) {
    completedIds.add('business-information');
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
 * Reactive progress for React components. Merges the backend-reported step ids
 * with the locally stored business draft (the Create Business step).
 *
 * TODO(backend): once GET supplier-dashboard returns real `setup.completedStepIds`
 * for every step, pass them in here; until then only Business information can be
 * derived locally and the rest stay incomplete.
 */
export function useSupplierSetupProgress(
  backendCompletedStepIds: readonly string[] = [],
): SupplierSetupProgress {
  const raw = useSyncExternalStore(
    subscribeOnboardingBusiness,
    readOnboardingBusinessRaw,
    () => null,
  );
  const business = useMemo(() => parseOnboardingBusiness(raw), [raw]);
  // The ids array identity can change each render; join to a stable key.
  const idsKey = backendCompletedStepIds.join('|');
  return useMemo(
    () => computeSupplierSetupProgress(idsKey.length ? idsKey.split('|') : [], business),
    [idsKey, business],
  );
}
