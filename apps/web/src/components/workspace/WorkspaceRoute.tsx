'use client';
import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isEndpointNotImplemented } from '@/lib/api-client';
import { useSession } from '@/lib/auth/AuthSessionProvider';
import { redirectTarget, resolveAuthDestination } from '@/lib/auth/authDestination';
import { EMPTY_SUPPLIER_DASHBOARD } from '@/lib/dashboard/supplierDashboard';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardSessionSkeleton } from '@/components/dashboard/DashboardRoute';
import type { Feature, Permission } from '@/lib/workspace/types';
import { RequireFeature, RequirePermission } from './PermissionGuard';
import { ErrorState, LoadingState, NoAccessState, StatePanel } from './StatePanel';
import { StatusBanner } from './StatusBanner';

/** New workspace routes use capabilities, never onboarding/membership role names. */
export function WorkspaceRoute({
  children,
  admin = false,
  permission,
  feature,
}: {
  children: ReactNode;
  admin?: boolean;
  permission?: Permission;
  feature?: Feature;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const { enableWorkspaceContext } = session;
  const destination = resolveAuthDestination(session);
  const target = redirectTarget(destination, pathname);
  useEffect(() => {
    if (target) router.replace(target);
  }, [router, target]);
  useEffect(() => {
    if (!target && destination.kind === 'dashboard') enableWorkspaceContext?.();
  }, [destination.kind, enableWorkspaceContext, target]);
  if (destination.kind === 'login') return null;
  if (destination.kind !== 'dashboard' || !session.user)
    return (
      <DashboardSessionSkeleton
        displayName={session.cachedDisplayName}
        onRetry={session.status === 'error' ? () => void session.refreshSession() : undefined}
      />
    );
  const user = session.user;
  let content: ReactNode = children;
  if (permission)
    content = <RequirePermission permission={permission}>{content}</RequirePermission>;
  if (feature) content = <RequireFeature feature={feature}>{content}</RequireFeature>;
  if (session.workspaceStatus === 'idle' || session.workspaceStatus === 'loading')
    content = (
      <LoadingState label={admin ? 'Checking administrator access' : 'Loading workspace'} />
    );
  // TODO(BE-005, BE-006): surface an honest state while GET /session/context and /admin/suppliers* are not yet mounted.
  if (session.workspaceStatus === 'error') {
    content = isEndpointNotImplemented(session.workspaceError) ? (
      <StatePanel
        icon="business"
        tone="cream"
        title={
          admin ? 'Supplier review is not available yet' : 'This workspace is not available yet'
        }
        description="The backend endpoints for session capabilities and administrator supplier review are not deployed on this environment yet."
      />
    ) : (
      <ErrorState error={session.workspaceError} retry={() => void session.refreshWorkspace()} />
    );
  }
  if (admin && session.workspaceStatus === 'ready' && session.workspace?.platformRole !== 'ADMIN')
    content = (
      <NoAccessState
        title="Administrator access required"
        description="Supplier review is restricted to platform administrators."
      />
    );
  if (!admin && session.workspaceStatus === 'ready' && !session.workspace?.activeBusiness)
    content = (
      <NoAccessState
        title="No active business"
        description="Complete business signup before opening this workspace."
      />
    );
  return (
    <DashboardShell
      user={user}
      data={EMPTY_SUPPLIER_DASHBOARD}
      activePath={pathname ?? '/dashboard'}
      variant={admin ? 'admin' : 'supplier'}
      businessName={admin ? 'Sellonit platform' : session.workspace?.activeBusiness?.name}
    >
      {!admin && session.workspaceStatus === 'ready' ? (
        <StatusBanner status={session.workspace?.supplierStatus ?? null} />
      ) : null}
      {content}
    </DashboardShell>
  );
}
