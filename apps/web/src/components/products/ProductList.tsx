'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/AuthSessionProvider';
import { TextField } from '@/components/reuseable/TextField';
import { PrimaryLinkButton } from '@/components/reuseable/PrimaryButton';
import { EmptyState, ErrorState, LoadingState } from '@/components/workspace/StatePanel';
import { Pagination } from '@/components/workspace/Pagination';
import { StatusChip } from '@/components/workspace/StatusBanner';
import { formatNaira } from '@/lib/money';
import { listProducts } from '@/lib/workspace/productApi';
import { workspaceKeys } from '@/lib/workspace/queryKeys';
import type { ProductStatus } from '@/lib/workspace/types';

const CHIPS: readonly { label: string; value: ProductStatus | undefined }[] = [{ label: 'All', value: undefined }, { label: 'Draft', value: 'DRAFT' }, { label: 'Published', value: 'PUBLISHED' }, { label: 'Unpublished', value: 'UNPUBLISHED' }, { label: 'Archived', value: 'ARCHIVED' }];
export function ProductList() {
  const { workspace, can } = useSession(); const businessId = workspace?.activeBusiness?.id ?? '';
  const [search, setSearch] = useState(''); const [debouncedSearch, setDebouncedSearch] = useState(''); const [status, setStatus] = useState<ProductStatus>(); const [page, setPage] = useState(1);
  useEffect(() => { const timer = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const filters = { search: debouncedSearch, status, page, pageSize: 10 };
  const query = useQuery({ queryKey: workspaceKeys.productList(businessId, filters), queryFn: ({ signal }) => listProducts(filters, signal), enabled: !!businessId, placeholderData: keepPreviousData });
  const create = can('product:write') ? <PrimaryLinkButton href="/products/new" className="text-base">Create product</PrimaryLinkButton> : null;
  return <section>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-heading text-2xl font-semibold md:text-3xl">Products</h1><p className="mt-2 text-sm text-subtle">Manage your product details, pricing and catalogue visibility.</p></div>{query.data?.data.length ? <div className="w-full sm:w-auto">{create}</div> : null}</div>
    <div className="mb-5 max-w-xl"><TextField id="product-search" label="Search products" type="search" value={search} onChange={setSearch} placeholder="Search by name or SKU" /></div>
    <div role="group" aria-label="Filter by product status" className="mb-5 flex flex-wrap gap-2">{CHIPS.map((chip) => <button key={chip.label} type="button" aria-pressed={status === chip.value} onClick={() => { setStatus(chip.value); setPage(1); }} className={`min-h-11 rounded-full px-4 text-sm font-medium ${status === chip.value ? 'bg-primary text-ink' : 'bg-gray-50 text-subtle hover:bg-orange-50'}`}>{chip.label}</button>)}</div>
    <div aria-busy={query.isFetching}>
      {query.isPending ? <LoadingState label="Loading products" /> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : !query.data.data.length ? <EmptyState title={debouncedSearch || status ? 'No matching products' : 'No products yet'} description={debouncedSearch || status ? 'Try another search or status filter.' : 'Create your first product to start building your catalogue.'} action={!debouncedSearch && !status ? create : undefined} /> : <>
        <ul className="space-y-3 md:hidden">{query.data.data.map((product) => <li key={product.id} className="rounded-2xl border border-line p-4"><Link href={`/products/${product.id}`} className="font-semibold underline decoration-primary underline-offset-4">{product.name}</Link><p className="mt-1 text-xs text-subtle">{product.defaultVariant.sku}</p><div className="mt-3 flex items-center justify-between gap-3"><StatusChip status={product.status} /><span className="text-sm font-semibold">{formatNaira(product.defaultVariant.basePriceKobo)}</span></div></li>)}</ul>
        <div className="hidden overflow-x-auto rounded-2xl border border-line md:block"><table className="w-full text-left text-sm"><caption className="sr-only">Supplier products</caption><thead className="bg-gray-50 text-xs text-subtle"><tr>{['Product', 'SKU', 'Status', 'Base price', 'Action'].map((label) => <th key={label} scope="col" className="px-4 py-4 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-line">{query.data.data.map((product) => <tr key={product.id} className="hover:bg-orange-50/30"><td className="px-4 py-4 font-medium">{product.name}<span className="mt-1 block text-xs font-normal text-subtle">{product.category}</span></td><td className="px-4 py-4 text-subtle">{product.defaultVariant.sku}</td><td className="px-4 py-4"><StatusChip status={product.status} /></td><td className="whitespace-nowrap px-4 py-4 font-medium">{formatNaira(product.defaultVariant.basePriceKobo)}</td><td className="px-4 py-4"><Link href={`/products/${product.id}`} className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4">{can('product:write') && product.status !== 'ARCHIVED' ? 'Edit' : 'View'}</Link></td></tr>)}</tbody></table></div>
        <Pagination meta={query.data.meta} onPageChange={setPage} disabled={query.isFetching} />
      </>}
    </div>
  </section>;
}
