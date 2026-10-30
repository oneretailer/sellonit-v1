import type { ReactNode } from 'react';

export type DashboardIconName =
  | 'dashboard'
  | 'products'
  | 'inventory'
  | 'pricing'
  | 'orders'
  | 'fulfilment'
  | 'analytics'
  | 'business'
  | 'settings'
  | 'bell'
  | 'user'
  | 'menu'
  | 'calendar'
  | 'chevron'
  | 'sales'
  | 'box'
  | 'alert'
  | 'arrow';

const ICON_PATHS: Record<DashboardIconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  products: (
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 16 9 5 9-5" />
    </>
  ),
  inventory: (
    <>
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  pricing: (
    <>
      <path d="M20.6 13.4 13 21l-10-10V3h8l9.6 9.6a.6.6 0 0 1 0 .8Z" />
      <circle cx="7" cy="7" r="1" />
    </>
  ),
  orders: (
    <>
      <path d="M5 4h14l1 17H4L5 4Z" />
      <path d="M9 8a3 3 0 0 0 6 0" />
      <path d="M8 4a4 4 0 0 1 8 0" />
    </>
  ),
  fulfilment: (
    <>
      <path d="M3 6h11v12H3zM14 10h4l3 3v5h-7z" />
      <circle cx="7.5" cy="19" r="1.5" />
      <circle cx="17.5" cy="19" r="1.5" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 19V5M4 19h17" />
      <path d="m7 15 4-4 3 2 6-7" />
    </>
  ),
  business: (
    <>
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 21v-3h4v3" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path
        d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.7-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2Z"
        transform="translate(-1 -1) scale(1.08)"
      />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  menu: (
    <>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  sales: (
    <>
      <path d="M4 19V5M4 19h17" />
      <path d="m7 15 4-4 3 2 6-7" />
    </>
  ),
  box: (
    <>
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Z" />
      <path d="m4 7.5 8 4.5 8-4.5M12 12v9" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2.8 19a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
};

export function DashboardIcon({
  name,
  className = 'size-5',
}: {
  name: DashboardIconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
