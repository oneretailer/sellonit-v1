/**
 * The ONE place that decides where a signed-in user belongs.
 *
 * Every guard, page and success handler must use `resolveAuthDestination` /
 * `redirectTarget`; no page decides on its own. The decision uses **server
 * data only** (`GET /auth/me` + server capability check):
 *
 *   not authenticated                   → /auth/login
 *   email not verified                  → /auth/verify-email (check-your-email)
 *   verified platform ADMIN (no intent) → /admin/suppliers
 *   verified, not onboarded             → /auth/role-selection
 *   verified and onboarded              → /dashboard/overview
 *
 * "Onboarded" is `user.onboardingIntent != null` (PUT /auth/business-intent
 * stores it on the account), so a user who onboarded on another browser is
 * never asked again. sessionStorage is only a selection memory and never an
 * input here.
 *
 * While the session is still loading (or a session check failed) the result is
 * `{ kind: 'loading' }` — callers must render a skeleton and must NOT redirect.
 */
import type { Route } from 'next';
import type { AuthUser } from './types';

export type AuthSessionStatus = 'checking' | 'authenticated' | 'unauthenticated' | 'error';

export type AuthWorkspaceSnapshot = {
  platformRole?: 'ADMIN' | 'USER';
} | null;

/** Session shape the decision needs (matches AuthSessionProvider's context). */
export type AuthSessionSnapshot = {
  status: AuthSessionStatus;
  user: Pick<AuthUser, 'emailVerifiedAt' | 'onboardingIntent'> | null;
  workspace?: AuthWorkspaceSnapshot;
};

export const AUTH_ROUTE = {
  login: '/auth/login',
  verifyEmail: '/auth/verify-email',
  roleSelection: '/auth/role-selection',
  createBusiness: '/auth/create-business',
  dashboard: '/dashboard/overview',
  admin: '/admin/suppliers',
} as const satisfies Record<string, Route>;

/** Every dashboard page lives under this prefix. */
export const DASHBOARD_BASE = '/dashboard';
/** Capability-guarded workspace families share the authenticated destination. */
export const WORKSPACE_BASES = [DASHBOARD_BASE, '/products', '/admin'] as const;

export type AuthDestination =
  | { kind: 'loading'; path: null }
  | { kind: 'login'; path: Route }
  | { kind: 'verify-email'; path: Route }
  | { kind: 'role-selection'; path: Route }
  | { kind: 'dashboard'; path: Route };

export function resolveAuthDestination(session: AuthSessionSnapshot): AuthDestination {
  const { status, user, workspace } = session;
  if (status === 'unauthenticated') {
    return { kind: 'login', path: AUTH_ROUTE.login };
  }
  // 'checking', 'error', or an authenticated status without a user: unresolved.
  if (status !== 'authenticated' || !user) {
    return { kind: 'loading', path: null };
  }
  if (!user.emailVerifiedAt) {
    return { kind: 'verify-email', path: AUTH_ROUTE.verifyEmail };
  }
  if (!user.onboardingIntent) {
    if (workspace?.platformRole === 'ADMIN') {
      return { kind: 'dashboard', path: AUTH_ROUTE.admin };
    }
    return { kind: 'role-selection', path: AUTH_ROUTE.roleSelection };
  }
  return { kind: 'dashboard', path: AUTH_ROUTE.dashboard };
}

function isWithin(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * The path a guard should navigate to, or null when it must stay put.
 *
 * Never returns the path it was called for, so a guard can never redirect a
 * page to itself (the classic redirect-loop trigger). The dashboard is treated
 * as one destination family: every `/dashboard/...` page already *is* the
 * dashboard destination, so a signed-in user on a dashboard section is left
 * alone instead of being bounced to Overview.
 */
export function redirectTarget(
  destination: AuthDestination,
  pathname: string | null | undefined,
): Route | null {
  if (destination.path === null) return null;
  if (pathname) {
    if (destination.path === pathname) return null;
    if (
      destination.kind === 'dashboard' &&
      WORKSPACE_BASES.some((base) => isWithin(pathname, base))
    ) {
      return null;
    }
  }
  return destination.path;
}
