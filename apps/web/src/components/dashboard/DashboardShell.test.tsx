/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardShell, getSetupProgress } from './DashboardShell';
import { DASHBOARD_NAV_GROUPS, dashboardNavItemForPath } from './navigation';
import { EMPTY_SUPPLIER_DASHBOARD } from '@/lib/dashboard/supplierDashboard';
import type { AuthUser } from '@/lib/auth/types';

const mocks = vi.hoisted(() => ({ pathname: '/dashboard/overview' }));
vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock('next/image', () => ({
  default: ({
    priority: _priority,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Next Image is mocked for DOM tests.
    <img {...props} />
  ),
}));

afterEach(() => cleanup());
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mocks.pathname = '/dashboard/overview';
  document.body.style.overflow = '';
});

const user: AuthUser = {
  id: 'user-1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: null,
  status: 'ACTIVE',
  emailVerifiedAt: null,
  phoneVerifiedAt: null,
  createdAt: '2026-10-26T00:00:00.000Z',
  updatedAt: '2026-10-26T00:00:00.000Z',
};

function renderShell() {
  return render(
    <DashboardShell user={user} data={EMPTY_SUPPLIER_DASHBOARD} activePath="/dashboard/overview">
      <h1>Dashboard content</h1>
    </DashboardShell>,
  );
}

describe('supplier workspace shell', () => {
  it('renders Overview as the active page and uses the typed placeholder destinations', () => {
    renderShell();
    expect(screen.getByRole('link', { name: 'Overview' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(dashboardNavItemForPath('/dashboard/inventory')?.label).toBe('Inventory');
    expect(DASHBOARD_NAV_GROUPS.map((group) => group.label)).toEqual([
      'Catalogue and inventory',
      'Orders and fulfilments',
      'Business management',
    ]);
    expect(screen.getAllByText('Ada Lovelace').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
  });

  it('collapses and expands navigation groups with real expanded state', async () => {
    const userEventSession = userEvent.setup();
    renderShell();
    const group = screen.getByRole('button', { name: 'Catalogue and inventory' });
    expect(group.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: 'Products' })).toBeTruthy();
    await userEventSession.click(group);
    expect(group.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('link', { name: 'Products' })).toBeNull();
    await userEventSession.click(group);
    expect(screen.getByRole('link', { name: 'Products' })).toBeTruthy();
  });

  it('opens an accessible mobile drawer, traps focus, locks scrolling and restores focus on Escape', async () => {
    const userEventSession = userEvent.setup();
    renderShell();
    const openButton = screen.getByRole('button', { name: 'Open navigation' });
    await userEventSession.click(openButton);
    const dialog = screen.getByRole('dialog', { name: 'Supplier workspace navigation' });
    expect(openButton.getAttribute('aria-expanded')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    const focusable = dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    const first = focusable.item(0);
    const last = focusable.item(focusable.length - 1);
    if (!first || !last) throw new Error('Expected focusable drawer navigation');
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.body.style.overflow).toBe('');
    await waitFor(() => expect(document.activeElement).toBe(openButton));
    expect(openButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the mobile drawer when its overlay is clicked', async () => {
    const userEventSession = userEvent.setup();
    renderShell();
    await userEventSession.click(screen.getByRole('button', { name: 'Open navigation' }));
    const dialog = screen.getByRole('dialog');
    const overlay = dialog.parentElement;
    if (!overlay) throw new Error('Expected drawer overlay');
    fireEvent.mouseDown(overlay, { target: overlay });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('derives setup progress from known completion ids and ignores unknown ids', () => {
    expect(getSetupProgress(EMPTY_SUPPLIER_DASHBOARD)).toEqual({
      completed: 1,
      total: 5,
      percent: 20,
    });
    const progress = getSetupProgress({
      ...EMPTY_SUPPLIER_DASHBOARD,
      setup: { completedStepIds: ['account', 'account', 'not-a-step'] },
    });
    expect(progress).toEqual({ completed: 1, total: 5, percent: 20 });
  });
});
