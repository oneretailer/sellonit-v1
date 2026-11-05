import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DashboardFrame } from '@/components/dashboard/DashboardFrame';
import { ProductsListPage } from '@/components/products/ProductsListPage';
import { ProductsTableSkeleton } from '@/components/products/ProductsTableSkeleton';

export const metadata: Metadata = { title: 'Products' };

export default function SupplierProductsPage() {
  return (
    <DashboardFrame permission="product:read">
      <Suspense fallback={<div aria-busy="true" className="rounded-2xl border border-line bg-white"><ProductsTableSkeleton /></div>}>
        <ProductsListPage />
      </Suspense>
    </DashboardFrame>
  );
}
