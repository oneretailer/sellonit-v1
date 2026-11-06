import type { Metadata } from 'next';
import { WorkspaceRoute } from '@/components/workspace/WorkspaceRoute';
import { SupplierReview } from '@/components/admin/SupplierReview';
export const metadata: Metadata = { title: 'Review supplier' };
export default async function SupplierReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <WorkspaceRoute admin>
      <SupplierReview id={id} />
    </WorkspaceRoute>
  );
}
