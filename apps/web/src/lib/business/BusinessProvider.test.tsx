/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { BusinessProvider, useBusiness } from './BusinessProvider';
import { QueryProvider } from '@/lib/providers/QueryProvider';

const mocks = vi.hoisted(() => ({
  role: 'OWNER',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard/business-profile',
}));

vi.mock('@/lib/auth/AuthSessionProvider', () => ({
  useAuthSession: () => ({
    user: { id: 'user-1', email: 'owner@sellonit.ng' },
    status: 'authenticated',
  }),
}));

vi.mock('./businessesApi', () => ({
  listBusinesses: () =>
    Promise.resolve([
      {
        id: 'biz-1',
        name: 'Okechukwu Fashion',
        slug: 'okechukwu-fashion',
        email: 'hello@okechukwu.ng',
        phone: '+2348031234567',
        type: 'SUPPLIER' as const,
        status: 'ACTIVE' as const,
        role: mocks.role,
        plan: 'FREE' as const,
      },
    ]),
}));

function PermissionProbe() {
  const { activeBusiness, can } = useBusiness();
  if (!activeBusiness) return <p>Loading</p>;
  return (
    <p>
      {activeBusiness.role}:{String(can('supplier_profile:write'))}
    </p>
  );
}

beforeEach(() => {
  localStorage.clear();
  mocks.role = 'OWNER';
});

afterEach(() => {
  cleanup();
});

describe('BusinessProvider supplier_profile:write permission', () => {
  it('grants supplier_profile:write to OWNER and MANAGER, and denies STAFF', async () => {
    mocks.role = 'OWNER';
    const ownerView = render(
      <QueryProvider>
        <BusinessProvider>
          <PermissionProbe />
        </BusinessProvider>
      </QueryProvider>,
    );
    await waitFor(() => expect(screen.getByText('OWNER:true')).toBeTruthy());
    ownerView.unmount();

    mocks.role = 'MANAGER';
    const managerView = render(
      <QueryProvider>
        <BusinessProvider>
          <PermissionProbe />
        </BusinessProvider>
      </QueryProvider>,
    );
    await waitFor(() => expect(screen.getByText('MANAGER:true')).toBeTruthy());
    managerView.unmount();

    mocks.role = 'STAFF';
    render(
      <QueryProvider>
        <BusinessProvider>
          <PermissionProbe />
        </BusinessProvider>
      </QueryProvider>,
    );
    await waitFor(() => expect(screen.getByText('STAFF:false')).toBeTruthy());
  });
});
