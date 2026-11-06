import { redirect } from 'next/navigation';

/** Legacy route: the products module now lives at /dashboard/products. */
export default function ProductsPage() {
  redirect('/dashboard/products');
}
