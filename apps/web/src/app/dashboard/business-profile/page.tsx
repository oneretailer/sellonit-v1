import type { Metadata } from 'next';
import { DashboardFrame } from '@/components/dashboard/DashboardFrame';
import { SupplierProfilePage } from '@/components/supplier/SupplierProfilePage';

export const metadata: Metadata = { title: 'Business profile' };

export default function SupplierBusinessProfileRoutePage() {
  return (
    <DashboardFrame>
      <SupplierProfilePage />
    </DashboardFrame>
  );
}
