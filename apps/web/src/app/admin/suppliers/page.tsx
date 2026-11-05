import type { Metadata } from 'next';
import { WorkspaceRoute } from '@/components/workspace/WorkspaceRoute';
import { SupplierQueue } from '@/components/admin/SupplierQueue';
export const metadata: Metadata = { title: 'Supplier review' };
export default function SupplierQueuePage() { return <WorkspaceRoute admin><SupplierQueue /></WorkspaceRoute>; }
