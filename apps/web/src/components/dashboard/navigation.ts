import type { DashboardIconName } from './icons';

export type DashboardNavGroup = 'dashboard' | 'catalogue' | 'orders' | 'business';

export type DashboardNavItem = {
  id: string;
  label: string;
  icon: DashboardIconName;
  href: string;
  group: DashboardNavGroup;
  parentId?: string;
};

/** Single navigation source for desktop, drawer, active state and placeholders. */
export const DASHBOARD_NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'dashboard',
    href: '/dashboard/overview',
    group: 'dashboard',
  },
  {
    id: 'overview',
    label: 'Overview',
    icon: 'dashboard',
    href: '/dashboard/overview',
    group: 'dashboard',
    parentId: 'dashboard',
  },
  {
    id: 'products',
    label: 'Products',
    icon: 'products',
    href: '/dashboard/products',
    group: 'catalogue',
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: 'inventory',
    href: '/dashboard/inventory',
    group: 'catalogue',
  },
  {
    id: 'pricing',
    label: 'Pricing',
    icon: 'pricing',
    href: '/dashboard/pricing',
    group: 'catalogue',
  },
  { id: 'orders', label: 'Orders', icon: 'orders', href: '/dashboard/orders', group: 'orders' },
  {
    id: 'fulfilment',
    label: 'Fulfilment',
    icon: 'fulfilment',
    href: '/dashboard/fulfilment',
    group: 'orders',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: 'analytics',
    href: '/dashboard/analytics',
    group: 'business',
  },
  {
    id: 'business-profile',
    label: 'Business profile',
    icon: 'business',
    href: '/dashboard/business-profile',
    group: 'business',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    href: '/dashboard/settings',
    group: 'business',
  },
] as const satisfies readonly DashboardNavItem[];

export const DASHBOARD_NAV_GROUPS: readonly { id: DashboardNavGroup; label: string }[] = [
  { id: 'catalogue', label: 'Catalogue and inventory' },
  { id: 'orders', label: 'Orders and fulfilments' },
  { id: 'business', label: 'Business management' },
];

export function dashboardNavItemForPath(pathname: string): DashboardNavItem | undefined {
  return DASHBOARD_NAV_ITEMS.filter((item) => item.group !== 'dashboard')
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
