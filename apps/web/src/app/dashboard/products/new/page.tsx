import type { Metadata } from 'next';
import { DashboardFrame } from '@/components/dashboard/DashboardFrame';
import { ProductFormPage } from '@/components/products/ProductFormPage';

export const metadata: Metadata = { title: 'Add product' };

export default function NewSupplierProductPage() {
  return (
    <DashboardFrame permission="product:write">
      <ProductFormPage />
    </DashboardFrame>
  );
}
