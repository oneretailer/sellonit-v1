/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { WorkspaceRoute } from './WorkspaceRoute';
import type { SessionContext } from '@/lib/workspace/types';

const mocks = vi.hoisted((): {
  router: { replace: ReturnType<typeof vi.fn>; push: ReturnType<typeof vi.fn>; back: ReturnType<typeof vi.fn> };
  pathname: string;
  enableWorkspaceContext: ReturnType<typeof vi.fn>;
  refreshWorkspace: ReturnType<typeof vi.fn>;
  refreshSession: ReturnType<typeof vi.fn>;
  workspaceStatus: 'idle' | 'loading' | 'ready' | 'error';
  workspace: SessionContext | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: null;
    status: 'ACTIVE';
    onboardingIntent: 'SUPPLIER' | 'RETAILER' | null;
    emailVerifiedAt: string;
    phoneVerifiedAt: null;
    createdAt: string;
    updatedAt: string;
  };
} => ({
  router: { replace: vi.fn(), push: vi.fn(), back: vi.fn() },
  pathname: '/admin/suppliers',
  enableWorkspaceContext: vi.fn(),
  refreshWorkspace: vi.fn(),
  refreshSession: vi.fn(),
  workspaceStatus: 'ready',
  workspace: {
    platformRole: 'ADMIN',
    permissions: ['supplier:review'],
    features: [],
    businesses: [],
    activeBusiness: null,
    supplierStatus: null,
  },
  user: {
    id: 'admin-1',
    email: 'admin@sellonit.local',
    firstName: 'Sellonit',
    lastName: 'Admin',
    phone: null,
    status: 'ACTIVE',
    onboardingIntent: null,
    emailVerifiedAt: '2026-11-05T00:00:00.000Z',
    phoneVerifiedAt: null,
    createdAt: '2026-11-05T00:00:00.000Z',
    updatedAt: '2026-11-05T00:00:00.000Z',
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => mocks.router,
  usePathname: () => mocks.pathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/dashboard/DashboardShell', () => ({
  DashboardShell: ({ children, variant }: { children: ReactNode; variant?: string }) => (
    <div data-testid={`shell-${variant ?? 'supplier'}`}>{children}</div>
  ),
}));

vi.mock('@/lib/auth/AuthSessionProvider', () => ({
  useSession: () => ({
    status: 'authenticated',
    user: mocks.user,
    cachedDisplayName: 'Sellonit Admin',
    workspace: mocks.workspace,
    workspaceStatus: mocks.workspaceStatus,
    workspaceError: null,
    can: (perm: string) => Boolean(mocks.workspace?.permissions.includes(perm as never)),
    hasFeature: () => false,
    enableWorkspaceContext: mocks.enableWorkspaceContext,
    refreshWorkspace: mocks.refreshWorkspace,
    refreshSession: mocks.refreshSession,
    acceptAuthenticatedUser: vi.fn(),
    signOut: vi.fn(),
  }),
}));

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = '/admin/suppliers';
  mocks.workspaceStatus = 'ready';
  mocks.user.onboardingIntent = null;
  mocks.workspace = {
    platformRole: 'ADMIN',
    permissions: ['supplier:review'],
    features: [],
    businesses: [],
    activeBusiness: null,
    supplierStatus: null,
  };
});

describe('WorkspaceRoute admin access', () => {
  it('allows a platform ADMIN with onboardingIntent=null to view /admin/suppliers without bouncing to role selection', async () => {
    render(
      <WorkspaceRoute admin>
        <p>Supplier review queue</p>
      </WorkspaceRoute>,
    );

    expect(await screen.findByText('Supplier review queue')).toBeTruthy();
    expect(screen.getByTestId('shell-admin')).toBeTruthy();
    expect(mocks.enableWorkspaceContext).toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it('blocks non-admin users on /admin/suppliers with Administrator access required', async () => {
    mocks.workspace = {
      platformRole: 'USER',
      permissions: [],
      features: [],
      businesses: [],
      activeBusiness: null,
      supplierStatus: null,
    };

    render(
      <WorkspaceRoute admin>
        <p>Supplier review queue</p>
      </WorkspaceRoute>,
    );

    await waitFor(() =>
      expect(screen.getByText('Administrator access required')).toBeTruthy(),
    );
    expect(screen.queryByText('Supplier review queue')).toBeNull();
    expect(mocks.router.replace).not.toHaveBeenCalledWith('/auth/role-selection');
  });
});
