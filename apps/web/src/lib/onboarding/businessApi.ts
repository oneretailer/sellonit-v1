/**
 * Business creation for the Create Business onboarding step, behind a small
 * adapter so the UI does not block on the backend.
 *
 * Backend status (source-confirmed): `POST /api/v1/businesses` IS implemented
 * (apps/api/src/modules/businesses/businesses.handlers.ts) and persists
 * `name`, `slug` and `type` — but the Prisma `Business` model has NO phone,
 * email or description columns, so those fields from `CreateBusinessRequest`
 * are silently dropped. Until the full contract is implemented we default to
 * the local adapter, which stores everything in the shared onboarding state
 * (sessionStorage, same place as the role). Flip `businessApi` to
 * `httpBusinessApi` once the backend persists the whole payload.
 */
import { apiFetch } from '@/lib/api-client';
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
  createBusiness(input: CreateBusinessInput): Promise<CreatedBusiness>;
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

/**
 * The real endpoint. Sends name/type/phone/email; `description` is not part of
 * the implemented contract yet, so it is still kept in the local draft.
 *
 * TODO(backend): include `description` once the API accepts and stores it.
 */
export const httpBusinessApi: BusinessApi = {
  async createBusiness(input) {
    const draft = writeOnboardingBusiness(toDraft(input));
    const response = await apiFetch<{ data: CreatedBusiness }>('/businesses', {
      method: 'POST',
      body: JSON.stringify({
        name: draft.name,
        type: businessTypeForRole(input.role),
        phone: draft.phone,
        email: draft.email,
      }),
    });
    return response.data;
  },
};

/** Single switch point (mirrors supplierDashboardApi / roleApi). */
export const businessApi: BusinessApi = localBusinessApi;
