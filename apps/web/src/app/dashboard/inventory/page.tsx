import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DashboardFrame } from '@/components/dashboard/DashboardFrame';
import { InventoryPage } from '@/components/inventory/InventoryPage';
import { ProductsTableSkeleton } from '@/components/products/ProductsTableSkeleton';

export const metadata: Metadata = { title: 'Inventory' };

export default function SupplierInventoryRoutePage() {
  return (
    <DashboardFrame permission="inventory:read">
      <Suspense
        fallback={
          <div aria-busy="true" className="rounded-2xl border border-line bg-white">
            <ProductsTableSkeleton rows={7} />
          </div>
        }
      >
        <InventoryPage />
      </Suspense>
    </DashboardFrame>
  );
}
