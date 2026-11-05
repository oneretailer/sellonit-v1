'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { TextField } from '@/components/reuseable/TextField';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { InlineError } from '@/components/reuseable/InlineError';
import { pillFieldClass, pillInputClass } from '@/components/reuseable/fieldStyles';
import { useSession } from '@/lib/auth/AuthSessionProvider';
import { ApiError } from '@/lib/api-client';
import { nairaToKobo } from '@/lib/money';
import { createProduct, newIdempotencyKey, setPricingRule, updateProduct } from '@/lib/workspace/productApi';
import { markupRequestBody, productFormSchema, productFormValues, productRequestBody, type ProductFormValues } from '@/lib/workspace/productValidation';
import { pricePreview } from '@/lib/workspace/pricePreview';
import { presentError } from '@/lib/workspace/errors';
import { workspaceKeys } from '@/lib/workspace/queryKeys';
import type { Product } from '@/lib/workspace/types';
import { useToast } from '@/components/workspace/ToastProvider';
import { PublishControls } from './PublishControls';

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter(); const notify = useToast(); const queryClient = useQueryClient();
  const { workspace, can, refreshWorkspace, refreshSession } = useSession(); const businessId = workspace?.activeBusiness?.id ?? '';
  const form = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: productFormValues(product), mode: 'onBlur', reValidateMode: 'onBlur', disabled: product?.status === 'ARCHIVED' });
  const { register, control, handleSubmit, setError, clearErrors, formState: { errors, isSubmitting } } = form;
  const values = useWatch({ control });
  const idempotencyKey = useRef<string | null>(null);
  const createdProduct = useRef<Product | null>(product ?? null);
  const [serverError, setServerError] = useState<string | null>(null);
  const editable = can('product:write') && product?.status !== 'ARCHIVED';
  const canSetPricing = can('pricing:set');
  let preview: string | null = null;
  try { if (values.basePriceNaira !== undefined) preview = pricePreview(nairaToKobo(values.basePriceNaira), values.hasMaximumMarkup ? nairaToKobo(values.maxMarkupNaira ?? '') : null).label; } catch { preview = 'Enter a valid base price and markup to preview the retailer price range.'; }
  async function save(input: ProductFormValues) {
    if (!editable || isSubmitting) return;
    setServerError(null); clearErrors();
    try {
      idempotencyKey.current ??= newIdempotencyKey();
      let saved = createdProduct.current;
      if (!saved) { saved = await createProduct(productRequestBody(input), idempotencyKey.current); createdProduct.current = saved; }
      else saved = await updateProduct(saved.id, productRequestBody(input));
      // A pricing failure must not resubmit POST. Retry edits the already-created product.
      if (canSetPricing) saved = await setPricingRule(saved.id, markupRequestBody(input));
      createdProduct.current = saved;
      queryClient.setQueryData(workspaceKeys.product(businessId, saved.id), saved);
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.products(businessId) });
      notify(product ? 'Product updated.' : 'Product created.');
      router.replace(`/products/${saved.id}`);
    } catch (error) {
      const presentation = presentError(error);
      if (error instanceof ApiError) {
        if (error.status === 401) await refreshSession();
        if (error.code === 'SUPPLIER_NOT_APPROVED') await refreshWorkspace();
        if (error.code === 'INVALID_STATE_TRANSITION' && createdProduct.current) {
          await queryClient.invalidateQueries({ queryKey: workspaceKeys.product(businessId, createdProduct.current.id) });
        }
        const fieldMap: Record<string, keyof ProductFormValues> = { name: 'name', description: 'description', category: 'category', 'defaultVariant.sku': 'sku', 'defaultVariant.basePriceKobo': 'basePriceNaira', maxMarkupKobo: 'maxMarkupNaira' };
        for (const [path, message] of Object.entries(error.fields ?? {})) { const field = fieldMap[path]; if (field) setError(field, { type: 'server', message }); }
      }
      setServerError(createdProduct.current && !product ? `Product was created, but a later save failed. Retry will edit that product, not create another. ${presentation.message}` : presentation.message);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) { void handleSubmit(save)(event); }
  return <section className="max-w-3xl">
    <h1 className="font-heading text-2xl font-semibold md:text-3xl">{product ? product.status === 'ARCHIVED' ? 'Archived product' : 'Edit product' : 'Create product'}</h1>
    <p className="mt-2 text-sm text-subtle">One default variant. Prices are stored in whole kobo; no stock information is collected here.</p>
    {product ? <div className="mt-5"><PublishControls product={product} /></div> : null}
    {product?.status === 'ARCHIVED' ? <p role="status" className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-subtle">Archived products are read-only.</p> : !editable ? <p role="status" className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-subtle">You can view this product, but your membership does not allow edits.</p> : null}
    <form onSubmit={submit} noValidate className="mt-7 space-y-6">
      <Controller name="name" control={control} render={({ field }) => <TextField disabled={!editable || isSubmitting} id="product-name" label="Product name" {...field} error={errors.name?.message} maxLength={200} autoComplete="off" />} />
      <div className="space-y-2"><label htmlFor="product-description" className="text-sm font-medium sm:text-lg">Description</label><div className={pillFieldClass(!!errors.description, !editable)}><textarea id="product-description" {...register('description')} rows={4} maxLength={5000} aria-invalid={!!errors.description} aria-describedby={errors.description ? 'description-error' : undefined} className={`${pillInputClass} min-h-28 resize-y py-3`} /></div>{errors.description ? <InlineError id="description-error">{errors.description.message}</InlineError> : null}</div>
      <Controller name="category" control={control} render={({ field }) => <TextField disabled={!editable || isSubmitting} id="product-category" label="Category" {...field} error={errors.category?.message} maxLength={120} helper="For example, Clothing or Home goods." />} />
      <Controller name="sku" control={control} render={({ field }) => <TextField disabled={!editable || isSubmitting} id="product-sku" label="SKU" {...field} error={errors.sku?.message} maxLength={100} autoComplete="off" helper="A unique identifier within your business." />} />
      <Controller name="basePriceNaira" control={control} render={({ field }) => <TextField disabled={!editable || isSubmitting} id="product-base-price" label="Base price (₦)" {...field} error={errors.basePriceNaira?.message} inputMode="decimal" placeholder="0.00" helper="Greater than zero; up to two decimal places." />} />
      {canSetPricing ? <fieldset disabled={!editable || isSubmitting} className="space-y-5 rounded-2xl border border-line p-5"><legend className="px-2 font-heading text-lg font-semibold">Retailer pricing</legend>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium"><input type="checkbox" role="switch" {...register('hasMaximumMarkup')} className="size-5 accent-primary" aria-controls="maximum-markup-fields" />Set a maximum markup</label>
        {values.hasMaximumMarkup ? <div id="maximum-markup-fields"><Controller name="maxMarkupNaira" control={control} render={({ field }) => <TextField disabled={!editable || isSubmitting} id="product-max-markup" label="Maximum markup (₦)" {...field} error={errors.maxMarkupNaira?.message} inputMode="decimal" helper="₦0 fixes the retailer price to the base price." />} /></div> : <div id="maximum-markup-fields" />}
        <p role="status" aria-live="polite" className="rounded-xl bg-orange-50 p-4 text-sm leading-6">{preview}</p>
      </fieldset> : null}
      {serverError ? <InlineError>{serverError}</InlineError> : null}
      {editable ? <PrimaryButton type="submit" shape="rounded" loading={isSubmitting} disabled={isSubmitting} className="text-base">{isSubmitting ? 'Saving…' : product ? 'Save changes' : 'Create product'}</PrimaryButton> : null}
    </form>
  </section>;
}
