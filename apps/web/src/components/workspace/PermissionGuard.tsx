'use client';
import type { ReactNode } from 'react';
import { useSession } from '@/lib/auth/AuthSessionProvider';
import type { Feature, Permission } from '@/lib/workspace/types';
import { ErrorState, LoadingState, NoAccessState } from './StatePanel';

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can, workspaceStatus, workspaceError, refreshWorkspace } = useSession();
  if (workspaceStatus === 'loading') return <LoadingState label="Checking permissions" />;
  if (workspaceStatus === 'error') return <ErrorState error={workspaceError} retry={() => void refreshWorkspace()} />;
  return can(permission) ? children : <NoAccessState />;
}
export function RequireFeature({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { hasFeature, workspaceStatus, workspaceError, refreshWorkspace } = useSession();
  if (workspaceStatus === 'loading') return <LoadingState label="Checking workspace features" />;
  if (workspaceStatus === 'error') return <ErrorState error={workspaceError} retry={() => void refreshWorkspace()} />;
  return hasFeature(feature) ? children : <NoAccessState title="This workspace is not enabled" description="This feature is not enabled for your active business." />;
}
