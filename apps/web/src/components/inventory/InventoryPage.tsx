'use client';

/**
 * `/dashboard/inventory` — supplier inventory management list.
 * Reuses the dashboard shell, `ProductStatCard`, `StockStatusPill`,
 * `ProductsTableSkeleton`, `StatePanel`, `AdjustStockDialog`, and `ImportCsvDialog`.
 */
import Link from 'next/link';
import { useState } from 'react';
import { DashboardIcon } from '@/components/dashboard/icons';
import { ProductStatCard } from '@/components/products/ProductStatCard';
import { StockStatusPill } from '@/components/products/ProductStatusPill';
import { ProductsTableSkeleton } from '@/components/products/ProductsTableSkeleton';
import { StatePanel } from '@/components/workspace/StatePanel';
import { isEndpointNotImplemented } from '@/lib/api-client';
import { useBusiness } from '@/lib/business/BusinessProvider';
import { cn } from '@/lib/cn';
import { PRODUCTS_PAGE_SIZE } from '@/lib/inventory/constants';
import { useInventoryList, useInventorySummary } from '@/lib/inventory/queries';
import type { InventoryItem, InventoryTab } from '@/lib/inventory/types';
import { PRODUCT_ROUTES } from '@/lib/products/constants';
import { AdjustStockDialog } from './AdjustStockDialog';
import { ImportCsvDialog } from './ImportCsvDialog';
import { useInventoryFilters } from './useInventoryFilters';

const countFormat = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });

const TABS: readonly { id: InventoryTab; label: string }[] = [
  { id: 'all', label: 'All products' },
  { id: 'low-stock', label: 'Low stock' },
  { id: 'out-of-stock', label: 'Out of stock' },
  { id: 'in-stock', label: 'In stock' },
];

function InventoryThumb({ item }: { item: InventoryItem }) {
  return item.imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- API-served product thumbnail.
    <img
      src={item.imageUrl}
      alt=""
      className="size-10 shrink-0 rounded-ws-control border border-line object-cover"
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-ws-control bg-canvas text-caption"
    >
      <DashboardIcon name="image" className="size-4" />
    </span>
  );
}

export function InventoryPage() {
  const { filters, params, searchText, setSearch, setFilters, clearSearch, hasActiveFilters } =
    useInventoryFilters();
  const { can } = useBusiness();
  const list = useInventoryList(params);
  const summary = useInventorySummary();

  const [adjustState, setAdjustState] = useState<{
    item: InventoryItem;
    trigger: HTMLElement | null;
  } | null>(null);
  const [csvState, setCsvState] = useState<{
    open: boolean;
    trigger: HTMLElement | null;
  }>({ open: false, trigger: null });

  const canAdjust = can('inventory:write');
  const canCreateProduct = can('product:write');

  const counts: Record<InventoryTab, number | undefined> = {
    all: summary.data?.total,
    'low-stock': summary.data?.low,
    'out-of-stock': summary.data?.out,
    'in-stock': summary.data?.inStock,
  };

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const total = meta?.total ?? 0;
  const page = filters.page;
  const from = total === 0 ? 0 : (page - 1) * PRODUCTS_PAGE_SIZE + 1;
  const to = total === 0 ? 0 : Math.min(from + Math.max(rows.length, 1) - 1, total);

  const isLoading = list.isPending;
  const apiUnavailable = list.isError && isEndpointNotImplemented(list.error);
  const isTrueEmpty = !isLoading && !list.isError && total === 0 && !hasActiveFilters;
  const isSearchOrTabEmpty = !isLoading && !list.isError && rows.length === 0 && hasActiveFilters;

  const activeDialogItem = adjustState
    ? (rows.find((row) => row.productId === adjustState.item.productId) ?? adjustState.item)
    : null;

  const statsLoading = summary.isPending || (isLoading && !summary.data);

  return (
    <>
      {/* Page header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-[length:var(--text-ws-page-title)] font-semibold text-ink">
            Inventory
          </h1>
          <p className="mt-1 text-[length:var(--text-ws-body)] text-subtle">
            Manage available stock manually or through CSV import.
          </p>
        </div>
        {canAdjust && !apiUnavailable ? (
          <button
            type="button"
            onClick={(event) => setCsvState({ open: true, trigger: event.currentTarget })}
            className="inline-flex min-h-10 items-center gap-2 rounded-ws-control bg-primary px-4 text-[length:var(--text-ws-body)] font-semibold text-on-primary transition-colors hover:bg-primary-hover"
          >
            <DashboardIcon name="upload" className="size-4" />
            Import CSV
          </button>
        ) : null}
      </div>

      {/* Three stat cards */}
      <div className="grid gap-4 sm:grid-cols-3" aria-busy={statsLoading}>
        <ProductStatCard
          label="Total products"
          value={countFormat.format(summary.data?.total ?? 0)}
          subline="Products in your catalogue"
          icon="products"
          tone="gray"
          isLoading={statsLoading}
        />
        <ProductStatCard
          label="Low stock"
          value={countFormat.format(summary.data?.low ?? 0)}
          subline="Products needing attention"
          icon="alert"
          tone="orange"
          isLoading={statsLoading}
        />
        <ProductStatCard
          label="Out of stock"
          value={countFormat.format(summary.data?.out ?? 0)}
          subline="Products with no available stock"
          icon="box"
          tone="red"
          isLoading={statsLoading}
        />
      </div>

      {/* Main list card */}
      <section className="overflow-hidden rounded-ws-card border border-line bg-surface shadow-ws-card">
        {/* Single-row horizontally scrollable tabs */}
        <nav
          aria-label="Inventory stock status"
          className="flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-line px-4 pt-3 sm:px-5"
        >
          {TABS.map((tab) => {
            const active = filters.tab === tab.id;
            const count = counts[tab.id];
            const label =
              count !== undefined ? `${tab.label} · ${countFormat.format(count)}` : tab.label;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => setFilters({ tab: tab.id })}
                className={cn(
                  'relative flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-ws-control px-3 text-[length:var(--text-ws-body)] transition-colors',
                  active ? 'font-semibold text-ink' : 'font-medium text-subtle hover:text-ink',
                )}
              >
                {label}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Full-width search input */}
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <div className="relative min-w-0">
            <DashboardIcon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-caption"
            />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by product name or SKU"
              aria-label="Search by product name or SKU"
              className="min-h-11 w-full rounded-ws-control border border-line bg-surface pl-10 pr-3.5 text-[length:var(--text-ws-body)] text-ink placeholder:text-caption focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Body */}
        <div aria-busy={isLoading} aria-live="polite">
          {isLoading ? (
            <ProductsTableSkeleton rows={6} />
          ) : apiUnavailable ? (
            // TODO(BE-014): remove once /api/v1/supplier/inventory* is mounted on the backend.
            <div className="p-4 sm:p-6">
              <StatePanel
                icon="inventory"
                tone="cream"
                title="Inventory management is coming soon"
                description="Supplier inventory endpoints are not available on the server yet. Stock tracking and adjustments will unlock once the inventory API is deployed."
                className="min-h-[40vh] border-0"
              />
            </div>
          ) : list.isError ? (
            <div className="p-4 sm:p-6">
              <StatePanel
                icon="wifi-off"
                tone="gray"
                title="We couldn't load your inventory"
                description="Check your connection and try again. Your stock quantities haven't changed."
                className="min-h-[40vh] border-0"
                actions={
                  <button
                    type="button"
                    onClick={() => {
                      void list.refetch();
                      void summary.refetch();
                    }}
                    className="min-h-11 rounded-ws-control bg-primary px-6 text-[length:var(--text-ws-body)] font-semibold text-on-primary transition-colors hover:bg-primary-hover"
                  >
                    Try again
                  </button>
                }
              />
            </div>
          ) : isTrueEmpty ? (
            <div className="p-4 sm:p-6">
              <StatePanel
                icon="inventory"
                tone="cream"
                title="No products to track yet"
                description="Add products to your catalogue to manage their stock."
                className="min-h-[40vh] border-0"
                actions={
                  canCreateProduct ? (
                    <Link
                      href={PRODUCT_ROUTES.new}
                      className="inline-flex min-h-11 items-center gap-2 rounded-ws-control bg-primary px-6 text-[length:var(--text-ws-body)] font-semibold text-on-primary transition-colors hover:bg-primary-hover"
                    >
                      <DashboardIcon name="plus" className="size-4" />
                      Add product
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : isSearchOrTabEmpty ? (
            <div className="p-4 sm:p-6">
              <StatePanel
                icon="search"
                tone="gray"
                title="No products match your search"
                description="Try a different search term, or clear your search to see all products."
                className="min-h-[40vh] border-0"
                actions={
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="min-h-11 rounded-ws-control border border-line bg-surface px-6 text-[length:var(--text-ws-body)] font-semibold text-ink transition-colors hover:bg-canvas"
                  >
                    Clear search
                  </button>
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop/tablet table (md+) inside its own horizontal-scroll container */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-left text-[length:var(--text-ws-caption)] font-medium text-subtle">
                      <th scope="col" className="px-5 py-3">
                        Product / SKU
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Available stock
                      </th>
                      <th scope="col" className="px-4 py-3">
                        <span>Reserved</span>
                        <span className="block text-[11px] font-normal text-caption">
                          System-managed
                        </span>
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Stock status
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className={cn(list.isFetching && 'opacity-70 transition-opacity')}>
                    {rows.map((item) => (
                      <tr
                        key={item.productId}
                        className="h-[72px] border-b border-line last:border-b-0 hover:bg-canvas/60"
                      >
                        <td className="px-5 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <InventoryThumb item={item} />
                            <div className="min-w-0">
                              <p className="truncate text-[length:var(--text-ws-body)] font-medium text-ink">
                                {item.name}
                              </p>
                              <p className="truncate text-[length:var(--text-ws-caption)] text-caption">
                                {item.sku}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[length:var(--text-ws-body)] font-medium text-ink">
                          {countFormat.format(item.availableQuantity)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[length:var(--text-ws-body)] text-subtle">
                          {typeof item.reservedQuantity === 'number' ? (
                            <span className="font-medium text-ink">
                              {countFormat.format(item.reservedQuantity)}
                            </span>
                          ) : (
                            <span aria-label="Unavailable">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StockStatusPill
                            quantity={item.availableQuantity}
                            status={item.stockStatus}
                            lowStock={item.lowStock}
                          />
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-right">
                          {canAdjust ? (
                            <button
                              type="button"
                              aria-label={`Adjust stock for ${item.name}`}
                              onClick={(event) =>
                                setAdjustState({ item, trigger: event.currentTarget })
                              }
                              className="inline-flex min-h-9 items-center justify-center rounded-ws-control border border-primary bg-surface px-3.5 text-[length:var(--text-ws-body)] font-medium text-primary transition-colors hover:bg-primary-tint"
                            >
                              Adjust stock
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Stacked cards (below md) */}
              <ul
                className={cn(
                  'flex flex-col md:hidden',
                  list.isFetching && 'opacity-70 transition-opacity',
                )}
              >
                {rows.map((item) => (
                  <li
                    key={item.productId}
                    className="flex flex-col gap-3 border-b border-line px-4 py-4 last:border-b-0"
                  >
                    <div className="flex items-start gap-3">
                      <InventoryThumb item={item} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[length:var(--text-ws-body)] font-medium text-ink">
                          {item.name}
                        </p>
                        <p className="truncate text-[length:var(--text-ws-caption)] text-caption">
                          {item.sku}
                        </p>
                      </div>
                      <StockStatusPill
                        quantity={item.availableQuantity}
                        status={item.stockStatus}
                        lowStock={item.lowStock}
                      />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-[length:var(--text-ws-body)]">
                      <div>
                        <span className="text-[length:var(--text-ws-caption)] text-caption">
                          Available:{' '}
                        </span>
                        <span className="font-medium text-ink">
                          {countFormat.format(item.availableQuantity)}
                        </span>
                      </div>
                      {typeof item.reservedQuantity === 'number' ? (
                        <div>
                          <span className="text-[length:var(--text-ws-caption)] text-caption">
                            Reserved:{' '}
                          </span>
                          <span className="font-medium text-ink">
                            {countFormat.format(item.reservedQuantity)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    {canAdjust ? (
                      <button
                        type="button"
                        aria-label={`Adjust stock for ${item.name}`}
                        onClick={(event) => setAdjustState({ item, trigger: event.currentTarget })}
                        className="inline-flex min-h-10 w-full items-center justify-center rounded-ws-control border border-primary bg-surface px-4 text-[length:var(--text-ws-body)] font-medium text-primary transition-colors hover:bg-primary-tint"
                      >
                        Adjust stock
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>

              {/* Reserved stock footnote */}
              <p className="border-t border-line px-4 py-3 text-[length:var(--text-ws-caption)] text-caption sm:px-5">
                — Reserved quantity is unavailable here, not zero. Reserved stock is system-managed
                and cannot be edited.
              </p>
            </>
          )}
        </div>

        {/* Server-paginated footer */}
        {!isLoading && !list.isError && total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3.5 sm:px-5">
            <p className="text-[length:var(--text-ws-body)] text-subtle">
              Showing {from}–{to} of {countFormat.format(total)} products
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setFilters({ page: page - 1 })}
                className="min-h-9 rounded-ws-control border border-line bg-surface px-3.5 text-[length:var(--text-ws-body)] font-medium text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={meta ? page >= meta.totalPages : rows.length < PRODUCTS_PAGE_SIZE}
                onClick={() => setFilters({ page: page + 1 })}
                className="min-h-9 rounded-ws-control border border-line bg-surface px-3.5 text-[length:var(--text-ws-body)] font-medium text-ink transition-colors hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {activeDialogItem ? (
        <AdjustStockDialog
          key={activeDialogItem.productId}
          open={adjustState !== null}
          item={activeDialogItem}
          returnFocusTo={adjustState?.trigger ?? null}
          onClose={() => setAdjustState(null)}
          onRefreshConflict={async () => {
            const refreshed = await list.refetch();
            void summary.refetch();
            return refreshed.data?.data.find((row) => row.productId === activeDialogItem.productId);
          }}
        />
      ) : null}

      {csvState.open ? (
        <ImportCsvDialog
          open={csvState.open}
          returnFocusTo={csvState.trigger}
          onClose={() => setCsvState({ open: false, trigger: null })}
        />
      ) : null}
    </>
  );
}
