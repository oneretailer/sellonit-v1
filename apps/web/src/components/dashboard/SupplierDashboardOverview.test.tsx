/** @vitest-environment jsdom */

import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SupplierDashboardOverview, formatNaira } from './SupplierDashboardOverview';
import { getDateRangeOptions, getTimeGreeting } from '@/lib/dashboard/dateRanges';
import {
  EMPTY_SUPPLIER_DASHBOARD,
  localSupplierDashboardApi,
  SETUP_STEPS,
} from '@/lib/dashboard/supplierDashboard';
import { getSetupProgress } from './DashboardShell';
import type { AuthUser } from '@/lib/auth/types';
import type { SupplierDashboardData } from '@/lib/dashboard/supplierDashboard';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => cleanup());
beforeEach(() => {
  vi.useRealTimers();
});

const user: AuthUser = {
  id: 'user-1',
  email: 'ada@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phone: null,
  status: 'ACTIVE',
  onboardingIntent: null,
  emailVerifiedAt: '2026-10-20T00:00:00.000Z',
  phoneVerifiedAt: null,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
};

const selectedRange = getDateRangeOptions(new Date(2026, 9, 26))[0]!;
const emptyProps = {
  user,
  data: EMPTY_SUPPLIER_DASHBOARD,
  isLoading: false,
  error: false,
  retry: vi.fn(),
  selectedRange,
  rangeOptions: getDateRangeOptions(new Date(2026, 9, 26)),
  onRangeChange: vi.fn(),
};

function cardWithLabel(label: string) {
  const heading = screen.getByRole('heading', { name: label });
  const card = heading.closest('article');
  if (!card) throw new Error(`Card for ${label} was not rendered`);
  return within(card);
}

describe('supplier dashboard overview', () => {
  it('uses empty local data, renders zero summaries and empty states, and contains no design samples', async () => {
    const data = await localSupplierDashboardApi.getDashboard(selectedRange.range);
    render(<SupplierDashboardOverview {...emptyProps} data={data} />);

    expect(cardWithLabel('Total sales').getByText('₦0')).toBeTruthy();
    expect(cardWithLabel('Orders').getByText('0')).toBeTruthy();
    expect(cardWithLabel('Listed products').getByText('0')).toBeTruthy();
    expect(cardWithLabel('Stock alerts').getByText('0')).toBeTruthy();
    expect(screen.getByText('From 0 retailer orders')).toBeTruthy();
    expect(screen.getByText('0 awaiting fulfilment')).toBeTruthy();
    expect(screen.getByText('0 low stock · 0 out of stock')).toBeTruthy();
    expect(screen.getByText('No sales yet for this period')).toBeTruthy();
    expect(screen.getByText('No stock alerts. Everything looks good.')).toBeTruthy();
    expect(
      screen.getByText('No retailer orders yet. Orders from retailers will appear here.'),
    ).toBeTruthy();
    const text = document.body.textContent ?? '';
    for (const forbidden of [
      'Okechukwu',
      'Supplier Fashion',
      '₦2,480,000',
      'Classic cotton tee',
      'SF-CT-001',
      'Urban Threads',
      "Nneka's Boutique",
      'The Style Room',
      'Moda Collective',
      '#SO-1048',
      '₦260,000',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('renders real non-empty values, singular wording, statuses, and a time-aware greeting', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T09:30:00+01:00'));
    const data: SupplierDashboardData = {
      ...EMPTY_SUPPLIER_DASHBOARD,
      summary: {
        totalSales: 1_000_000,
        orderCount: 1,
        retailerOrderCount: 1,
        awaitingFulfilment: 1,
        listedProducts: 2,
        lowStock: 0,
        outOfStock: 1,
      },
      salesTrend: [{ date: '2026-10-26', value: 12_345 }],
      stockAlerts: [
        {
          id: 'real-stock-1',
          name: 'Real cotton shirt',
          sku: 'SKU-001',
          variant: 'Medium',
          quantityLeft: 0,
        },
      ],
      recentOrders: [
        {
          id: 'ORDER-REAL-1',
          retailerName: 'Real Retailer',
          retailerLocation: 'Lagos',
          itemCount: 1,
          orderedAt: '2026-10-26T08:00:00.000Z',
          amount: 12_345,
          status: 'awaiting_fulfilment',
        },
        {
          id: 'ORDER-REAL-2',
          retailerName: 'Another Retailer',
          retailerLocation: 'Abuja',
          itemCount: 2,
          orderedAt: '2026-10-25T08:00:00.000Z',
          amount: 23_450,
          status: 'shipped',
        },
        {
          id: 'ORDER-REAL-3',
          retailerName: 'Third Retailer',
          retailerLocation: 'Kano',
          itemCount: 3,
          orderedAt: '2026-10-24T08:00:00.000Z',
          amount: 34_560,
          status: 'delivered',
        },
      ],
    };
    render(<SupplierDashboardOverview {...emptyProps} data={data} />);

    expect(screen.getByRole('heading', { name: /Ada!/ })).toBeTruthy();
    expect(cardWithLabel('Total sales').getByText('₦1,000,000')).toBeTruthy();
    expect(screen.getByText('From 1 retailer order')).toBeTruthy();
    expect(
      screen.getByText('1 order is awaiting fulfilment. Review and prepare them for dispatch.'),
    ).toBeTruthy();
    expect(screen.getByText('Real cotton shirt')).toBeTruthy();
    expect(screen.getByText('Out of stock')).toBeTruthy();
    expect(screen.getAllByText('ORDER-REAL-1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Awaiting fulfilment').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Shipped').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Delivered').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₦12,345').length).toBeGreaterThan(0);
    const point = screen.getByRole('img', { name: '26 Oct · ₦12,345' });
    fireEvent.focus(point);
    expect(screen.getByRole('status').textContent).toContain('26 Oct · ₦12,345');
    expect(formatNaira(1_000_000)).toBe('₦1,000,000');
  });

  it('uses a time-based greeting and falls back to no first-name suffix', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T09:30:00+01:00'));
    expect(getTimeGreeting(new Date('2026-10-26T11:59:00'))).toBe('Good morning');
    expect(getTimeGreeting(new Date('2026-10-26T12:00:00'))).toBe('Good afternoon');
    expect(getTimeGreeting(new Date('2026-10-26T17:00:00'))).toBe('Good evening');
    const nameless = { ...user, firstName: '' };
    render(<SupplierDashboardOverview {...emptyProps} user={nameless} />);
    expect(screen.getByRole('heading', { name: /Good morning!/ })).toBeTruthy();
  });

  it('does not flash zero summaries while loading and offers a retry on error', () => {
    const { rerender } = render(<SupplierDashboardOverview {...emptyProps} isLoading />);
    expect(screen.queryByText('₦0')).toBeNull();
    expect(screen.getByLabelText('Loading sales')).toBeTruthy();
    rerender(<SupplierDashboardOverview {...emptyProps} error />);
    expect(screen.getByRole('alert').textContent).toContain(
      "We couldn't load your dashboard. Try again.",
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Ada!/ })).toBeTruthy();
  });

  it('opens date presets and signals the active preset accessibly', () => {
    render(<SupplierDashboardOverview {...emptyProps} />);
    const button = screen.getByRole('button', { name: /26 Oct 2026/ });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(screen.getByRole('menu', { name: 'Date range' })).toBeTruthy();
    expect(
      screen.getByRole('menuitem', { name: 'Month to date' }).getAttribute('aria-current'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Last 7 days' }));
    expect(emptyProps.onRangeChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'last-7-days' }),
    );
  });

  it('derives setup completion from the typed setup list', () => {
    expect(SETUP_STEPS).toHaveLength(5);
    expect(getSetupProgress(EMPTY_SUPPLIER_DASHBOARD)).toEqual({
      completed: 1,
      total: 5,
      percent: 20,
    });
  });
});
