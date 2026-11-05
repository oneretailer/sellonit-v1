/**
 * Business list for the header switcher.
 *
 * TODO(backend): the Products brief specifies GET /me/businesses returning
 * `{ id, name, type, role }[]`. That route is not implemented yet. The current
 * backend exposes GET /businesses (membership-scoped) with memberships included,
 * so this adapter normalizes that real response into the switcher shape. Swap
 * the path/normalizer here once /me/businesses exists.
 */
import { apiFetch } from '@/lib/api-client';

export type BusinessMembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export type SwitcherBusiness = {
  id: string;
  name: string;
  /** Raw business type from the API (RETAILER | ENTREPRENEUR | ENTERPRISE). */
  type: string;
  role: BusinessMembershipRole;
};

type ApiMembership = { userId: string; role: string };
type ApiBusiness = { id: string; name: string; type: string; memberships?: ApiMembership[] };

function normalizeRole(value: string | undefined): BusinessMembershipRole {
  if (value === 'OWNER' || value === 'ADMIN' || value === 'MEMBER') return value;
  return 'MEMBER';
}

export async function listBusinesses(userId: string | null, signal?: AbortSignal): Promise<SwitcherBusiness[]> {
  const response = await apiFetch<{ data: ApiBusiness[] }>('/businesses', { method: 'GET', signal });
  const rows = Array.isArray(response.data) ? response.data : [];
  return rows.map((business) => {
    const membership = business.memberships?.find((member) => member.userId === userId);
    return {
      id: business.id,
      name: business.name,
      type: business.type,
      role: normalizeRole(membership?.role),
    };
  });
}

/** "Supplier · Owner" style secondary line. */
export function businessTypeLabel(type: string): string {
  if (type === 'ENTERPRISE') return 'Supplier';
  if (type === 'RETAILER') return 'Retailer';
  if (type === 'ENTREPRENEUR') return 'Entrepreneur';
  return type;
}

export function businessRoleLabel(role: BusinessMembershipRole): string {
  if (role === 'OWNER') return 'Owner';
  if (role === 'ADMIN') return 'Admin';
  return 'Member';
}
