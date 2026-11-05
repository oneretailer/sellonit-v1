'use client';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/AuthSessionProvider';
import { getProduct } from '@/lib/workspace/productApi';
import { workspaceKeys } from '@/lib/workspace/queryKeys';
import { ErrorState, LoadingState } from '@/components/workspace/StatePanel';
import { ProductForm } from './ProductForm';

export function ProductEditor({ id }: { id: string }) {
  const { workspace } = useSession(); const businessId = workspace?.activeBusiness?.id ?? '';
  const query = useQuery({ queryKey: workspaceKeys.product(businessId, id), queryFn: ({ signal }) => getProduct(id, signal), enabled: !!businessId });
  if (query.isPending) return <LoadingState label="Loading product" />;
  if (query.isError) return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  return <ProductForm key={`${query.data.id}-${query.data.updatedAt}`} product={query.data} />;
}
