'use client';

/**
 * Inventory list filter state synced to the URL (`tab`, `q`, `page`).
 * Changing `tab` or `q` resets `page` to 1. Search text is debounced ~300ms
 * before pushing to the URL so typing stays snappy.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PRODUCTS_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from '@/lib/inventory/constants';
import type {
  InventoryListParams,
  InventoryStatusParam,
  InventoryTab,
} from '@/lib/inventory/types';

export type InventoryFilters = {
  tab: InventoryTab;
  q: string;
  page: number;
};

function parseTab(search: URLSearchParams): InventoryTab {
  const raw = search.get('tab') ?? search.get('status');
  if (raw === 'low-stock' || raw === 'low') return 'low-stock';
  if (raw === 'out-of-stock' || raw === 'out') return 'out-of-stock';
  if (raw === 'in-stock' || raw === 'in') return 'in-stock';
  return 'all';
}

export function tabToStatusParam(tab: InventoryTab): InventoryStatusParam {
  switch (tab) {
    case 'low-stock':
      return 'low';
    case 'out-of-stock':
      return 'out';
    case 'in-stock':
      return 'in';
    case 'all':
      return 'all';
  }
}

function parseFilters(search: URLSearchParams): InventoryFilters {
  const page = Number.parseInt(search.get('page') ?? '1', 10);
  return {
    tab: parseTab(search),
    q: search.get('q') ?? '',
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

function toSearchParams(filters: InventoryFilters): URLSearchParams {
  const search = new URLSearchParams();
  if (filters.tab !== 'all') search.set('tab', filters.tab);
  if (filters.q.trim()) search.set('q', filters.q.trim());
  if (filters.page > 1) search.set('page', String(filters.page));
  return search;
}

export function useInventoryFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = searchParams.toString();
  const filters = useMemo(() => parseFilters(new URLSearchParams(urlKey)), [urlKey]);

  const [searchText, setSearchText] = useState(filters.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedQ = useRef(filters.q);

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
    (next: InventoryFilters) => {
      const query = toSearchParams(next).toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setFilters = useCallback(
    (changes: Partial<Omit<InventoryFilters, 'page'>> & { page?: number }) => {
      const next: InventoryFilters = { ...filters, ...changes };
      const pagingOnly =
        changes.page !== undefined && changes.tab === undefined && changes.q === undefined;
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

  const clearSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    lastPushedQ.current = '';
    setSearchText('');
    push({ tab: 'all', q: '', page: 1 });
  }, [push]);

  const statusParam = tabToStatusParam(filters.tab);
  const params = useMemo<InventoryListParams>(
    () => ({
      page: filters.page,
      pageSize: PRODUCTS_PAGE_SIZE,
      ...(filters.q.trim() ? { q: filters.q.trim() } : {}),
      ...(statusParam !== 'all' ? { status: statusParam } : {}),
    }),
    [filters.page, filters.q, statusParam],
  );

  const hasActiveFilters = filters.tab !== 'all' || filters.q.trim() !== '';

  return {
    filters,
    params,
    searchText,
    setSearch,
    setFilters,
    clearSearch,
    hasActiveFilters,
  };
}
