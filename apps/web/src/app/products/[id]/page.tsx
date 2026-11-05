import { redirect } from 'next/navigation';

/** Legacy route: the products module now lives at /dashboard/products. */
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/dashboard/products/${id}/edit`);
}
