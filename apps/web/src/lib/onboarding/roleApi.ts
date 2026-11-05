import { apiFetch } from '@/lib/api-client';
import { AUTH_ENDPOINTS } from '@/lib/auth/authEndpoints';
import type { AuthUser, BusinessType } from '@/lib/auth/types';
import type { AccountRole } from './roles';

/**
 * The onboarding choice is persisted on the account as `onboardingIntent`
 * (PUT /auth/business-intent). The backend enum is RETAILER | SUPPLIER.
 * Entrepreneur is an onboarding presentation choice that uses the retailer
 * business type until a separate business type exists for it.
 */
const BUSINESS_TYPE_BY_ROLE: Record<AccountRole, BusinessType> = {
  entrepreneur: 'RETAILER',
  retailer: 'RETAILER',
  supplier: 'SUPPLIER',
};

const ROLE_BY_BUSINESS_TYPE: Record<BusinessType, AccountRole> = {
  RETAILER: 'retailer',
  SUPPLIER: 'supplier',
};

/** The value sent as `businessType` to PUT /auth/business-intent. */
export function businessTypeForRole(role: AccountRole): BusinessType {
  return BUSINESS_TYPE_BY_ROLE[role];
}

/** The onboarding role for a stored `onboardingIntent`. */
export function roleForBusinessType(businessType: BusinessType): AccountRole {
  return ROLE_BY_BUSINESS_TYPE[businessType];
}

export type SavedRole = {
  /** The account as returned by the API, with `onboardingIntent` already set. */
  user: AuthUser;
  businessType: BusinessType;
};

export interface RoleApi {
  saveRole(role: AccountRole): Promise<SavedRole>;
}

/**
 * Saves the onboarding role to the authenticated user.
 *
 * PUT /api/v1/auth/business-intent `{ businessType }` → 200 `{ data: user }`.
 * Requires the session cookie (the role-selection route is behind
 * RequireAuthenticatedSession). The response already carries the updated user,
 * so the caller can refresh the in-memory session without another request.
 */
export const httpRoleApi: RoleApi = {
  async saveRole(role) {
    const businessType = businessTypeForRole(role);
    const response = await apiFetch<{ data: AuthUser }>(AUTH_ENDPOINTS.businessIntent, {
      method: 'PUT',
      body: JSON.stringify({ businessType }),
    });
    return { user: response.data, businessType };
  },
};

/** Single place to switch implementations (e.g. an offline/demo adapter). */
export const roleApi: RoleApi = httpRoleApi;
