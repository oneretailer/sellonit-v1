'use client';
import { useState } from 'react';

import { getProduct } from '@/lib/workspace/productApi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/AuthSessionProvider';
import { SecondaryButton } from '@/components/reuseable/SecondaryButton';
import { ConfirmDialog } from '@/components/workspace/ConfirmDialog';
import { StatusChip } from '@/components/workspace/StatusBanner';
import { useToast } from '@/components/workspace/ToastProvider';
import { publishProduct } from '@/lib/workspace/productApi';
import { publishAvailability } from '@/lib/workspace/publishState';
import { presentError } from '@/lib/workspace/errors';
import { workspaceKeys } from '@/lib/workspace/queryKeys';
import type { Product } from '@/lib/workspace/types';

export function PublishControls({ product: initialProduct }: { product: Product }) {
  const { can, workspace, refreshWorkspace, refreshSession } = useSession(); const queryClient = useQueryClient(); const notify = useToast();

  const [open, setOpen] = useState(false);
  // Read the shared detail cache so a publish mutation immediately updates this chip/date.
  const cached = useQuery<Product>({ queryKey: workspaceKeys.product(initialProduct.businessId, initialProduct.id), queryFn: ({ signal }) => getProduct(initialProduct.id, signal), initialData: initialProduct, staleTime: 30_000 });
  const product = cached.data;
  const availability = publishAvailability(can('product:publish'), workspace?.supplierStatus ?? null, product.status);
  const mutation = useMutation({
    mutationFn: async () => { if (!availability.action) throw new Error('Publishing is unavailable.'); return publishProduct(product.id, availability.action); },
    onSuccess: async (updated) => { queryClient.setQueryData(workspaceKeys.product(product.businessId, product.id), updated); await queryClient.invalidateQueries({ queryKey: workspaceKeys.products(product.businessId) }); setOpen(false); notify(updated.status === 'PUBLISHED' ? 'Product published.' : 'Product unpublished.'); },
    onError: async (error) => {
      const presented = presentError(error);
      if (presented.kind === 'auth') await refreshSession();
      if ((error as { code?: string }).code === 'SUPPLIER_NOT_APPROVED') { await refreshWorkspace(); setOpen(false); notify(presented.message, 'error'); }
      if (presented.kind === 'conflict') { await queryClient.invalidateQueries({ queryKey: workspaceKeys.product(product.businessId, product.id) }); setOpen(false); notify(presented.message, 'error'); }
    },
  });
  return <div className="rounded-2xl border border-line p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><StatusChip status={product.status} /><p className="mt-2 text-xs text-subtle">{product.publishedAt ? `Published ${new Date(product.publishedAt).toLocaleString('en-NG')}` : 'Not published yet'}</p></div>
      {availability.visible ? <span tabIndex={availability.enabled ? -1 : 0} title={availability.reason} aria-describedby={`publish-reason-${product.id}`} className="inline-block"><SecondaryButton shape="rounded" appearance="outline" className="w-auto px-5 text-sm" disabled={!availability.enabled || mutation.isPending} onClick={() => { mutation.reset(); setOpen(true); }}>{availability.action === 'unpublish' ? 'Unpublish product' : 'Publish product'}</SecondaryButton></span> : null}
    </div><p id={`publish-reason-${product.id}`} className="mt-3 text-xs text-subtle">{availability.reason}</p>
    {mutation.isError && !['conflict', 'access'].includes(presentError(mutation.error).kind) ? <p role="alert" className="mt-3 text-sm text-danger">{presentError(mutation.error).message}</p> : null}
    <ConfirmDialog open={open} title={availability.action === 'unpublish' ? 'Unpublish this product?' : 'Publish this product?'} description={availability.action === 'unpublish' ? 'Retailers will no longer see this product in your catalogue. You can publish it again later.' : 'This makes the product available to retailers at its current base price and markup rule.'} confirmLabel={availability.action === 'unpublish' ? 'Unpublish' : 'Publish'} pending={mutation.isPending} error={mutation.isError ? presentError(mutation.error).message : null} onClose={() => setOpen(false)} onConfirm={() => mutation.mutate()} />
  </div>;
}
