'use client';

/**
 * /dashboard/products — supplier products list.
 * Server pagination (page size 10), URL-synced filters, summary stat cards,
 * optimistic publish/unpublish, delete confirmation. Below md the table
 * becomes stacked cards; nothing overflows horizontally.
 */
import Link from 'next/link';
import { useState } from 'react';
import { DashboardIcon } from '@/components/dashboard/icons';
import { ConfirmDialog } from '@/components/workspace/ConfirmDialog';
import { StatePanel } from '@/components/workspace/StatePanel';
import { useToast } from '@/components/workspace/ToastProvider';
import { Select } from '@/components/workspace/Field';
import { isEndpointNotImplemented } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatNaira } from '@/lib/money';
import { useBusiness } from '@/lib/business/BusinessProvider';
import {
  useDeleteProduct,
  useProductCategories,
  useProductSummary,
  useProductsList,
  usePublishProduct,
} from '@/lib/products/queries';
import { PRODUCTS_PAGE_SIZE, PRODUCT_ROUTES } from '@/lib/products/constants';
import type { Product } from '@/lib/products/types';
import { ProductStatCard } from './ProductStatCard';
import { ProductStatusPill, StockText } from './ProductStatusPill';
import { ProductRowMenu } from './ProductRowMenu';
import { ProductsTableSkeleton } from './ProductsTableSkeleton';
import { useProductFilters, type ProductsTab } from './useProductFilters';

function ProductThumb({ product }: { product: Product }) {
  const image = product.images[0];
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element -- API-served product thumbnail.
    <img
      src={image.url}
      alt=""
      className="size-12 shrink-0 rounded-xl border border-line object-cover"
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-subtle"
    >
      <DashboardIcon name="image" className="size-5" />
    </span>
  );
}

const TABS: { id: ProductsTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
];

export function ProductsListPage() {
  const { filters, params, searchText, setSearch, setFilters, clearFilters, hasActiveFilters } =
    useProductFilters();
  const { can } = useBusiness();
  const notify = useToast();
  const list = useProductsList(params);
  const summary = useProductSummary();
  const categories = useProductCategories();
  const publish = usePublishProduct();
  const remove = useDeleteProduct();
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const canWrite = can('product:write');
  const counts: Record<ProductsTab, number | undefined> = {
    all: summary.data?.total,
    published: summary.data?.published,
    draft: summary.data?.drafts,
  };

  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const total = meta?.total ?? 0;
  const page = filters.page;
  const from = total === 0 ? 0 : (page - 1) * PRODUCTS_PAGE_SIZE + 1;
  const to = Math.min(page * PRODUCTS_PAGE_SIZE, total);
  const isLoading = list.isPending;
  const apiUnavailable = list.isError && isEndpointNotImplemented(list.error);
  const isTrueEmpty = !isLoading && !list.isError && total === 0 && !hasActiveFilters;
  const isFilterEmpty = !isLoading && !list.isError && rows.length === 0 && hasActiveFilters;

  function togglePublish(product: Product) {
    publish.mutate(
      { id: product.id, publish: product.status !== 'published' },
      {
        onSuccess: () =>
          notify(product.status !== 'published' ? 'Product published.' : 'Product unpublished.'),
        onError: () => notify('Could not update the product. Try again.', 'error'),
      },
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(deleteTarget.id);
      notify('Product deleted.');
      setDeleteTarget(null);
      // Deleting the last row of a page: step back so the user isn't stranded.
      if (rows.length === 1 && page > 1) setFilters({ page: page - 1 });
    } catch {
      setDeleteError('Could not delete this product. Try again.');
    }
  }

  const rowActions = (product: Product) => (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={PRODUCT_ROUTES.edit(product.id)}
        className="flex min-h-9 items-center rounded-lg px-2.5 text-sm font-medium text-subtle transition-colors hover:bg-gray-50 hover:text-ink"
      >
        View
      </Link>
      {canWrite ? (
        <>
          <Link
            href={PRODUCT_ROUTES.edit(product.id)}
            className="flex min-h-9 items-center rounded-lg px-2.5 text-sm font-medium text-primary transition-colors hover:bg-orange-50"
          >
            Edit
          </Link>
          <ProductRowMenu
            product={product}
            onTogglePublish={togglePublish}
            onDelete={(target) => {
              setDeleteError(null);
              setDeleteTarget(target);
            }}
            disabled={publish.isPending}
          />
        </>
      ) : null}
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-ink md:text-[28px]">Products</h1>
          <p className="mt-1 text-sm text-subtle">Manage your catalogue, prices and stock.</p>
        </div>
        {canWrite && !apiUnavailable ? (
          <Link
            href={PRODUCT_ROUTES.new}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover"
          >
            <DashboardIcon name="plus" className="size-4" />
            Add product
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3" aria-busy={summary.isPending}>
        <ProductStatCard
          label="Total products"
          value={summary.data?.total ?? 0}
          subline={
            summary.data
              ? `${summary.data.published} published · ${summary.data.drafts} drafts`
              : undefined
          }
          icon="products"
          isLoading={summary.isPending}
        />
        <ProductStatCard
          label="Low stock"
          value={summary.data?.lowStock ?? 0}
          icon="alert"
          tone="orange"
          href="/dashboard/inventory"
          isLoading={summary.isPending}
        />
        <ProductStatCard
          label="Out of stock"
          value={summary.data?.outOfStock ?? 0}
          icon="box"
          tone="red"
          href="/dashboard/inventory"
          isLoading={summary.isPending}
        />
      </div>

      <section className="overflow-visible rounded-2xl border border-line bg-white">
        {/* Tabs + counts */}
        <div
          className="flex flex-wrap items-center gap-1 border-b border-line px-4 pt-3 sm:px-5"
          role="tablist"
          aria-label="Product status"
        >
          {TABS.map((tab) => {
            const active = filters.tab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilters({ tab: tab.id })}
                className={cn(
                  'relative flex min-h-11 items-center gap-2 rounded-t-lg px-3 text-sm font-medium transition-colors',
                  active ? 'text-primary' : 'text-subtle hover:text-ink',
                )}
              >
                {tab.label}
                {counts[tab.id] !== undefined ? (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs',
                      active ? 'bg-orange-50 text-primary' : 'bg-gray-100 text-subtle',
                    )}
                  >
                    {counts[tab.id]}
                  </span>
                ) : null}
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary"
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:px-5 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <DashboardIcon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
            />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by product name or SKU"
              aria-label="Search by product name or SKU"
              className="min-h-11 w-full rounded-xl border border-line bg-white pl-9 pr-3 text-sm text-ink placeholder:text-subtle/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:flex md:items-center">
            <Select
              id="products-filter-category"
              label="Category"
              hideLabel
              value={filters.category}
              onChange={(event) => setFilters({ category: event.target.value })}
              wrapperClassName="md:w-44"
            >
              <option value="">All categories</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <Select
              id="products-filter-stock"
              label="Stock"
              hideLabel
              value={filters.stock}
              onChange={(event) =>
                setFilters({ stock: event.target.value as typeof filters.stock })
              }
              wrapperClassName="md:w-40"
            >
              <option value="all">All stock</option>
              <option value="in-stock">In stock</option>
              <option value="low-stock">Low stock</option>
              <option value="out-of-stock">Out of stock</option>
            </Select>
          </div>
        </div>

        {/* Body */}
        <div aria-busy={isLoading} aria-live="polite">
          {isLoading ? (
            <ProductsTableSkeleton />
          ) : apiUnavailable ? (
            // TODO(BE-002): remove once /api/v1/supplier/products* is mounted on the backend.
            <div className="p-4 sm:p-6">
              <StatePanel
                icon="products"
                tone="cream"
                title="Product catalogue is coming soon"
                description="Supplier product management is not available on the server yet. Complete your business profile while the catalogue API is being deployed."
                className="min-h-[40vh] border-0"
              />
            </div>
          ) : list.isError ? (
            <div className="p-4 sm:p-6">
              <StatePanel
                icon="wifi-off"
                tone="gray"
                title="We couldn't load your products"
                description="Check your connection and try again. Your products haven't gone anywhere."
                className="min-h-[40vh] border-0"
                actions={
                  <button
                    type="button"
                    onClick={() => void list.refetch()}
                    className="min-h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover"
                  >
                    Try again
                  </button>
                }
              />
            </div>
          ) : isTrueEmpty ? (
            <div className="p-4 sm:p-6">
              <StatePanel
                icon="products"
                tone="cream"
                title="No products yet"
                description="Add your first product to start selling. You can save a draft and publish when you're ready."
                className="min-h-[40vh] border-0"
                actions={
                  canWrite ? (
                    <Link
                      href={PRODUCT_ROUTES.new}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover"
                    >
                      <DashboardIcon name="plus" className="size-4" />
                      Add product
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : isFilterEmpty ? (
            <div className="p-4 sm:p-6">
              <StatePanel
                icon="search"
                tone="gray"
                title="No products match your filters"
                description="Try a different search term, or clear the filters to see all products."
                className="min-h-[40vh] border-0"
                actions={
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="min-h-11 rounded-xl border border-line bg-white px-6 text-sm font-semibold text-ink transition-colors hover:bg-gray-50"
                  >
                    Clear filters
                  </button>
                }
              />
            </div>
          ) : (
            <>
              {/* Table (md+). Scrolls inside the card when columns don't fit. */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-medium uppercase tracking-wide text-subtle">
                      <th scope="col" className="px-5 py-3">
                        Product
                      </th>
                      <th scope="col" className="hidden px-4 py-3 lg:table-cell">
                        Category
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Wholesale price
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Stock
                      </th>
                      <th scope="col" className="px-4 py-3">
                        Status
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className={cn(list.isFetching && 'opacity-70 transition-opacity')}>
                    {rows.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b border-line last:border-b-0 hover:bg-gray-50/50"
                      >
                        <td className="px-5 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <ProductThumb product={product} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-ink">
                                {product.name}
                              </p>
                              <p className="truncate text-xs text-subtle">{product.sku}</p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden max-w-36 truncate px-4 py-3 text-sm text-subtle lg:table-cell">
                          {product.category}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-ink">
                          {formatNaira(product.wholesalePrice)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <StockText quantity={product.stockQuantity} lowStock={product.lowStock} />
                        </td>
                        <td className="px-4 py-3">
                          <ProductStatusPill status={product.status} />
                        </td>
                        <td className="px-5 py-3">{rowActions(product)}</td>
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
                {rows.map((product) => (
                  <li
                    key={product.id}
                    className="flex flex-col gap-3 border-b border-line px-4 py-4 last:border-b-0"
                  >
                    <div className="flex items-start gap-3">
                      <ProductThumb product={product} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{product.name}</p>
                        <p className="truncate text-xs text-subtle">{product.sku}</p>
                        <p className="mt-1 text-sm font-medium text-ink">
                          {formatNaira(product.wholesalePrice)}
                        </p>
                      </div>
                      <ProductStatusPill status={product.status} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <StockText quantity={product.stockQuantity} lowStock={product.lowStock} />
                      {rowActions(product)}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Footer */}
        {!isLoading && !list.isError && total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-5">
            <p className="text-sm text-subtle">
              Showing {from}–{to} of {total} products
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setFilters({ page: page - 1 })}
                className="min-h-10 rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={meta ? page >= meta.totalPages : rows.length < PRODUCTS_PAGE_SIZE}
                onClick={() => setFilters({ page: page + 1 })}
                className="min-h-10 rounded-xl border border-line bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <ConfirmDialog
        open={deleteTarget !== null}
        tone="danger"
        title="Delete this product?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be permanently removed from your catalogue. This can't be undone.`
            : ''
        }
        confirmLabel="Delete product"
        pending={remove.isPending}
        error={deleteError}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          if (!remove.isPending) setDeleteTarget(null);
        }}
      />
    </>
  );
}
