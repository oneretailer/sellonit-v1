'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { AuthUser } from '@/lib/auth/types';
import type { DateRangeOption } from '@/lib/dashboard/dateRanges';
import {
  formatMonthDate,
  formatRangeLong,
  formatRangeCompact,
  getTimeGreeting,
} from '@/lib/dashboard/dateRanges';
import type { SupplierDashboardData } from '@/lib/dashboard/supplierDashboard';
import { DashboardIcon } from './icons';

const currencyFormat = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});
const countFormat = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });

export function formatNaira(amount: number): string {
  return currencyFormat.format(amount);
}

export function formatCount(count: number): string {
  return countFormat.format(count);
}

function firstName(user: AuthUser): string {
  return user.firstName.trim().split(/\s+/)[0] ?? '';
}

function SkeletonCard({ label }: { label: string }) {
  return (
    <div
      aria-label={`Loading ${label}`}
      className="min-h-32 rounded-3xl border border-line bg-white p-4 xl:min-h-35 xl:p-5"
    >
      <span className="block h-4 w-24 animate-pulse rounded bg-gray-100" />
      <span className="mt-5 block h-8 w-28 animate-pulse rounded bg-gray-100" />
      <span className="mt-3 block h-3 w-36 animate-pulse rounded bg-gray-50" />
    </div>
  );
}

function SummaryCards({ data }: { data: SupplierDashboardData }) {
  const alertCount = data.summary.lowStock + data.summary.outOfStock;
  const retailerWord = data.summary.retailerOrderCount === 1 ? 'retailer order' : 'retailer orders';
  const cards = [
    {
      label: 'Total sales',
      value: formatNaira(data.summary.totalSales),
      hint: `From ${formatCount(data.summary.retailerOrderCount)} ${retailerWord}`,
      icon: 'sales' as const,
    },
    {
      label: 'Orders',
      value: formatCount(data.summary.orderCount),
      hint: `${formatCount(data.summary.awaitingFulfilment)} awaiting fulfilment`,
      icon: 'orders' as const,
      href: '/dashboard/orders',
    },
    {
      label: 'Listed products',
      value: formatCount(data.summary.listedProducts),
      hint: 'Currently listed in your catalogue',
      icon: 'box' as const,
    },
    {
      label: 'Stock alerts',
      value: formatCount(alertCount),
      hint: `${formatCount(data.summary.lowStock)} low stock · ${formatCount(data.summary.outOfStock)} out of stock`,
      icon: 'alert' as const,
      href: '/dashboard/inventory',
    },
  ];
  return (
    <section
      aria-label="Supplier summary"
      className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4"
    >
      {cards.map((card) => (
        <article
          key={card.label}
          className="flex min-h-32 min-w-0 flex-col justify-between gap-2 rounded-3xl border border-line bg-white p-4 xl:min-h-35 xl:p-5 [@media(max-height:800px)]:min-h-28"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-subtle sm:text-sm">{card.label}</h2>
            <DashboardIcon name={card.icon} className="size-[18px] shrink-0 text-subtle" />
          </div>
          <p className="truncate font-heading text-2xl font-semibold tracking-tight text-ink md:text-[28px] xl:text-[32px]">
            {card.value}
          </p>
          {card.href ? (
            <Link
              href={card.href}
              className="inline-flex min-h-11 items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <span>{card.hint}</span>
              <DashboardIcon name="arrow" className="size-4 shrink-0" />
            </Link>
          ) : (
            <p className="min-h-11 content-center text-xs text-subtle">{card.hint}</p>
          )}
        </article>
      ))}
    </section>
  );
}

function DateRangeControl({
  selected,
  options,
  onChange,
}: {
  selected: DateRangeOption;
  options: DateRangeOption[];
  onChange: (option: DateRangeOption) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative hidden min-w-52 flex-col items-end gap-2 md:flex">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink hover:bg-gray-50"
      >
        <DashboardIcon name="calendar" className="size-4 text-subtle" />
        <span>{formatRangeCompact(selected.range)}</span>
        <DashboardIcon
          name="chevron"
          className={`size-4 text-subtle transition-transform ${open ? 'rotate-90' : ''}`}
        />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Date range"
          className="absolute right-0 top-13 z-20 min-w-48 rounded-xl border border-line bg-white p-1 shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitem"
              aria-current={option.id === selected.id ? 'true' : undefined}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm text-ink hover:bg-orange-50"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      <p className="text-right text-xs text-subtle">{selected.label} · All amounts in NGN (₦)</p>
    </div>
  );
}

function yAxisLabel(value: number): string {
  if (value >= 1_000_000) return `${value / 1_000_000}m`;
  if (value >= 1_000) return `${value / 1_000}k`;
  return formatCount(value);
}

function niceMaximum(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const fraction = value / magnitude;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * magnitude;
}

function chartDates(range: { from: string; to: string }, count = 5): Date[] {
  const from = new Date(`${range.from}T12:00:00`);
  const to = new Date(`${range.to}T12:00:00`);
  const span = Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  return Array.from({ length: count }, (_, index) => {
    const dayOffset = count === 1 ? 0 : Math.round((span * index) / (count - 1));
    const date = new Date(from);
    date.setDate(date.getDate() + dayOffset);
    return date;
  });
}

function SalesTrendChart({
  data,
  range,
}: {
  data: SupplierDashboardData['salesTrend'];
  range: { from: string; to: string };
}) {
  const [activePoint, setActivePoint] = useState<{
    x: number;
    y: number;
    date: string;
    value: number;
  } | null>(null);
  const width = 720;
  const height = 220;
  const left = 54;
  const right = 14;
  const top = 12;
  const bottom = 38;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const maximum = niceMaximum(Math.max(0, ...data.map((point) => point.value)));
  const baseline = top + plotHeight;
  const fromTime = new Date(`${range.from}T12:00:00`).getTime();
  const toTime = new Date(`${range.to}T12:00:00`).getTime();
  const dateSpan = Math.max(1, toTime - fromTime);
  const points = data.map((point) => {
    const time = new Date(`${point.date}T12:00:00`).getTime();
    const x = left + ((time - fromTime) / dateSpan) * plotWidth;
    const y = top + plotHeight - (point.value / maximum) * plotHeight;
    return { ...point, x: Math.max(left, Math.min(width - right, x)), y };
  });
  const linePath = points.length
    ? points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
    : `M ${left} ${baseline} L ${width - right} ${baseline}`;
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1]!.x} ${baseline} L ${points[0]!.x} ${baseline} Z`
    : '';
  const dates = chartDates(range);
  const ticks = Array.from({ length: 5 }, (_, index) => (maximum * index) / 4);
  const tooltipDate = activePoint
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
        new Date(`${activePoint.date}T12:00:00`),
      )
    : '';

  return (
    <div className="relative mt-4 min-w-0">
      <svg
        role="img"
        aria-labelledby="sales-trend-title sales-trend-summary"
        viewBox={`0 0 ${width} ${height}`}
        className="h-56 w-full overflow-visible md:h-64 xl:h-72 2xl:h-80 [@media(max-height:800px)]:h-52"
        preserveAspectRatio="none"
        onPointerLeave={() => setActivePoint(null)}
      >
        <title id="sales-trend-title">Sales trend</title>
        <desc id="sales-trend-summary">
          {data.length
            ? `${formatCount(data.length)} daily sales values for ${formatRangeLong(range)}.`
            : 'No sales recorded for this period.'}
        </desc>
        <defs>
          <linearGradient id="sales-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff8a00" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ff8a00" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {ticks.map((tick, index) => {
          const y = top + plotHeight - (tick / maximum) * plotHeight;
          return (
            <g key={index}>
              <line
                x1={left}
                x2={width - right}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray="3 4"
              />
              <text x={left - 8} y={y + 4} textAnchor="end" fill="#6b7280" fontSize="11">
                {yAxisLabel(tick)}
              </text>
            </g>
          );
        })}
        {areaPath ? <path d={areaPath} fill="url(#sales-area-gradient)" /> : null}
        <path
          d={linePath}
          fill="none"
          stroke="#ff8a00"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point) => (
          <circle
            key={point.date}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#fff"
            stroke="#ff8a00"
            strokeWidth="2"
            tabIndex={0}
            role="img"
            aria-label={`${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(`${point.date}T12:00:00`))} · ${formatNaira(point.value)}`}
            onFocus={() =>
              setActivePoint({ x: point.x, y: point.y, date: point.date, value: point.value })
            }
            onBlur={() => setActivePoint(null)}
            onPointerEnter={() =>
              setActivePoint({ x: point.x, y: point.y, date: point.date, value: point.value })
            }
          >
            <title>{`${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(`${point.date}T12:00:00`))} · ${formatNaira(point.value)}`}</title>
          </circle>
        ))}
        {dates.map((date, index) => {
          const x = left + (plotWidth * index) / Math.max(1, dates.length - 1);
          const label = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
            date,
          );
          return (
            <text
              key={date.toISOString()}
              x={x}
              y={height - 8}
              textAnchor="middle"
              fill="#6b7280"
              fontSize="11"
            >
              {label}
            </text>
          );
        })}
      </svg>
      {activePoint ? (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs font-medium text-white shadow"
          style={{
            left: `${(activePoint.x / width) * 100}%`,
            top: `${Math.max(0, (activePoint.y / height) * 100 - 17)}%`,
          }}
        >
          {tooltipDate} · {formatNaira(activePoint.value)}
        </div>
      ) : null}
      {!data.length ? (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-subtle">
          No sales yet for this period
        </p>
      ) : null}
    </div>
  );
}

function SalesTrendCard({
  data,
  range,
}: {
  data: SupplierDashboardData;
  range: { from: string; to: string };
}) {
  return (
    <section className="hidden min-w-0 rounded-3xl border border-line bg-white p-5 md:block md:p-6 [@media(max-height:800px)]:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Sales trend</h2>
          <p className="mt-1 text-xs text-subtle sm:text-sm">
            Daily order value · {formatRangeLong(range)}
          </p>
        </div>
        <Link
          href="/dashboard/analytics"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View analytics <DashboardIcon name="chevron" className="size-4" />
        </Link>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-subtle">
        <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
        Sales (₦)
      </div>
      <SalesTrendChart data={data.salesTrend} range={range} />
    </section>
  );
}

function StockNeedsAttention({ data }: { data: SupplierDashboardData }) {
  const alerts = data.stockAlerts;
  const count = data.summary.lowStock + data.summary.outOfStock;
  return (
    <section className="flex min-w-0 flex-col rounded-3xl border border-line bg-white p-5 md:p-6 [@media(max-height:800px)]:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Stock needs attention</h2>
          <p className="mt-1 text-xs text-subtle sm:text-sm">
            {formatCount(count)} total alerts · {formatCount(data.summary.outOfStock)} out of stock
          </p>
        </div>
        <span className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-full bg-orange-50 px-2 text-sm font-semibold text-primary">
          {formatCount(count)}
        </span>
      </div>
      {alerts.length ? (
        <ul className="mt-4 divide-y divide-line">
          {alerts.map((alert) => (
            <li key={alert.id} className="flex min-h-16 items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{alert.name}</p>
                <p className="mt-1 truncate text-xs text-subtle">
                  {alert.sku} · {alert.variant}
                </p>
              </div>
              <span
                className={`shrink-0 text-xs font-medium ${alert.quantityLeft === 0 ? 'text-danger' : 'text-ink'}`}
              >
                {alert.quantityLeft === 0
                  ? 'Out of stock'
                  : `${formatCount(alert.quantityLeft)} left`}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex min-h-36 flex-1 items-center justify-center py-6 text-center text-sm text-subtle">
          No stock alerts. Everything looks good.
        </p>
      )}
      <Link
        href="/dashboard/inventory"
        className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        Update stock <DashboardIcon name="chevron" className="size-4" />
      </Link>
    </section>
  );
}

function FulfilmentStatus({
  status,
}: {
  status: SupplierDashboardData['recentOrders'][number]['status'];
}) {
  const label =
    status === 'awaiting_fulfilment'
      ? 'Awaiting fulfilment'
      : status === 'shipped'
        ? 'Shipped'
        : 'Delivered';
  const styles =
    status === 'awaiting_fulfilment'
      ? 'bg-orange-50 text-amber-800'
      : status === 'shipped'
        ? 'bg-blue-50 text-blue-700'
        : 'bg-green-50 text-green-700';
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-2 whitespace-nowrap rounded-full px-3 text-xs font-medium ${styles}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function RecentOrders({ data }: { data: SupplierDashboardData }) {
  const count = data.summary.awaitingFulfilment;
  const subtitle =
    count === 0
      ? 'No orders are awaiting fulfilment.'
      : `${formatCount(count)} ${count === 1 ? 'order is' : 'orders are'} awaiting fulfilment. Review and prepare them for dispatch.`;
  return (
    <section className="min-w-0 rounded-3xl border border-line bg-white p-5 md:p-6 [@media(max-height:800px)]:p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Recent retailer orders</h2>
          <p className="mt-1 max-w-2xl text-xs text-subtle sm:text-sm">{subtitle}</p>
        </div>
        <Link
          href="/dashboard/orders"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-hover"
        >
          View all orders
        </Link>
      </div>
      {data.recentOrders.length ? (
        <>
          <div className="mt-5 hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <caption className="sr-only">Recent retailer orders</caption>
              <thead className="bg-gray-50 text-xs font-medium text-subtle">
                <tr>
                  <th scope="col" className="rounded-l-lg px-3 py-3">
                    Order
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Retailer
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Order date
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Amount
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Fulfilment status
                  </th>
                  <th scope="col" className="rounded-r-lg px-3 py-3">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="whitespace-nowrap px-3 py-4 font-medium text-ink">{order.id}</td>
                    <td className="px-3 py-4">
                      <p className="font-medium text-ink">{order.retailerName}</p>
                      <p className="mt-1 text-xs text-subtle">
                        {order.retailerLocation} · {formatCount(order.itemCount)}{' '}
                        {order.itemCount === 1 ? 'item' : 'items'}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-subtle">
                      {formatMonthDate(order.orderedAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 font-medium text-ink">
                      {formatNaira(order.amount)}
                    </td>
                    <td className="px-3 py-4">
                      <FulfilmentStatus status={order.status} />
                    </td>
                    <td className="px-3 py-4">
                      <Link
                        href={
                          order.status === 'awaiting_fulfilment'
                            ? '/dashboard/fulfilment'
                            : '/dashboard/orders'
                        }
                        className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
                      >
                        {order.status === 'awaiting_fulfilment' ? 'Fulfil order' : 'View order'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 flex flex-col gap-3 md:hidden">
            {data.recentOrders.map((order) => (
              <li key={order.id} className="rounded-2xl border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-semibold text-ink">{order.id}</p>
                  <FulfilmentStatus status={order.status} />
                </div>
                <p className="mt-2 truncate text-sm text-subtle">{order.retailerName}</p>
                <p className="mt-3 font-heading text-lg font-semibold text-ink">
                  {formatNaira(order.amount)}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="flex min-h-40 items-center justify-center py-8 text-center text-sm text-subtle">
          No retailer orders yet. Orders from retailers will appear here.
        </p>
      )}
    </section>
  );
}

function OverviewSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {['sales', 'orders', 'products', 'stock'].map((label) => (
          <SkeletonCard key={label} label={label} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="hidden min-h-96 animate-pulse rounded-3xl bg-gray-50 md:block xl:col-span-2 xl:min-h-[30rem]" />
        <div className="min-h-72 animate-pulse rounded-3xl bg-gray-50" />
        <div className="h-11 animate-pulse rounded-xl bg-gray-50 md:hidden" />
      </div>
      <div className="min-h-72 animate-pulse rounded-3xl bg-gray-50" />
    </div>
  );
}

export function SupplierDashboardOverview({
  user,
  data,
  isLoading,
  error,
  retry,
  selectedRange,
  rangeOptions,
  onRangeChange,
}: {
  user: AuthUser;
  data: SupplierDashboardData;
  isLoading: boolean;
  error: boolean;
  retry: () => void;
  selectedRange: DateRangeOption;
  rangeOptions: DateRangeOption[];
  onRangeChange: (option: DateRangeOption) => void;
}) {
  const name = firstName(user);
  const greeting = `${getTimeGreeting()}${name ? ` ${name}` : ''}!`;
  return (
    <div className="flex min-w-0 flex-col gap-5 lg:gap-6 [@media(max-height:800px)]:gap-4">
      <div className="flex min-w-0 flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-semibold leading-tight tracking-[-0.02em] text-[#181818] md:text-[28px] xl:text-[32px] 2xl:text-4xl 2xl:leading-[44px]">
            {greeting}
          </h1>
          <p className="mt-2 text-sm text-subtle md:text-base">
            Here&apos;s an overview of your supplier business.
          </p>
        </div>
        <DateRangeControl
          selected={selectedRange}
          options={rangeOptions}
          onChange={onRangeChange}
        />
      </div>
      {error ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-red-50 px-4 py-3"
        >
          <p className="text-sm text-danger">We couldn&apos;t load your dashboard. Try again.</p>
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-danger underline"
          >
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <OverviewSkeleton />
      ) : (
        <>
          <SummaryCards data={data} />
          <div className="grid min-w-0 gap-4 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <SalesTrendCard data={data} range={selectedRange.range} />
              <Link
                href="/dashboard/analytics"
                className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary md:hidden"
              >
                View analytics <DashboardIcon name="chevron" className="size-4" />
              </Link>
            </div>
            <StockNeedsAttention data={data} />
          </div>
          <RecentOrders data={data} />
        </>
      )}
    </div>
  );
}
