import type { Metadata } from 'next';
import { WorkspaceRoute } from '@/components/workspace/WorkspaceRoute';
import { ProductForm } from '@/components/products/ProductForm';
export const metadata: Metadata = { title: 'Create product' };
export default function NewProductPage() { return <WorkspaceRoute permission="product:write" feature="product-catalogue"><ProductForm /></WorkspaceRoute>; }
