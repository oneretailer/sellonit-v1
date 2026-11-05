import type { Metadata } from 'next';
import { DashboardFrame } from '@/components/dashboard/DashboardFrame';
import { ProductFormPage } from '@/components/products/ProductFormPage';

export const metadata: Metadata = { title: 'Edit product' };

export default async function EditSupplierProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DashboardFrame permission="product:write">
      <ProductFormPage productId={id} />
    </DashboardFrame>
  );
}
