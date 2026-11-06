'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { SupplierDashboardData } from '@/lib/dashboard/supplierDashboard';
import { EMPTY_SUPPLIER_DASHBOARD } from '@/lib/dashboard/supplierDashboard';
import {
  computeSupplierSetupProgress,
  useSupplierSetupProgress,
} from '@/lib/onboarding/supplierSetup';
import type { OnboardingBusinessDraft } from '@/lib/auth/flowState';
import { useSession } from '@/lib/auth/AuthSessionProvider';
import type { AuthUser } from '@/lib/auth/types';
import { isEndpointNotImplemented } from '@/lib/api-client';
import { AUTH_ROUTE } from '@/lib/auth/authDestination';
import { useBusiness } from '@/lib/business/BusinessProvider';
import { useOptionalNavigationGuard } from '@/components/workspace/NavigationGuard';
import { BusinessSwitcher } from './BusinessSwitcher';
import { DashboardIcon } from './icons';
import {
  DASHBOARD_NAV_GROUPS,
  DASHBOARD_NAV_ITEMS,
  type DashboardNavGroup,
  type DashboardNavItem,
} from './navigation';

const SUPPLIER_SETUP_ROUTE = '/dashboard/supplier-setup';

export function getUserFullName(user: Pick<AuthUser, 'firstName' | 'lastName'>): string {
  return `${user.firstName} ${user.lastName}`.trim() || 'Your account';
}

/** Test-facing helper kept for existing callers; both paths share the one setup source. */
export function getSetupProgress(
  data: SupplierDashboardData,
  draft: OnboardingBusinessDraft | null,
): { completed: number; total: number; percent: number } {
  const progress = computeSupplierSetupProgress(data.setup.completedStepIds, draft);
  return { completed: progress.completed, total: progress.total, percent: progress.percent };
}

function SetupProgress({ data }: { data: SupplierDashboardData }) {
  const { percent, completed, total } = useSupplierSetupProgress(data.setup.completedStepIds);
  if (percent >= 100) return null;
  return (
    <div className="rounded-2xl border border-primary/30 bg-orange-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-ink">Complete your business setup</p>
        <span className="shrink-0 text-sm font-semibold text-primary">{percent}%</span>
      </div>
      <p className="mt-1 text-xs text-subtle">
        {completed} of {total} steps completed
      </p>
      <div
        role="progressbar"
        aria-label="Business setup progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-orange-100"
      >
        <span
          className="block h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <Link
        href={SUPPLIER_SETUP_ROUTE}
        className="mt-4 flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover"
      >
        Continue setup
      </Link>
    </div>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
  nested = false,
}: {
  item: DashboardNavItem;
  pathname: string;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const guard = useOptionalNavigationGuard();
  const active =
    item.id === 'overview'
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      onClick={(event) => {
        if (guard) {
          event.preventDefault();
          guard.navigate(item.href);
          onNavigate?.();
        } else {
          onNavigate?.();
        }
      }}
      className={`relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${nested ? 'ml-7' : ''} ${
        active
          ? 'bg-orange-50 font-semibold text-ink after:absolute after:right-0 after:top-2 after:h-7 after:w-1 after:rounded-l-full after:bg-primary'
          : 'text-subtle hover:bg-gray-50 hover:text-ink'
      }`}
    >
      <DashboardIcon name={item.icon} className="size-[18px] shrink-0" />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

function Navigation({
  activePath,
  onNavigate,
  variant = 'supplier',
}: {
  activePath: string;
  onNavigate?: () => void;
  variant?: 'supplier' | 'admin';
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<DashboardNavGroup>>(
    () => new Set(DASHBOARD_NAV_GROUPS.map((group) => group.id)),
  );
  const dashboard = DASHBOARD_NAV_ITEMS.find((item) => item.id === 'dashboard');
  const overview = DASHBOARD_NAV_ITEMS.find((item) => item.id === 'overview');
  if (variant === 'admin') {
    return (
      <nav aria-label="Platform administration navigation">
        <Link
          href="/admin/suppliers"
          onClick={onNavigate}
          aria-current={activePath.startsWith('/admin/suppliers') ? 'page' : undefined}
          className="flex min-h-11 items-center gap-3 rounded-xl bg-orange-50 px-3 text-sm font-semibold text-ink"
        >
          <DashboardIcon name="business" className="size-[18px]" />
          Supplier review
        </Link>
      </nav>
    );
  }
  return (
    <nav aria-label="Supplier workspace navigation" className="flex min-h-0 flex-1 flex-col gap-5">
      {dashboard && overview ? (
        <div className="flex flex-col gap-1">
          <div className="flex min-h-11 items-center gap-3 px-3 text-sm font-semibold text-ink">
            <DashboardIcon name={dashboard.icon} className="size-[18px] shrink-0" />
            <span>{dashboard.label}</span>
          </div>
          <NavLink item={overview} pathname={activePath} onNavigate={onNavigate} nested />
        </div>
      ) : null}
      {DASHBOARD_NAV_GROUPS.map((group) => {
        const expanded = expandedGroups.has(group.id);
        const items = DASHBOARD_NAV_ITEMS.filter((item) => item.group === group.id);
        return (
          <section key={group.id} className="flex flex-col gap-1">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => {
                setExpandedGroups((current) => {
                  const next = new Set(current);
                  if (next.has(group.id)) next.delete(group.id);
                  else next.add(group.id);
                  return next;
                });
              }}
              className="flex min-h-11 items-center justify-between gap-2 px-3 text-left text-xs font-medium text-gray-500"
            >
              <span>{group.label}</span>
              <span
                aria-hidden="true"
                className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
              >
                <DashboardIcon name="chevron" className="size-4" />
              </span>
            </button>
            {expanded ? (
              <div className="flex flex-col gap-1">
                {items.map((item) => (
                  <NavLink
                    key={item.id}
                    item={item}
                    pathname={activePath}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </nav>
  );
}

function ProfileMenu() {
  const { user, signOut } = useSession();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullName = user ? getUserFullName(user) : 'Your account';
  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() || 'S'
    : 'S';

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function onSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
      window.location.assign(AUTH_ROUTE.login);
    } catch (caught) {
      // TODO(BE-001): POST /auth/logout is not yet mounted in apps/api; explain clearly without faking sign-out.
      setError(
        isEndpointNotImplemented(caught)
          ? 'Sign-out is not available on the server yet.'
          : 'Could not sign out. Try again.',
      );
      setSigningOut(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((current) => !current)}
        className="flex size-11 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-primary transition-colors hover:bg-orange-200"
      >
        {initials}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-2 shadow-lg"
        >
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-semibold text-ink">{fullName}</p>
            {user?.email ? <p className="truncate text-xs text-subtle">{user.email}</p> : null}
          </div>
          {error ? (
            <p role="alert" className="px-3 pt-2 text-xs text-danger">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={() => void onSignOut()}
            className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium text-ink transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            <DashboardIcon name="logout" className="size-4 text-subtle" />
            {signingOut ? 'Signing out…' : 'Log out'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // TODO(BE-010): wire GET /notifications and unread badge once implemented on the backend.
  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="relative flex size-11 shrink-0 items-center justify-center rounded-xl text-subtle transition-colors hover:bg-gray-50 hover:text-ink"
      >
        <DashboardIcon name="bell" className="size-5" />
      </button>
      {open ? (
        <div
          role="status"
          aria-live="polite"
          className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-white p-3 text-xs text-subtle shadow-lg"
        >
          Notifications are coming soon.
        </div>
      ) : null}
    </div>
  );
}

function SidebarContent({
  businessName,
  variant,
  data,
  activePath,
  onNavigate,
}: {
  businessName: string;
  variant: 'supplier' | 'admin';
  data: SupplierDashboardData;
  activePath: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="mb-5 px-3">
        <p className="truncate text-sm font-semibold text-ink">{businessName}</p>
        <p className="text-xs text-subtle">
          {variant === 'admin' ? 'Platform workspace' : 'Supplier workspace'}
        </p>
      </div>
      {variant === 'supplier' ? (
        <div className="mb-5 px-1">
          <SetupProgress data={data} />
        </div>
      ) : null}
      <Navigation activePath={activePath} onNavigate={onNavigate} variant={variant} />
    </>
  );
}

export function DashboardShell({
  children,
  user,
  data = EMPTY_SUPPLIER_DASHBOARD,
  activePath,
  variant = 'supplier',
  businessName,
}: {
  children: ReactNode;
  user: AuthUser;
  data?: SupplierDashboardData;
  activePath: string;
  variant?: 'supplier' | 'admin';
  businessName?: string;
}) {
  const pathname = usePathname();
  const business = useBusiness();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerId = useId();
  const fullName = getUserFullName(user);
  const resolvedBusinessName =
    businessName ?? business.activeBusiness?.name ?? (data.businessName || fullName);

  // Close the drawer whenever the route changes (adjusting state during render
  // is React's recommended alternative to a setState-in-effect cascade).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    const dialog = drawerRef.current;
    if (!dialog) return;
    if (drawerOpen && !dialog.open) dialog.showModal();
    if (!drawerOpen && dialog.open) dialog.close();
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus();

    // Document-level so Escape/Tab work regardless of where focus sits.
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerOpen]);

  function closeDrawer() {
    setDrawerOpen(false);
    menuButtonRef.current?.focus();
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <a
        href="#dashboard-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary focus:shadow-lg"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-white">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:min-h-20 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              aria-controls={drawerId}
              onClick={() => setDrawerOpen(true)}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl text-ink transition-colors hover:bg-gray-50 lg:hidden"
            >
              <DashboardIcon name="menu" className="size-6" />
            </button>
            <Link href="/dashboard/overview" aria-label="Sellonit dashboard" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- brand wordmark served locally. */}
              <img src="/wordmark.svg" alt="Sellonit" className="h-7 w-auto sm:h-8" />
            </Link>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {variant === 'supplier' ? (
              <BusinessSwitcher />
            ) : (
              <span className="hidden items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm font-medium text-ink sm:flex">
                <DashboardIcon name="business" className="size-4 text-subtle" />
                Sellonit platform
              </span>
            )}
            <NotificationsMenu />
            <ProfileMenu />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="sticky top-16 hidden max-h-[calc(100dvh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-line bg-white px-3 py-6 sm:top-20 sm:max-h-[calc(100dvh-5rem)] lg:block">
          <SidebarContent
            businessName={resolvedBusinessName}
            variant={variant}
            data={data}
            activePath={activePath}
          />
          <div className="mt-6 border-t border-line px-3 pt-4">
            <p className="truncate text-sm font-medium text-ink">{fullName}</p>
            <p className="truncate text-xs text-subtle">{user.email}</p>
          </div>
        </aside>

        <main id="dashboard-content" className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-7">
          <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">{children}</div>
        </main>
      </div>

      <dialog
        ref={drawerRef}
        aria-label="Supplier workspace navigation"
        onCancel={(event) => {
          event.preventDefault();
          closeDrawer();
        }}
        onClick={(event) => {
          // Backdrop clicks target the dialog itself but land outside its box.
          if (event.target !== drawerRef.current) return;
          const rect = drawerRef.current.getBoundingClientRect();
          const outside =
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom;
          if (outside) closeDrawer();
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh w-[min(20rem,85vw)] max-w-none border-0 bg-white p-0 shadow-xl backdrop:bg-black/60 lg:hidden"
      >
        <div className="flex h-full flex-col overflow-y-auto p-4">
          <div className="mb-4 flex items-center justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element -- brand wordmark served locally. */}
            <img src="/wordmark.svg" alt="Sellonit" className="h-7 w-auto" />
            <button
              type="button"
              aria-label="Close navigation"
              onClick={closeDrawer}
              className="flex size-11 items-center justify-center rounded-xl text-subtle transition-colors hover:bg-gray-50 hover:text-ink"
            >
              <DashboardIcon name="close" className="size-5" />
            </button>
          </div>
          <SidebarContent
            businessName={resolvedBusinessName}
            variant={variant}
            data={data}
            activePath={activePath}
            onNavigate={closeDrawer}
          />
          <div className="mt-auto border-t border-line px-3 pt-4">
            <p className="truncate text-sm font-medium text-ink">{fullName}</p>
            <p className="truncate text-xs text-subtle">{user.email}</p>
          </div>
        </div>
      </dialog>
      <span className="sr-only">Signed in as {fullName}</span>
    </div>
  );
}
