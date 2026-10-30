import type { Metadata } from 'next';
import { NotFoundPage } from '@/components/errors/NotFoundPage';

export const metadata: Metadata = {
  title: 'Workspace not available',
  description: 'Only the supplier workspace is available on Sellonit today.',
};

/**
 * Dashboard 404. Retailer and Entrepreneur accounts are onboarded (their
 * choice is stored on the account) but their workspace does not exist yet, so
 * the dashboard route calls `notFound()` and this boundary renders.
 */
export default function DashboardNotFound() {
  return (
    <NotFoundPage
      title="This workspace isn't available yet"
      description="We couldn't find this dashboard. Retailer and Entrepreneur workspaces are still being built."
      note="For now, only the Supplier dashboard is available on Sellonit."
    />
  );
}
