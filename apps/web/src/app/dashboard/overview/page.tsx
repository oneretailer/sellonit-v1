import type { Metadata } from 'next';
import { DashboardRoute } from '@/components/dashboard/DashboardRoute';

export const metadata: Metadata = {
  title: 'Supplier overview',
  description: 'Your supplier workspace overview.',
};

export default function SupplierOverviewPage() {
  return <DashboardRoute mode="overview" />;
}
