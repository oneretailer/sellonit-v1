'use client';

/**
 * `/dashboard/products` — supplier products list.
 * Server pagination, URL-synced filters, summary stat cards, optimistic
 * publish/unpublish, delete confirmation, and prototype ProductDetailsDialog
 * on "View". Below md the table becomes stacked cards; nothing overflows.
 */
import Link from 'next/link';
import { useMemo, useState } from 'react';
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
import { productsApi } from '@/lib/products/productsApi';
import { PRODUCTS_PAGE_SIZE, PRODUCT_ROUTES } from '@/lib/products/constants';
import type { Product } from '@/lib/products/types';
import { presentError } from '@/lib/workspace/errors';
import { ProductDetailsDialog } from './ProductDetailsDialog';
import { ProductStatCard } from './ProductStatCard';
import { ProductStatusPill, StockText } from './ProductStatusPill';
import { ProductRowMenu } from './ProductRowMenu';
import { ProductsTableSkeleton } from './ProductsTableSkeleton';
import { useProductFilters, type ProductsTab } from './useProductFilters';

const countFormat = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 });

function ProductThumb({ product }: { product: Product }) {
  const image = product.images[0];
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element -- API-served product thumbnail.
    <img
      src={image.url}
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
  const capabilities = productsApi.getCapabilities();
  const list = useProductsList(params);
  const summary = useProductSummary({ enabled: capabilities.summaryEndpoint });
  const categories = useProductCategories({ enabled: capabilities.categoriesEndpoint });
  const publish = usePublishProduct();
  const remove = useDeleteProduct();

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [viewState, setViewState] = useState<{
    product: Product;
    trigger: HTMLElement | null;
  } | null>(null);

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories.data ?? []) {
      map.set(category.id, category.name);
    }
    return map;
  }, [categories.data]);

  const canWrite = can('product:write');
  const rows = list.data?.data ?? [];
  const meta = list.data?.meta;
  const total = meta?.total ?? 0;
  const counts: Record<ProductsTab, number | undefined> = {
    all: summary.data?.total ?? (!hasActiveFilters && meta ? total : undefined),
    published: summary.data?.published,
    draft: summary.data?.drafts,
  };
  const page = filters.page;
  const from = total === 0 ? 0 : (page - 1) * PRODUCTS_PAGE_SIZE + 1;
  const to = total === 0 ? 0 : Math.min(from + Math.max(rows.length, 1) - 1, total);
  const isLoading = list.isPending;
  const apiUnavailable = list.isError && isEndpointNotImplemented(list.error);
  const isTrueEmpty = !isLoading && !list.isError && total === 0 && !hasActiveFilters;
  const isFilterEmpty = !isLoading && !list.isError && rows.length === 0 && hasActiveFilters;

  const activeViewProduct = viewState
    ? (rows.find((row) => row.id === viewState.product.id) ?? viewState.product)
    : null;

  function resolveCategoryLabel(categoryValue: string): string {
    if (!categoryValue) return 'Uncategorised';
    return categoryNameById.get(categoryValue) ?? categoryValue;
  }

  function togglePublish(product: Product) {
    const willPublish = product.status !== 'published';
    publish.mutate(
      { id: product.id, publish: willPublish },
      {
        onSuccess: () =>
          notify(
            willPublish
              ? {
                  title: 'Product published',
                  description: `${product.name} is now listed for retailers to discover.`,
                }
              : {
                  title: 'Product moved to drafts',
                  description: `${product.name} is saved as a draft.`,
                },
          ),
        onError: (caught) =>
          notify({
            title: 'Could not update product',
            description: presentError(caught).message,
            tone: 'error',
          }),
      },
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(deleteTarget.id);
      notify({
        title: 'Product deleted',
        description: `${deleteTarget.name} was removed from your catalogue.`,
      });
      setDeleteTarget(null);
      if (rows.length === 1 && page > 1) setFilters({ page: page - 1 });
    } catch {
      setDeleteError('Could not delete this product. Try again.');
    }
  }

  const rowActions = (product: Product) => (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={(event) => setViewState({ product, trigger: event.currentTarget })}
        className="flex min-h-8 items-center rounded-ws-control px-2.5 text-[length:var(--text-ws-body)] font-medium text-subtle transition-colors hover:bg-canvas hover:text-ink"
      >
        View
      </button>
      {canWrite ? (
        <>
          {product.status !== 'archived' ? (
            <Link
              href={PRODUCT_ROUTES.edit(product.id)}
              className="flex min-h-8 items-center rounded-ws-control px-2.5 text-[length:var(--text-ws-body)] font-medium text-ink transition-colors hover:bg-primary-tint hover:text-primary"
            >
              Edit
            </Link>
          ) : null}
          <ProductRowMenu
            product={product}
            canUnpublish={capabilities.unpublish}
            canDelete={capabilities.remove}
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

  const statsLoading = capabilities.summaryEndpoint
    ? summary.isPending || (isLoading && !summary.data)
    : isLoading && !list.data;
  const totalCardValue = summary.data
    ? countFormat.format(summary.data.total)
    : !hasActiveFilters && meta
      ? countFormat.format(total)
      : '—';
  const searchLabel = capabilities.stock
    ? 'Search by product name or SKU'
    : 'Search by product name or category';

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-[length:var(--text-ws-page-title)] font-semibold text-ink">
            Products
          </h1>
          <p className="mt-1 text-[length:var(--text-ws-body)] text-subtle">
            Manage the products you list for retailers to discover.
          </p>
        </div>
        {canWrite && !apiUnavailable ? (
          <Link
            href={PRODUCT_ROUTES.new}
            className="inline-flex min-h-10 items-center gap-2 rounded-ws-control bg-primary px-4 text-[length:var(--text-ws-body)] font-semibold text-on-primary transition-colors hover:bg-primary-hover"
          >
            <DashboardIcon name="plus" className="size-4" />
            Add product
          </Link>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3" aria-busy={statsLoading}>
        <ProductStatCard
          label="Total products"
          value={totalCardValue}
          subline={
            summary.data
              ? `${countFormat.format(summary.data.published)} published · ${countFormat.format(summary.data.drafts)} drafts`
              : undefined
          }
          icon="products"
          isLoading={statsLoading}
        />
        <ProductStatCard
          label="Low stock"
          value={capabilities.stock ? countFormat.format(summary.data?.lowStock ?? 0) : '—'}
          subline={capabilities.stock ? undefined : 'Not tracked yet'}
          icon="alert"
          tone="orange"
          href={capabilities.stock ? '/dashboard/inventory?tab=low-stock' : undefined}
          isLoading={statsLoading}
        />
        <ProductStatCard
          label="Out of stock"
          value={capabilities.stock ? countFormat.format(summary.data?.outOfStock ?? 0) : '—'}
          subline={capabilities.stock ? undefined : 'Not tracked yet'}
          icon="box"
          tone="red"
          href={capabilities.stock ? '/dashboard/inventory?tab=out-of-stock' : undefined}
          isLoading={statsLoading}
        />
      </div>

      <section className="overflow-visible rounded-ws-card border border-line bg-surface shadow-ws-card">
        {/* Tabs + count pills */}
        <div
          className="flex flex-wrap items-center gap-1 border-b border-line px-4 pt-3 sm:px-5"
          role="tablist"
          aria-label="Product status"
        >
          {TABS.map((tab) => {
            const active = filters.tab === tab.id;
            const tabDisabled = tab.id !== 'all' && !capabilities.serverStatusAndCategoryFilters;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={tabDisabled}
                onClick={() => setFilters({ tab: tab.id })}
                className={cn(
                  'relative flex min-h-11 items-center gap-2 rounded-t-ws-control px-3 text-[length:var(--text-ws-body)] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  active ? 'font-semibold text-ink' : 'font-medium text-subtle hover:text-ink',
                )}
              >
                {tab.label}
                {counts[tab.id] !== undefined ? (
                  <span className="rounded-full bg-draft-tint px-2 py-0.5 text-[length:var(--text-ws-caption)] font-medium text-draft">
                    {countFormat.format(counts[tab.id]!)}
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

        {/* Search + Category / Stock dropdowns */}
        <div className="flex flex-col gap-3 border-b border-line px-4 py-4 sm:px-5 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <DashboardIcon
              name="search"
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-caption"
            />
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchLabel}
              aria-label={searchLabel}
              className="min-h-11 w-full rounded-ws-control border border-line bg-surface pl-10 pr-3.5 text-[length:var(--text-ws-body)] text-ink placeholder:text-caption focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 md:flex md:items-center">
            <Select
              id="products-filter-category"
              label="Category"
              hideLabel
              value={filters.category}
              disabled={!capabilities.serverStatusAndCategoryFilters}
              onChange={(event) => setFilters({ category: event.target.value })}
              wrapperClassName="md:w-48"
            >
              <option value="">Category: All</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>
                  Category: {category.name}
                </option>
              ))}
            </Select>
            <Select
              id="products-filter-stock"
              label="Stock"
              hideLabel
              value={filters.stock}
              disabled={!capabilities.stock}
              onChange={(event) =>
                setFilters({ stock: event.target.value as typeof filters.stock })
              }
              wrapperClassName="md:w-44"
            >
              <option value="all">Stock: All</option>
              <option value="in-stock">Stock: In stock</option>
              <option value="low-stock">Stock: Low stock</option>
              <option value="out-of-stock">Stock: Out of stock</option>
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
                    onClick={() => {
                      void list.refetch();
                      if (capabilities.summaryEndpoint) void summary.refetch();
                    }}
                    className="min-h-11 rounded-ws-control bg-primary px-6 text-[length:var(--text-ws-body)] font-semibold text-on-primary transition-colors hover:bg-primary-hover"
                  >
                    Retry
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
                description="Add your first product to list it for retailers to discover."
                className="min-h-[40vh] border-0"
                actions={
                  canWrite ? (
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
                    className="min-h-11 rounded-ws-control border border-line bg-surface px-6 text-[length:var(--text-ws-body)] font-semibold text-ink transition-colors hover:bg-canvas"
                  >
                    Clear filters
                  </button>
                }
              />
            </div>
          ) : (
            <>
              {/* Desktop/tablet table (md+). Scrolls inside the card when columns don't fit. */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-line bg-canvas text-left text-[length:var(--text-ws-caption)] font-medium text-subtle">
                      <th scope="col" className="px-5 py-3">
                        Product
                      </th>
                      <th scope="col" className="px-4 py-3">
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
                        className="h-[72px] border-b border-line last:border-b-0 hover:bg-canvas/60"
                      >
                        <td className="px-5 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <ProductThumb product={product} />
                            <div className="min-w-0">
                              <p className="truncate text-[length:var(--text-ws-body)] font-medium text-ink">
                                {product.name}
                              </p>
                              <p className="truncate text-[length:var(--text-ws-caption)] text-caption">
                                {product.sku}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-36 truncate px-4 py-3 text-[length:var(--text-ws-body)] text-subtle">
                          {resolveCategoryLabel(product.category)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[length:var(--text-ws-body)] font-medium text-ink">
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
                        <p className="truncate text-[length:var(--text-ws-body)] font-medium text-ink">
                          {product.name}
                        </p>
                        <p className="truncate text-[length:var(--text-ws-caption)] text-caption">
                          {product.sku}
                        </p>
                        <p className="mt-1 text-[length:var(--text-ws-body)] font-medium text-ink">
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

      {activeViewProduct ? (
        <ProductDetailsDialog
          key={activeViewProduct.id}
          open={viewState !== null}
          product={activeViewProduct}
          categoryLabel={resolveCategoryLabel(activeViewProduct.category)}
          returnFocusTo={viewState?.trigger ?? null}
          onClose={() => setViewState(null)}
        />
      ) : null}

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
