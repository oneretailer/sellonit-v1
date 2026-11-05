import type { Metadata } from 'next';
import { WorkspaceRoute } from '@/components/workspace/WorkspaceRoute';
import { ProductList } from '@/components/products/ProductList';
export const metadata: Metadata = { title: 'Products' };
export default function ProductsPage() { return <WorkspaceRoute permission="product:read" feature="product-catalogue"><ProductList /></WorkspaceRoute>; }
