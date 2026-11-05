/**
 * Business signup through the typed OpenAPI client. The existing POST /businesses
 * drops contact values, so the additive PROPOSED /onboarding/businesses operation
 * preserves the full payload. A local draft is written only AFTER server success
 * (for setup progress), never used as proof of membership. The legacy local adapter
 * remains exported for existing tests/offline reference, but is no longer selected.
 */
import { api, newIdempotencyKey, unwrap } from '@/lib/api';
import {
  writeOnboardingBusiness,
  type OnboardingBusinessDraft,
} from '@/lib/auth/flowState';
import type { BusinessType } from '@/lib/auth/types';
import { businessTypeForRole } from '@/lib/onboarding/roleApi';
import type { AccountRole } from '@/lib/onboarding/roles';

/**
 * Single feature flag: only the Supplier track can advance past Create Business
 * today. Flip to `true` to let Retailer / Entrepreneur submit and proceed once
 * their dashboards exist. While `false`, other roles still see and validate the
 * form but get a friendly non-blocking "coming soon" message on submit.
 */
export const NON_SUPPLIER_BUSINESS_CREATION_ENABLED = false;

/** Whether a role may advance past Create Business (supplier always can). */
export function canCreateBusiness(role: AccountRole | null): boolean {
  return role === 'supplier' || NON_SUPPLIER_BUSINESS_CREATION_ENABLED;
}

export type CreateBusinessInput = {
  name: string;
  /** Normalized 11-digit local phone (e.g. 08031234567). */
  phone: string;
  /** Trimmed, lowercased email. */
  email: string;
  description: string;
  role: AccountRole;
};

export type CreatedBusiness = {
  id: string;
  name: string;
  type: BusinessType;
  slug?: string;
};

export interface BusinessApi {
  createBusiness(input: CreateBusinessInput, idempotencyKey?: string): Promise<CreatedBusiness>;
}

function toDraft(input: CreateBusinessInput): OnboardingBusinessDraft {
  return {
    name: input.name.trim(),
    phone: input.phone,
    email: input.email,
    description: input.description.trim(),
    completedAt: new Date().toISOString(),
  };
}

/**
 * Stores the business details in the shared onboarding state and resolves with
 * a locally-identified business. This is the temporary path while the backend
 * contract is incomplete.
 *
 * TODO(backend): replace with `httpBusinessApi` once POST /businesses persists
 * phone, email and description (and a supplier-profile endpoint exists).
 */
export const localBusinessApi: BusinessApi = {
  createBusiness(input) {
    const draft = writeOnboardingBusiness(toDraft(input));
    return Promise.resolve({
      id: `local-${draft.completedAt}`,
      name: draft.name,
      type: businessTypeForRole(input.role),
    });
  },
};

/** PROPOSED typed endpoint. The caller owns the preflight and cross-tab broadcast. */
export const httpBusinessApi: BusinessApi = {
  async createBusiness(input, idempotencyKey = newIdempotencyKey()) {
    const response = await unwrap(api.POST('/onboarding/businesses', {
      params: { header: { 'Idempotency-Key': idempotencyKey } },
      body: { name: input.name.trim(), phone: input.phone, email: input.email, description: input.description.trim(), accountType: input.role },
    }));
    const created = response.data;
    if (!created?.id || !created.name || !created.type) throw new Error('Business creation returned an incomplete response.');
    writeOnboardingBusiness(toDraft(input));
    return { id: created.id, name: created.name, type: created.type };
  },
};

/** API-ready default; no local business is presented as server-created. */
export const businessApi: BusinessApi = httpBusinessApi;
