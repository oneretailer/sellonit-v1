import type { DateRange } from './supplierDashboard';

export type DateRangePreset = 'month-to-date' | 'last-7-days' | 'last-30-days' | 'last-month';

export type DateRangeOption = {
  id: DateRangePreset;
  label: string;
  range: DateRange;
};

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function subtractDays(date: Date, count: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - count);
  return result;
}

export function getDateRangeOptions(now = new Date()): DateRangeOption[] {
  const today = startOfDay(now);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  const option = (id: DateRangePreset, label: string, from: Date, to: Date): DateRangeOption => ({
    id,
    label,
    range: { from: toIsoDate(from), to: toIsoDate(to) },
  });
  return [
    option('month-to-date', 'Month to date', monthStart, today),
    option('last-7-days', 'Last 7 days', subtractDays(today, 6), today),
    option('last-30-days', 'Last 30 days', subtractDays(today, 29), today),
    option('last-month', 'Last month', lastMonthStart, lastMonthEnd),
  ];
}

export function formatRangeLong(range: DateRange): string {
  const from = new Date(`${range.from}T12:00:00`);
  const to = new Date(`${range.to}T12:00:00`);
  const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
  const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${from.getDate()}–${to.getDate()} ${monthYear.format(to)}`;
  }
  return `${dayMonth.format(from)}–${dayMonth.format(to)} ${to.getFullYear()}`;
}

export function formatRangeCompact(range: DateRange): string {
  const from = new Date(`${range.from}T12:00:00`);
  const to = new Date(`${range.to}T12:00:00`);
  const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${from.getDate()}–${to.getDate()} ${new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      year: 'numeric',
    }).format(to)}`;
  }
  return `${dayMonth.format(from)}–${dayMonth.format(to)} ${to.getFullYear()}`;
}

export function formatMonthDate(date: string): string {
  const parsed = date.includes('T') ? new Date(date) : new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function getTimeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
