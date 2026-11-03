import type { Metadata } from 'next';
import { SupplierSetupRoute } from '@/components/dashboard/SupplierSetupRoute';

export const metadata: Metadata = {
  title: 'Supplier setup',
  description: 'Complete your supplier business setup on Sellonit.',
};

/** Direct, refresh-safe route for the Supplier Setup screen (also opened by the
 * dashboard progress widget). The static segment wins over the dashboard
 * catch-all, so this renders the setup screen instead of a placeholder. */
export default function SupplierSetupPage() {
  return <SupplierSetupRoute />;
}
