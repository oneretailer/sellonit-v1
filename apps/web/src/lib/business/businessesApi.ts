/**
 * Business list adapter for the header switcher and active-business context.
 *
 * Uses `GET /api/v1/businesses` (`apps/api/src/modules/businesses/businesses.handlers.ts`),
 * which returns membership-scoped businesses with `memberships[]` included.
 * Types derive from `@sellonit/shared` (`BusinessType`, `UserRole`, `PlanKey`).
 *
 * TODO(BE-004): once `GET /businesses` includes `activeSubscription.plan`, the
 * `plan` field below populates automatically without client changes.
 */
import type { components } from '@sellonit/shared';
import { apiFetch } from '@/lib/api-client';

type Schemas = components['schemas'];

export type BusinessMembershipRole = Schemas['UserRole'];
export type BusinessType = Schemas['BusinessType'];
export type BusinessPlanKey = Schemas['PlanKey'];
export type BusinessStatus = 'ACTIVE' | 'SUSPENDED';

export type SwitcherBusiness = {
  id: string;
  name: string;
  slug?: string;
  type: BusinessType;
  status: BusinessStatus;
  role: BusinessMembershipRole;
  plan: BusinessPlanKey | null;
};

type ApiMembership = { userId: string; role: string };
type ApiActiveSubscription = {
  status?: string;
  plan?: { key?: string; name?: string } | null;
} | null;
type ApiBusiness = {
  id: string;
  name: string;
  slug?: string;
  type: string;
  status?: string;
  role?: string;
  plan?: string | { key?: string } | null;
  activeSubscription?: ApiActiveSubscription;
  memberships?: ApiMembership[];
};

function normalizeType(value: string | undefined): BusinessType {
  if (value === 'SUPPLIER' || value === 'ENTERPRISE') return 'SUPPLIER';
  return 'RETAILER';
}

function normalizeStatus(value: string | undefined): BusinessStatus {
  return value === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
}

function normalizeRole(value: string | undefined): BusinessMembershipRole {
  if (value === 'OWNER' || value === 'MANAGER' || value === 'STAFF') return value;
  if (value === 'ADMIN') return 'MANAGER';
  return 'STAFF';
}

function normalizePlan(business: ApiBusiness): BusinessPlanKey | null {
  const candidate =
    business.activeSubscription?.plan?.key ??
    (typeof business.plan === 'string' ? business.plan : business.plan?.key);
  if (candidate === 'ENTERPRISE' || candidate === 'ENTERPRISE_PLUS') return candidate;
  return null;
}

export async function listBusinesses(
  userId: string | null,
  signal?: AbortSignal,
): Promise<SwitcherBusiness[]> {
  const response = await apiFetch<{ data: ApiBusiness[] }>('/businesses', {
    method: 'GET',
    signal,
  });
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((business) => {
    const membership = userId
      ? business.memberships?.find((member) => member.userId === userId)
      : business.memberships?.[0];
    return {
      id: business.id,
      name: business.name,
      ...(business.slug ? { slug: business.slug } : {}),
      type: normalizeType(business.type),
      status: normalizeStatus(business.status),
      role: normalizeRole(membership?.role ?? business.role),
      plan: normalizePlan(business),
    };
  });
}

/** "Supplier · Owner" style secondary line. */
export function businessTypeLabel(type: string): string {
  if (type === 'SUPPLIER' || type === 'ENTERPRISE') return 'Supplier';
  if (type === 'RETAILER') return 'Retailer';
  if (type === 'ENTREPRENEUR') return 'Entrepreneur';
  return type;
}

export function businessRoleLabel(role: string): string {
  if (role === 'OWNER') return 'Owner';
  if (role === 'MANAGER' || role === 'ADMIN') return 'Manager';
  if (role === 'STAFF' || role === 'MEMBER') return 'Staff';
  return role;
}

export function businessPlanLabel(plan: BusinessPlanKey | null | undefined): string | null {
  if (plan === 'ENTERPRISE') return 'Enterprise';
  if (plan === 'ENTERPRISE_PLUS') return 'Enterprise Plus';
  return null;
}
