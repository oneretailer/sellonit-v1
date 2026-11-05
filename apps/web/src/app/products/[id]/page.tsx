import type { Metadata } from 'next';
import { WorkspaceRoute } from '@/components/workspace/WorkspaceRoute';
import { ProductEditor } from '@/components/products/ProductEditor';
export const metadata: Metadata = { title: 'Edit product' };
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <WorkspaceRoute permission="product:read" feature="product-catalogue"><ProductEditor id={id} /></WorkspaceRoute>; }
