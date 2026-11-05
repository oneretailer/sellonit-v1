/**
 * Business creation through the live `/api/v1/businesses` and
 * `/api/v1/supplier/:businessId/profile` endpoints.
 *
 * - `POST /businesses` persists `{ name, type, phone, email }`, `Membership(OWNER)`,
 *   and `BusinessSubscription(ENTERPRISE)`.
 * - `PUT /supplier/:businessId/profile` persists the supplier's `legalName`,
 *   `contactPhone`, and `description` (`Business` itself has no `description`
 *   column on the backend).
 * - A local draft is written only AFTER server success for immediate setup
 *   progress hydration, never used as proof of membership.
 */
import type { components } from '@sellonit/shared';
import { api, newIdempotencyKey, unwrap } from '@/lib/api';
import { apiFetch } from '@/lib/api-client';
import {
  writeOnboardingBusiness,
  type OnboardingBusinessDraft,
} from '@/lib/auth/flowState';
import { setActiveBusinessId } from '@/lib/business/activeBusiness';
import { businessTypeForRole } from '@/lib/onboarding/roleApi';
import type { AccountRole } from '@/lib/onboarding/roles';

type Schemas = components['schemas'];
export type BusinessType = Schemas['BusinessType'];

/**
 * Single feature flag: only the Supplier track can advance past Create Business
 * today. TODO(BE-012): flip to `true` once Retailer / Storefront endpoints and
 * dashboards are implemented on the backend.
 */
export const NON_SUPPLIER_BUSINESS_CREATION_ENABLED = false;

/** Whether a role may advance past Create Business (supplier always can). */
export function canCreateBusiness(role: AccountRole | null): boolean {
  return role === 'supplier' || NON_SUPPLIER_BUSINESS_CREATION_ENABLED;
}

export type CreateBusinessInput = {
  name: Schemas['CreateBusinessRequest']['name'];
  /** Normalized 11-digit local phone (e.g. 08031234567). */
  phone: NonNullable<Schemas['CreateBusinessRequest']['phone']>;
  /** Trimmed, lowercased email. */
  email: NonNullable<Schemas['CreateBusinessRequest']['email']>;
  description: NonNullable<Schemas['UpsertSupplierProfileRequest']['description']>;
  role: AccountRole;
};

export type CreatedBusiness = Pick<Schemas['Business'], 'id' | 'name' | 'type'> & {
  slug?: Schemas['Business']['slug'];
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

/** Live backend adapter (`POST /businesses` + `PUT /supplier/:businessId/profile`). */
export const httpBusinessApi: BusinessApi = {
  async createBusiness(input, idempotencyKey = newIdempotencyKey()) {
    const trimmedName = input.name.trim();
    const trimmedDescription = input.description.trim();
    const businessType = businessTypeForRole(input.role);
    // TODO(BE-004): backend POST /businesses does not yet deduplicate Idempotency-Key;
    // keep sending the header so deduplication activates once BE-004 lands.
    const response = await unwrap(
      api.POST('/businesses', {
        headers: { 'Idempotency-Key': idempotencyKey },
        body: {
          name: trimmedName,
          type: businessType,
          phone: input.phone,
          email: input.email,
        },
      }),
    );
    const created = response.data;
    if (!created?.id || !created.name || !created.type) {
      throw new Error('Business creation returned an incomplete response.');
    }

    if (businessType === 'SUPPLIER') {
      const profilePayload: Schemas['UpsertSupplierProfileRequest'] & { businessId: string } = {
        businessId: created.id,
        legalName: trimmedName,
        contactPhone: input.phone,
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
      };
      // Persist supplier profile draft (notably `description`, which lives on SupplierProfile).
      await apiFetch<{ data: Schemas['SupplierProfile'] }>(
        `/supplier/${encodeURIComponent(created.id)}/profile`,
        {
          method: 'PUT',
          body: JSON.stringify(profilePayload),
        },
      );
    }

    setActiveBusinessId(created.id);
    writeOnboardingBusiness(toDraft(input));
    return {
      id: created.id,
      name: created.name,
      type: created.type,
      ...(created.slug ? { slug: created.slug } : {}),
    };
  },
};

/** API-ready default; no local business is presented as server-created. */
export const businessApi: BusinessApi = httpBusinessApi;
