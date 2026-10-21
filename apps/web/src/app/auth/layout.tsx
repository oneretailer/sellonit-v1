import type { ReactNode } from 'react';
import { AuthenticatedAuthRouteGate } from '@/components/auth/AuthenticatedAuthRouteGate';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthenticatedAuthRouteGate>{children}</AuthenticatedAuthRouteGate>;
}
