'use client';
import { useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/AuthSessionProvider';
import { listSuppliers } from '@/lib/workspace/adminApi';
import { workspaceKeys } from '@/lib/workspace/queryKeys';
import type { SupplierStatus } from '@/lib/workspace/types';
import { EmptyState, ErrorState, LoadingState } from '@/components/workspace/StatePanel';
import { Pagination } from '@/components/workspace/Pagination';
import { StatusChip } from '@/components/workspace/StatusBanner';

const TABS: readonly SupplierStatus[] = [
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'DRAFT',
];
const date = new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
export function SupplierQueue() {
  const { user } = useSession();
  const [status, setStatus] = useState<SupplierStatus>('PENDING_REVIEW');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const filters = { status, page, pageSize };
  const query = useQuery({
    queryKey: workspaceKeys.supplierList(user?.id ?? '', filters),
    queryFn: ({ signal }) => listSuppliers(filters, signal),
    placeholderData: keepPreviousData,
    enabled: !!user,
  });
  function selectStatus(next: SupplierStatus) {
    setStatus(next);
    setPage(1);
  }
  return (
    <section>
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold md:text-3xl">Supplier review</h1>
        <p className="mt-2 text-sm text-subtle">
          Review supplier applications and manage account access.
        </p>
      </div>
      <div
        role="tablist"
        aria-label="Supplier status"
        className="mb-5 flex gap-2 overflow-x-auto pb-2"
      >
        {TABS.map((tab, index) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`supplier-tab-${tab}`}
            aria-selected={status === tab}
            aria-controls="supplier-results"
            tabIndex={status === tab ? 0 : -1}
            onClick={() => selectStatus(tab)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? TABS.length - 1
                    : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
              selectStatus(TABS[next]!);
              document.getElementById(`supplier-tab-${TABS[next]}`)?.focus();
            }}
            className={`min-h-11 shrink-0 rounded-full px-4 text-xs font-semibold ${status === tab ? 'bg-primary text-ink' : 'bg-gray-50 text-subtle hover:bg-orange-50'}`}
          >
            {tab.replaceAll('_', ' ')}
          </button>
        ))}
      </div>
      <div
        id="supplier-results"
        role="tabpanel"
        aria-labelledby={`supplier-tab-${status}`}
        aria-busy={query.isFetching}
      >
        {query.isPending ? (
          <LoadingState label="Loading suppliers" />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : !query.data.data.length ? (
          <EmptyState
            title="No suppliers in this queue"
            description="Applications with this status will appear here."
          />
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {query.data.data.map((supplier) => (
                <li key={supplier.id} className="rounded-2xl border border-line p-4">
                  <Link
                    href={`/admin/suppliers/${supplier.id}`}
                    className="font-semibold text-ink underline decoration-primary underline-offset-4"
                  >
                    {supplier.businessName}
                  </Link>
                  <p className="mt-2 text-sm text-subtle">{supplier.ownerPhone}</p>
                  <p className="mt-1 text-xs text-subtle">
                    Submitted{' '}
                    {supplier.submittedAt
                      ? date.format(new Date(supplier.submittedAt))
                      : 'Not submitted'}
                  </p>
                  <div className="mt-3">
                    <StatusChip status={supplier.status} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto rounded-2xl border border-line md:block">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">{status.replaceAll('_', ' ')} suppliers</caption>
                <thead className="bg-gray-50 text-xs text-subtle">
                  <tr>
                    {['Business name', 'Owner phone', 'Submitted', 'Status', 'Action'].map(
                      (label) => (
                        <th key={label} scope="col" className="px-4 py-4 font-semibold">
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {query.data.data.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-orange-50/30">
                      <td className="px-4 py-4 font-medium">{supplier.businessName}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-subtle">
                        {supplier.ownerPhone}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-subtle">
                        {supplier.submittedAt
                          ? date.format(new Date(supplier.submittedAt))
                          : 'Not submitted'}
                      </td>
                      <td className="px-4 py-4">
                        <StatusChip status={supplier.status} />
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/admin/suppliers/${supplier.id}`}
                          className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <label className="flex items-center gap-2 text-xs text-subtle">
                Rows
                <select
                  aria-label="Rows per page"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className="min-h-11 rounded-xl border border-line bg-white px-3"
                >
                  {[10, 20, 50].map((size) => (
                    <option key={size}>{size}</option>
                  ))}
                </select>
              </label>
            </div>
            <Pagination meta={query.data.meta} onPageChange={setPage} disabled={query.isFetching} />
          </>
        )}
      </div>
    </section>
  );
}
