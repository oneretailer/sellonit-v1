'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AuthUser } from '@/lib/auth/types';
import { SETUP_STEPS, type SupplierDashboardData } from '@/lib/dashboard/supplierDashboard';
import { DashboardIcon } from './icons';
import {
  DASHBOARD_NAV_GROUPS,
  DASHBOARD_NAV_ITEMS,
  dashboardNavItemForPath,
  type DashboardNavGroup,
} from './navigation';

export function getUserFullName(user: Pick<AuthUser, 'firstName' | 'lastName'>): string {
  return `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
}

export function getSetupProgress(data: SupplierDashboardData): {
  completed: number;
  total: number;
  percent: number;
} {
  const knownIds = new Set<string>(SETUP_STEPS.map((step) => step.id));
  const completed = new Set(data.setup.completedStepIds.filter((id) => knownIds.has(id))).size;
  const total = SETUP_STEPS.length;
  return { completed, total, percent: Math.round((completed / total) * 100) };
}

function SetupProgress({
  data,
  compact = false,
}: {
  data: SupplierDashboardData;
  compact?: boolean;
}) {
  const { percent } = getSetupProgress(data);
  return (
    <Link
      href="/dashboard/business-profile/setup"
      prefetch={false}
      aria-disabled="true"
      onClick={(event) => event.preventDefault()}
      className={`block rounded-2xl border border-primary/20 bg-orange-50 p-4 text-left ${compact ? 'min-h-11 p-3' : ''}`}
    >
      {/* TODO(profile-setup): keep this future link disabled until profile setup is designed and routed. */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-ink">Complete setup</span>
        <span className="font-heading text-sm font-semibold text-primary">{percent}%</span>
      </div>
      <p className="mt-2 text-xs text-subtle">Supplier profile in progress</p>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-orange-100"
        role="progressbar"
        aria-label="Supplier setup progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </Link>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
  nested = false,
}: {
  item: (typeof DASHBOARD_NAV_ITEMS)[number];
  pathname: string;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const active =
    item.id === 'overview'
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(`${item.href}/`);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
        nested ? 'ml-7' : ''
      } ${active ? 'bg-orange-50 font-semibold text-ink after:absolute after:right-0 after:top-2 after:h-7 after:w-1 after:rounded-l-full after:bg-primary' : 'text-subtle hover:bg-gray-50 hover:text-ink'}`}
    >
      <DashboardIcon name={item.icon} className="size-[18px] shrink-0" />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

function Navigation({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const [expandedGroups, setExpandedGroups] = useState<Set<DashboardNavGroup>>(
    () => new Set(DASHBOARD_NAV_GROUPS.map((group) => group.id)),
  );
  const dashboard = DASHBOARD_NAV_ITEMS.find((item) => item.id === 'dashboard');
  const overview = DASHBOARD_NAV_ITEMS.find((item) => item.id === 'overview');
  return (
    <nav aria-label="Supplier workspace navigation" className="flex min-h-0 flex-1 flex-col gap-5">
      {dashboard && overview ? (
        <div className="flex flex-col gap-1">
          <div className="flex min-h-11 items-center gap-3 px-3 text-sm font-semibold text-ink">
            <DashboardIcon name={dashboard.icon} className="size-[18px] shrink-0" />
            <span>{dashboard.label}</span>
          </div>
          <NavLink item={overview} pathname={pathname} onNavigate={onNavigate} nested />
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
                  <NavLink key={item.id} item={item} pathname={pathname} onNavigate={onNavigate} />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </nav>
  );
}

function SidebarContent({
  user,
  data,
  businessName,
  pathname,
  onNavigate,
}: {
  user: AuthUser;
  data: SupplierDashboardData;
  businessName: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex min-h-full flex-col gap-6 px-4 py-7">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{businessName}</p>
        <p className="mt-1 text-xs text-subtle">Supplier workspace</p>
      </div>
      <SetupProgress data={data} />
      <Navigation pathname={pathname} onNavigate={onNavigate} />
      <span className="sr-only">Signed in as {getUserFullName(user)}</span>
    </div>
  );
}

export function DashboardShell({
  user,
  data,
  children,
  activePath,
}: {
  user: AuthUser;
  data: SupplierDashboardData;
  children: ReactNode;
  activePath: string;
}) {
  const pathname = usePathname() ?? activePath;
  const fullName = getUserFullName(user);
  const businessName = data.businessName?.trim() || fullName;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const profileContainerRef = useRef<HTMLDivElement>(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFirst = () => drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const frame = requestAnimationFrame(focusFirst);
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeDrawer, drawerOpen]);

  useEffect(() => {
    function closeOnDesktop() {
      if (window.matchMedia('(min-width: 1024px)').matches) setDrawerOpen(false);
    }
    window.addEventListener('resize', closeOnDesktop);
    return () => window.removeEventListener('resize', closeOnDesktop);
  }, []);

  useEffect(() => {
    function closeProfile(event: PointerEvent) {
      if (!profileContainerRef.current?.contains(event.target as Node)) setProfileOpen(false);
    }
    function escapeProfile(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileOpen(false);
    }
    document.addEventListener('pointerdown', closeProfile);
    document.addEventListener('keydown', escapeProfile);
    return () => {
      document.removeEventListener('pointerdown', closeProfile);
      document.removeEventListener('keydown', escapeProfile);
    };
  }, []);

  const overview = DASHBOARD_NAV_ITEMS.find((item) => item.id === 'overview');
  const activeItem = dashboardNavItemForPath(pathname);

  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="relative z-30 flex h-22 items-center justify-between border-b border-line bg-white px-4 md:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            ref={menuButtonRef}
            type="button"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            aria-controls="supplier-workspace-drawer"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-ink hover:bg-gray-50 focus-visible:outline lg:hidden"
          >
            <DashboardIcon name="menu" />
          </button>
          <Link
            href="/dashboard/overview"
            aria-label="Sellonit dashboard home"
            className="shrink-0"
          >
            <Image
              src="/wordmark.svg"
              alt="Sellonit"
              width={160}
              height={36}
              className="h-7 w-auto"
              priority
            />
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <span
            className="hidden max-w-52 truncate text-sm font-medium text-ink md:block"
            title={businessName}
          >
            {businessName}
          </span>
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => undefined /* TODO(backend): connect notifications */}
            className="inline-flex size-11 items-center justify-center rounded-full text-ink hover:bg-gray-50"
          >
            <DashboardIcon name="bell" className="size-5" />
          </button>
          <div className="relative" ref={profileContainerRef}>
            <button
              type="button"
              aria-label="Profile menu"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((open) => !open)}
              className="inline-flex size-11 items-center justify-center rounded-full border border-line text-ink hover:bg-gray-50"
            >
              <DashboardIcon name="user" />
            </button>
            {profileOpen ? (
              <div
                role="menu"
                className="absolute right-0 top-13 z-50 w-64 rounded-2xl border border-line bg-white p-4 shadow-lg"
              >
                <div role="menuitem" aria-disabled="true" tabIndex={-1}>
                  <p className="truncate text-sm font-semibold text-ink">
                    {fullName || user.email}
                  </p>
                  <p className="mt-1 truncate text-xs text-subtle">{user.email}</p>
                </div>
                <p className="mt-4 border-t border-line pt-3 text-xs text-subtle">
                  {/* TODO(backend): offer a sign-out action once the auth API exposes it. */}
                  Sign out is not available yet.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <div className="flex min-h-[990px]">
        <aside className="hidden w-[250px] shrink-0 border-r border-line bg-white lg:block">
          <SidebarContent user={user} data={data} businessName={businessName} pathname={pathname} />
        </aside>
        <div className="min-w-0 flex-1">
          <main className="mx-auto w-full max-w-screen-2xl min-w-0 px-4 py-5 md:px-6 md:py-6 lg:px-7 lg:py-7 2xl:px-8">
            <div className="mb-5 lg:hidden">
              <SetupProgress data={data} compact />
            </div>
            {children}
            {activeItem && activeItem.id !== 'overview' ? (
              <span className="sr-only">{activeItem.label} selected</span>
            ) : null}
          </main>
        </div>
      </div>
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDrawer();
          }}
        >
          <aside
            id="supplier-workspace-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Supplier workspace navigation"
            className="h-full w-[min(20rem,88vw)] overflow-y-auto border-r border-line bg-white shadow-xl"
          >
            <div className="flex min-h-22 items-center justify-between border-b border-line px-4">
              <Link
                href="/dashboard/overview"
                aria-label="Sellonit dashboard home"
                onClick={closeDrawer}
              >
                <Image
                  src="/wordmark.svg"
                  alt="Sellonit"
                  width={160}
                  height={36}
                  className="h-7 w-auto"
                />
              </Link>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={closeDrawer}
                className="min-h-11 min-w-11 rounded-xl hover:bg-gray-50"
              >
                <span aria-hidden="true" className="text-2xl leading-none">
                  ×
                </span>
              </button>
            </div>
            <div className="px-4 py-5">
              <p className="truncate text-sm font-semibold">{businessName}</p>
              <p className="mt-1 text-xs text-subtle">Supplier workspace</p>
              <div className="mt-5">
                <Navigation pathname={pathname} onNavigate={closeDrawer} />
              </div>
            </div>
          </aside>
        </div>
      ) : null}
      <span className="sr-only">Active page: {overview?.label ?? 'Dashboard'}</span>
    </div>
  );
}
