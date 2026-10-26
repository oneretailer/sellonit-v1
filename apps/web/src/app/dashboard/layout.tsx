import type { ReactNode } from 'react';

/** Dashboard auth is resolved by the shared root AuthSessionProvider and route guard. */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
