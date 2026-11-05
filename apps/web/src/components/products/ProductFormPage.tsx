'use client';

/**
 * Add/Edit product form (/dashboard/products/new and /:id/edit).
 *
 * - React Hook Form holds the raw text values (price stays decimal naira text;
 *   conversion to kobo happens once, in productInputFromValues).
 * - Publish validates every field + ≥1 photo, shows the dismissible
 *   "Product not published" alert, focuses the first invalid field, then asks
 *   for confirmation. Save draft only needs a name (assumption) and redirects
 *   with a "Draft saved" toast (assumption D).
 * - Dirty state registers the shared NavigationGuard (sidebar/breadcrumb/
 *   Cancel/switch-business all confirm) and a beforeunload listener.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { DashboardIcon } from '@/components/dashboard/icons';
import { Input, Select, Textarea } from '@/components/workspace/Field';
import { Dialog, dialogPrimaryClass, dialogSecondaryClass } from '@/components/workspace/Dialog';
import { StatePanel } from '@/components/workspace/StatePanel';
import { useNavigationGuard } from '@/components/workspace/NavigationGuard';
import { useToast } from '@/components/workspace/ToastProvider';
import { Spinner } from '@/components/reuseable/Spinner';
import { cn } from '@/lib/cn';
import { formatNaira, koboToNaira, nairaToKobo } from '@/lib/money';
import { ApiError, isEndpointNotImplemented } from '@/lib/api-client';
import {
  useCreateProduct,
  useInvalidateProducts,
  useProduct,
  useProductCategories,
  useUpdateProduct,
} from '@/lib/products/queries';
import { productsApi } from '@/lib/products/productsApi';
import { PRODUCT_ROUTES } from '@/lib/products/constants';
import {
  EMPTY_PRODUCT_VALUES,
  PRODUCT_FIELD_ORDER,
  productInputFromValues,
  serverFieldErrors,
  validateProduct,
  type ProductFieldErrors,
  type ProductFormIntent,
  type ProductFormValues,
} from '@/lib/products/validation';
import type { Product } from '@/lib/products/types';
import { ProductImageUploader, type UploaderImage } from './ProductImageUploader';
import { ProductStatusPill, StockText } from './ProductStatusPill';

/** Price control: raw decimal text while focused, formatted ₦ on blur. */
function PriceInput({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (text: string) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  let display = value;
  if (!focused && value.trim()) {
    try { display = formatNaira(nairaToKobo(value.trim())).replace(/^₦/, ''); } catch { display = value; }
  }
  return (
    <Input
      id="product-wholesalePrice"
      label="Wholesale price"
      required
      prefix="₦"
      inputMode="decimal"
      placeholder="0.00"
      value={display}
      error={error}
      disabled={disabled}
      helper="The price retailers pay per unit. You can include decimals."
      onChange={(event) => onChange(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div>
        <h2 className="font-heading text-lg font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-sm text-subtle">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ProductPreview({ values, images, status }: { values: ProductFormValues; images: UploaderImage[]; status: 'draft' | 'published' }) {
  const main = images.find((image) => image.status === 'uploaded');
  let price = '₦—';
  if (values.wholesalePrice.trim()) {
    try { price = formatNaira(nairaToKobo(values.wholesalePrice.trim())); } catch { price = '₦—'; }
  }
  const stock = /^\d+$/.test(values.stockQuantity.trim()) ? Number.parseInt(values.stockQuantity.trim(), 10) : null;
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">Preview</h2>
      <p className="mt-1 text-xs text-subtle">How your product will appear to retailers.</p>
      <div className="mt-4 overflow-hidden rounded-xl border border-line">
        <div className="flex aspect-[4/3] items-center justify-center bg-canvas">
          {main ? (
            // eslint-disable-next-line @next/next/no-img-element -- live preview of an uploaded photo.
            <img src={main.url} alt="" className="size-full object-cover" />
          ) : (
            <span aria-hidden="true" className="flex flex-col items-center gap-2 text-subtle">
              <DashboardIcon name="image" className="size-8" />
              <span className="text-xs">Product photo</span>
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 p-4">
          <p className={cn('truncate text-sm font-medium', values.name.trim() ? 'text-ink' : 'text-subtle/60')}>{values.name.trim() || 'Product name'}</p>
          <p className="truncate text-xs text-subtle">
            {values.category.trim() || 'Category'}{values.sku.trim() ? ` · ${values.sku.trim()}` : ''}
          </p>
          <p className="text-base font-semibold text-ink">{price}</p>
          {stock !== null ? <StockText quantity={stock} /> : <span className="text-xs text-subtle">Stock quantity</span>}
          <div className="mt-1"><ProductStatusPill status={status} /></div>
        </div>
      </div>
    </section>
  );
}

function valuesFromProduct(product: Product): ProductFormValues {
  return {
    name: product.name,
    description: product.description,
    category: product.category,
    sku: product.sku,
    wholesalePrice: product.wholesalePrice > 0 ? koboToNaira(product.wholesalePrice) : '',
    stockQuantity: String(product.stockQuantity),
  };
}

function imagesFromProduct(product: Product): UploaderImage[] {
  return product.images.map((image) => ({ id: image.id, url: image.url, status: 'uploaded', progress: 100 }));
}

export function ProductFormPage({ productId }: { productId?: string }) {
  const router = useRouter();
  const notify = useToast();
  const guard = useNavigationGuard();
  const isEdit = productId !== undefined;
  const productQuery = useProduct(productId ?? null);
  const product = isEdit ? productQuery.data : undefined;

  if (isEdit && productQuery.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-6">
        <span className="block h-8 w-48 animate-pulse rounded-xl bg-gray-100" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,22.5rem)]">
          <div className="flex flex-col gap-6">
            <span className="block h-56 animate-pulse rounded-2xl bg-gray-100" />
            <span className="block h-80 animate-pulse rounded-2xl bg-gray-100" />
          </div>
          <span className="hidden h-96 animate-pulse rounded-2xl bg-gray-100 xl:block" />
        </div>
      </div>
    );
  }
  if (isEdit && productQuery.isError) {
    // TODO(BE-002): distinguish unmounted product API routes from a deleted product record.
    if (isEndpointNotImplemented(productQuery.error)) {
      return (
        <StatePanel
          icon="products"
          tone="cream"
          title="Product catalogue is coming soon"
          description="Editing products is not available on the server yet."
          actions={
            <button type="button" onClick={() => router.push(PRODUCT_ROUTES.list)} className="min-h-11 rounded-xl border border-line bg-white px-6 text-sm font-semibold text-ink transition-colors hover:bg-gray-50">Back to products</button>
          }
        />
      );
    }
    const notFound = productQuery.error instanceof ApiError && productQuery.error.status === 404;
    return (
      <StatePanel
        icon={notFound ? 'products' : 'wifi-off'}
        tone="gray"
        title={notFound ? 'Product not found' : "We couldn't load this product"}
        description={notFound ? 'It may have been deleted, or it belongs to another business.' : 'Check your connection and try again.'}
        actions={<>
          <button type="button" onClick={() => router.push(PRODUCT_ROUTES.list)} className="min-h-11 rounded-xl border border-line bg-white px-6 text-sm font-semibold text-ink transition-colors hover:bg-gray-50">Back to products</button>
          {!notFound ? <button type="button" onClick={() => void productQuery.refetch()} className="min-h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover">Try again</button> : null}
        </>}
      />
    );
  }
  return <ProductForm key={product?.id ?? 'new'} product={product} guard={guard} router={router} notify={notify} />;
}

function ProductForm({
  product,
  guard,
  router,
  notify,
}: {
  product?: Product;
  guard: ReturnType<typeof useNavigationGuard>;
  router: ReturnType<typeof useRouter>;
  notify: ReturnType<typeof useToast>;
}) {
  const isEdit = product !== undefined;
  const initialValues = useMemo(() => product ? valuesFromProduct(product) : EMPTY_PRODUCT_VALUES, [product]);
  const initialImages = useMemo(() => product ? imagesFromProduct(product) : [], [product]);
  const initialImageIds = useMemo(() => new Set(initialImages.map((image) => image.id)), [initialImages]);

  const { register, control, reset, getValues, setValue, setError, clearErrors, formState } = useForm<ProductFormValues>({
    defaultValues: initialValues,
  });
  const watched = useWatch({ control });
  const values: ProductFormValues = { ...EMPTY_PRODUCT_VALUES, ...watched };
  const [images, setImages] = useState<UploaderImage[]>(initialImages);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [alertCount, setAlertCount] = useState<number | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successName, setSuccessName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<ProductFormIntent | null>(null);
  const attemptedIntent = useRef<ProductFormIntent | null>(null);
  const savedIdRef = useRef<string | null>(product?.id ?? null);
  const imagesRef = useRef(images);
  useEffect(() => { imagesRef.current = images; }, [images]);

  const categories = useProductCategories();
  const catalogueUnavailable = categories.isError && isEndpointNotImplemented(categories.error);
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const invalidate = useInvalidateProducts();

  const uploadedImages = images.filter((image) => image.status === 'uploaded');
  const uploading = images.some((image) => image.status === 'uploading');
  const busy = submitting !== null;
  const formDisabled = busy || catalogueUnavailable;
  const alreadyPublished = product?.status === 'published';

  const isDirty = formState.isDirty || images.length !== initialImages.length
    || images.some((image, index) => initialImages[index]?.id !== image.id);

  // ---- Unsaved-changes guard + beforeunload -------------------------------
  const discardCleanup = useCallback(async () => {
    // Best-effort: delete photos uploaded in this unsaved session.
    const orphanIds = imagesRef.current
      .filter((image) => image.status === 'uploaded' && !initialImageIds.has(image.id))
      .map((image) => image.id);
    await Promise.allSettled(orphanIds.map((id) => productsApi.deleteImage(id)));
  }, [initialImageIds]);

  useEffect(() => {
    guard.registerGuard(isDirty ? { isDirty: true, onDiscard: discardCleanup } : null);
    return () => guard.registerGuard(null);
  }, [guard, isDirty, discardCleanup]);

  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // ---- Validation ---------------------------------------------------------
  const fieldError = (field: keyof ProductFormValues | 'images'): string | undefined =>
    field === 'images'
      ? (imagesError ?? undefined)
      : formState.errors[field]?.message;

  const applyErrors = useCallback((errors: ProductFieldErrors) => {
    clearErrors();
    setImagesError(errors.images ?? null);
    for (const [field, message] of Object.entries(errors)) {
      if (field === 'images') continue;
      setError(field as keyof ProductFormValues, { type: 'manual', message });
    }
    const count = Object.keys(errors).length;
    setAlertCount(count > 0 ? count : null);
  }, [clearErrors, setError]);

  // After a failed attempt, errors clear as fields become valid. Keyed on the
  // serialized values so a new watched-object identity alone can't loop.
  const valuesKey = JSON.stringify(values);
  const imagesKey = images.map((image) => `${image.id}:${image.status}`).join('|');
  useEffect(() => {
    if (attemptedIntent.current === null) return;
    const errors = validateProduct(getValues(), imagesRef.current.filter((image) => image.status === 'uploaded').length, attemptedIntent.current);
    applyErrors(errors);
  }, [valuesKey, imagesKey, applyErrors, getValues]);

  function focusFirstInvalid(errors: ProductFieldErrors) {
    const first = PRODUCT_FIELD_ORDER.find((field) => errors[field]);
    if (!first) return;
    const element = document.getElementById(first === 'images' ? 'product-photos' : `product-${first}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.focus({ preventScroll: true });
  }

  // ---- Submit flows ---------------------------------------------------------
  function buildInput() {
    return productInputFromValues(getValues(), imagesRef.current.filter((image) => image.status === 'uploaded').map((image) => image.id));
  }

  async function saveProduct(): Promise<Product> {
    const input = buildInput();
    if (savedIdRef.current) {
      const saved = await update.mutateAsync({ id: savedIdRef.current, input });
      return saved;
    }
    const saved = await create.mutateAsync(input);
    savedIdRef.current = saved.id;
    return saved;
  }

  function handleSave(intent: ProductFormIntent) {
    if (formDisabled || uploading) return;
    setAlertMessage(null);
    const errors = validateProduct(getValues(), uploadedImages.length, intent);
    if (Object.keys(errors).length > 0) {
      attemptedIntent.current = intent;
      applyErrors(errors);
      focusFirstInvalid(errors);
      return;
    }
    attemptedIntent.current = null;
    clearErrors();
    setAlertCount(null);
    if (intent === 'publish' && !alreadyPublished) {
      setConfirmOpen(true);
      return;
    }
    void (intent === 'publish' ? doSavePublished() : doSaveDraft());
  }

  function surfaceSubmitError(caught: unknown, intent: ProductFormIntent) {
    if (caught instanceof ApiError) {
      const fields = serverFieldErrors(caught.fields);
      if (Object.keys(fields).length === 0 && caught.code && /SKU/i.test(caught.code)) {
        fields.sku = 'A product with this SKU already exists. Use a unique SKU.';
      }
      if (Object.keys(fields).length > 0) {
        attemptedIntent.current = intent;
        applyErrors(fields);
        focusFirstInvalid(fields);
        return;
      }
    }
    setAlertCount(null);
    setAlertMessage(caught instanceof ApiError && caught.message
      ? caught.message
      : 'Something went wrong while saving. Try again.');
  }

  async function doSavePublished() {
    setSubmitting('publish');
    try {
      const saved = await saveProduct();
      if (saved.status !== 'published') await productsApi.publish(saved.id);
      await invalidate();
      guard.registerGuard(null);
      reset(getValues());
      setConfirmOpen(false);
      setSuccessName(saved.name);
    } catch (caught) {
      setConfirmOpen(false);
      surfaceSubmitError(caught, 'publish');
    } finally {
      setSubmitting(null);
    }
  }

  async function doSaveDraft() {
    setSubmitting('draft');
    try {
      await saveProduct();
      await invalidate();
      guard.registerGuard(null);
      reset(getValues());
      // ASSUMPTION D: draft save redirects to the list with a toast.
      notify(alreadyPublished ? 'Product updated.' : 'Draft saved.');
      router.push(PRODUCT_ROUTES.list);
    } catch (caught) {
      surfaceSubmitError(caught, 'draft');
    } finally {
      setSubmitting(null);
    }
  }

  function goToList() {
    setSuccessName(null);
    router.push(PRODUCT_ROUTES.list);
  }

  function addAnother() {
    setSuccessName(null);
    if (isEdit) {
      router.push(PRODUCT_ROUTES.new);
      return;
    }
    savedIdRef.current = null;
    attemptedIntent.current = null;
    reset(EMPTY_PRODUCT_VALUES);
    setImages([]);
    setImagesError(null);
    clearErrors();
    setAlertCount(null);
    setAlertMessage(null);
    document.getElementById('product-name')?.focus();
  }

  const publishLabel = alreadyPublished ? 'Save changes' : 'Publish product';
  const nameForDialogs = values.name.trim() || 'This product';

  return (
    <>
      <div className="flex flex-col gap-2">
        <a
          href={PRODUCT_ROUTES.list}
          onClick={(event) => { event.preventDefault(); guard.navigate(PRODUCT_ROUTES.list); }}
          className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-lg text-sm font-medium text-subtle transition-colors hover:text-ink"
        >
          <DashboardIcon name="chevron" className="size-4 rotate-180" />
          Products
        </a>
        <h1 className="font-heading text-2xl font-semibold text-ink md:text-[28px]">{isEdit ? 'Edit product' : 'Add product'}</h1>
        <p className="text-sm text-subtle">{isEdit ? 'Update the details, price and stock for this product.' : 'Add the details retailers need to buy this product.'}</p>
      </div>

      {catalogueUnavailable ? (
        // TODO(BE-002): remove once /api/v1/supplier/categories and /api/v1/supplier/products* exist.
        <p role="status" className="rounded-2xl border border-primary/30 bg-orange-50 px-4 py-3 text-sm text-ink">
          Product catalogue endpoints are not available on the server yet. Saving and photo uploads will unlock once the backend product API is deployed.
        </p>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,22.5rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <div id="product-photos" tabIndex={-1} className="outline-none">
            <Card title="Product photos" description="Add up to 8 photos. The first photo is the main photo shoppers see.">
              <ProductImageUploader
                value={images}
                onChange={setImages}
                uploadFn={(file, options) => productsApi.uploadImage(file, options)}
                disabled={formDisabled}
                error={fieldError('images')}
              />
            </Card>
          </div>

          <Card title="Product details">
            <Input
              id="product-name"
              label="Product name"
              required
              placeholder="e.g. Cotton polo shirt"
              maxLength={200}
              error={fieldError('name')}
              disabled={busy}
              {...register('name')}
            />
            <Textarea
              id="product-description"
              label="Description"
              placeholder="Describe the material, fit, sizes or anything retailers should know."
              rows={4}
              error={fieldError('description')}
              disabled={busy}
              helper="Optional, but a clear description helps retailers buy with confidence."
              {...register('description')}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Select
                  id="product-category"
                  label="Category"
                  required
                  error={fieldError('category')}
                  disabled={busy || categories.isPending}
                  {...register('category')}
                >
                  <option value="">{categories.isPending ? 'Loading categories…' : 'Choose a category'}</option>
                  {(categories.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </Select>
                {categories.isError && !catalogueUnavailable ? (
                  <p className="text-xs text-danger">
                    Couldn&apos;t load categories.{' '}
                    <button type="button" onClick={() => void categories.refetch()} className="font-semibold underline underline-offset-2">Retry</button>
                  </p>
                ) : null}
              </div>
              <Input
                id="product-sku"
                label="SKU"
                required
                placeholder="e.g. POLO-CTN-001"
                maxLength={100}
                error={fieldError('sku')}
                disabled={busy}
                helper="A unique code you use to track this product."
                {...register('sku')}
              />
            </div>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Pricing">
              <PriceInput
                value={values.wholesalePrice}
                onChange={(text) => setValue('wholesalePrice', text, { shouldDirty: true })}
                error={fieldError('wholesalePrice')}
                disabled={busy}
              />
            </Card>
            <Card title="Inventory">
              <Input
                id="product-stockQuantity"
                label="Stock quantity"
                required
                inputMode="numeric"
                placeholder="e.g. 25"
                error={fieldError('stockQuantity')}
                disabled={busy}
                helper="How many units you have available to sell."
                {...register('stockQuantity')}
              />
            </Card>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-24">
          {alertCount !== null && alertCount > 0 ? (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-red-50 p-4">
              <DashboardIcon name="alert" className="mt-0.5 size-5 shrink-0 text-danger" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-danger">Product not published</p>
                <p className="mt-0.5 text-sm text-danger/90">Fix the {alertCount} highlighted {alertCount === 1 ? 'field' : 'fields'} and try again.</p>
              </div>
              <button type="button" aria-label="Dismiss alert" onClick={() => setAlertCount(null)} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-danger transition-colors hover:bg-red-100">
                <DashboardIcon name="close" className="size-4" />
              </button>
            </div>
          ) : null}
          {alertMessage ? (
            <div role="alert" className="flex items-start gap-3 rounded-2xl border border-danger/30 bg-red-50 p-4">
              <DashboardIcon name="alert" className="mt-0.5 size-5 shrink-0 text-danger" />
              <p className="min-w-0 flex-1 text-sm text-danger">{alertMessage}</p>
              <button type="button" aria-label="Dismiss alert" onClick={() => setAlertMessage(null)} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-danger transition-colors hover:bg-red-100">
                <DashboardIcon name="close" className="size-4" />
              </button>
            </div>
          ) : null}

          <ProductPreview values={values} images={images} status={alreadyPublished ? 'published' : 'draft'} />

          <section className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-sm font-semibold text-ink">{alreadyPublished ? 'Save changes' : 'Publish'}</h2>
            <p className="mt-1 text-xs leading-5 text-subtle">
              {alreadyPublished
                ? 'This product is live. Save to update what retailers see.'
                : 'Publish when your product is ready for retailers to buy, or save a draft to finish later.'}
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                disabled={formDisabled || uploading}
                onClick={() => handleSave('publish')}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-ink transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-primary-disabled"
              >
                {submitting === 'publish' ? <Spinner /> : null}
                {publishLabel}
              </button>
              {!alreadyPublished ? (
                <button
                  type="button"
                  disabled={formDisabled || uploading}
                  onClick={() => handleSave('draft')}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting === 'draft' ? <Spinner /> : null}
                  Save draft
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => guard.navigate(PRODUCT_ROUTES.list)}
                className="min-h-11 rounded-xl px-5 text-sm font-medium text-subtle transition-colors hover:text-ink disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
            {uploading ? <p role="status" className="mt-3 text-xs text-subtle">Waiting for photos to finish uploading…</p> : null}
          </section>
        </div>
      </div>

      {/* Confirm publish — only shown after validation passes. */}
      <Dialog
        open={confirmOpen}
        tone="info"
        title="Publish this product?"
        description={`"${nameForDialogs}" will be visible to retailers and available to buy.`}
        onClose={() => { if (!busy) setConfirmOpen(false); }}
        closeLocked={busy}
        actions={<>
          <button type="button" data-dialog-safe className={dialogSecondaryClass} disabled={busy} onClick={() => setConfirmOpen(false)}>Review again</button>
          <button type="button" className={dialogPrimaryClass} disabled={busy} onClick={() => void doSavePublished()}>
            {submitting === 'publish' ? <Spinner /> : null}
            Publish product
          </button>
        </>}
      />

      {/* Published success. Escape/backdrop → back to products. */}
      <Dialog
        open={successName !== null}
        tone="success"
        title="Product published"
        description={`"${successName ?? ''}" is now live and visible to retailers.`}
        onClose={goToList}
        actions={<>
          <button type="button" className={dialogSecondaryClass} onClick={addAnother}>Add another product</button>
          <button type="button" data-dialog-safe className={dialogPrimaryClass} onClick={goToList}>Back to products</button>
        </>}
      />
    </>
  );
}
