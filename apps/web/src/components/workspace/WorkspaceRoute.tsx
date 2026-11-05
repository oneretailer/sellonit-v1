'use client';
import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/lib/auth/AuthSessionProvider';
import { redirectTarget, resolveAuthDestination } from '@/lib/auth/authDestination';
import { EMPTY_SUPPLIER_DASHBOARD } from '@/lib/dashboard/supplierDashboard';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { DashboardSessionSkeleton } from '@/components/dashboard/DashboardRoute';
import type { Feature, Permission } from '@/lib/workspace/types';
import { RequireFeature, RequirePermission } from './PermissionGuard';
import { ErrorState, LoadingState, NoAccessState } from './StatePanel';
import { StatusBanner } from './StatusBanner';

/** New workspace routes use capabilities, never onboarding/membership role names. */
export function WorkspaceRoute({ children, admin = false, permission, feature }: { children: ReactNode; admin?: boolean; permission?: Permission; feature?: Feature }) {
  const router = useRouter(); const pathname = usePathname();
  const session = useSession();
  const destination = resolveAuthDestination(session);
  const target = redirectTarget(destination, pathname);
  useEffect(() => { if (target) router.replace(target); }, [router, target]);
  if (destination.kind === 'login') return null;
  if (destination.kind !== 'dashboard' || !session.user) return <DashboardSessionSkeleton displayName={session.cachedDisplayName} onRetry={session.status === 'error' ? () => void session.refreshSession() : undefined} />;
  const user = session.user;
  let content: ReactNode = children;
  if (permission) content = <RequirePermission permission={permission}>{content}</RequirePermission>;
  if (feature) content = <RequireFeature feature={feature}>{content}</RequireFeature>;
  if (session.workspaceStatus === 'loading') content = <LoadingState label="Checking administrator access" />;
  if (session.workspaceStatus === 'error') content = <ErrorState error={session.workspaceError} retry={() => void session.refreshWorkspace()} />;
  if (admin && session.workspaceStatus === 'ready' && session.workspace?.platformRole !== 'ADMIN') content = <NoAccessState title="Administrator access required" description="Supplier review is restricted to platform administrators." />;
  if (!admin && session.workspaceStatus === 'ready' && !session.workspace?.activeBusiness) content = <NoAccessState title="No active business" description="Complete business signup before opening this workspace." />;
  return <DashboardShell user={user} data={EMPTY_SUPPLIER_DASHBOARD} activePath={pathname ?? '/dashboard'} variant={admin ? 'admin' : 'supplier'} businessName={admin ? 'Sellonit platform' : session.workspace?.activeBusiness?.name}>
    {!admin && session.workspaceStatus === 'ready' ? <StatusBanner status={session.workspace?.supplierStatus ?? null} /> : null}
    {content}
  </DashboardShell>;
}
