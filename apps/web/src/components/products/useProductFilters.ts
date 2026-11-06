'use client';

/**
 * Products list filter state, synced to the URL (tab, q, category, stock,
 * page). Any filter change resets page to 1. Search text is debounced ~300ms
 * before it reaches the URL/query; the input itself stays responsive.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PRODUCTS_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '@/lib/products/constants';
import type { ProductListParams, ProductStatus, StockFilter } from '@/lib/products/types';

export type ProductsTab = 'all' | ProductStatus;

export type ProductFilters = {
  tab: ProductsTab;
  q: string;
  category: string;
  stock: StockFilter;
  page: number;
};

const STOCK_VALUES: readonly StockFilter[] = ['all', 'in-stock', 'low-stock', 'out-of-stock'];

function parseFilters(search: URLSearchParams): ProductFilters {
  const status = search.get('status');
  const stock = search.get('stock');
  const page = Number.parseInt(search.get('page') ?? '1', 10);
  return {
    tab: status === 'published' || status === 'draft' ? status : 'all',
    q: search.get('q') ?? '',
    category: search.get('category') ?? '',
    stock:
      stock && (STOCK_VALUES as readonly string[]).includes(stock) ? (stock as StockFilter) : 'all',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function toSearchParams(filters: ProductFilters): URLSearchParams {
  const search = new URLSearchParams();
  if (filters.tab !== 'all') search.set('status', filters.tab);
  if (filters.q.trim()) search.set('q', filters.q.trim());
  if (filters.category) search.set('category', filters.category);
  if (filters.stock !== 'all') search.set('stock', filters.stock);
  if (filters.page > 1) search.set('page', String(filters.page));
  return search;
}

export function useProductFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(urlKey)), [urlKey]);

  // Local search box value; debounced into the URL.
  const [searchText, setSearchText] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedQ = useRef(filters.q);

  // Back/forward or external navigation updates the box (unless mid-typing).
  useEffect(() => {
    if (filters.q !== lastPushedQ.current) {
      lastPushedQ.current = filters.q;
      setSearchText(filters.q);
    }
  }, [filters.q]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const push = useCallback(
    (next: ProductFilters) => {
      const query = toSearchParams(next).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setFilters = useCallback(
    (changes: Partial<Omit<ProductFilters, 'page'>> & { page?: number }) => {
      const next: ProductFilters = { ...filters, ...changes };
      // Any filter change (other than paging itself) resets to page 1.
      const pagingOnly =
        changes.page !== undefined &&
        changes.tab === undefined &&
        changes.q === undefined &&
        changes.category === undefined &&
        changes.stock === undefined;
      if (!pagingOnly) next.page = 1;
      if (changes.q !== undefined) {
        lastPushedQ.current = changes.q.trim();
        setSearchText(changes.q);
      }
      push(next);
    },
    [filters, push],
  );

  const setSearch = useCallback(
    (text: string) => {
      setSearchText(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        lastPushedQ.current = text.trim();
        push({ ...filters, q: text, page: 1 });
      }, SEARCH_DEBOUNCE_MS);
    },
    [filters, push],
  );

  const clearFilters = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    lastPushedQ.current = '';
    setSearchText('');
    push({ tab: 'all', q: '', category: '', stock: 'all', page: 1 });
  }, [push]);

  const params = useMemo<ProductListParams>(
    () => ({
      page: filters.page,
      pageSize: PRODUCTS_PAGE_SIZE,
      ...(filters.tab !== 'all' ? { status: filters.tab } : {}),
      ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
      ...(filters.category ? { category: filters.category } : {}),
      ...(filters.stock !== 'all' ? { stock: filters.stock } : {}),
    }),
    [filters],
  );

  const hasActiveFilters =
    filters.tab !== 'all' ||
    filters.q.trim() !== '' ||
    filters.category !== '' ||
    filters.stock !== 'all';

  return { filters, params, searchText, setSearch, setFilters, clearFilters, hasActiveFilters };
}
