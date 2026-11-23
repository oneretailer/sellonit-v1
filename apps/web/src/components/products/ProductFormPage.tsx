'use client';

/**
 * Add/Edit product form (/dashboard/products/new and /:id/edit).
 *
 * - React Hook Form holds raw text values (price stays decimal naira text;
 *   conversion to kobo happens once, in productInputFromValues).
 * - Publish validates every required field + ≥1 photo, shows the dismissible
 *   "Product not published" alert, focuses the first invalid field, then asks
 *   for confirmation. Save draft allows any field/photo to be filled in
 *   (defaulting blank names to "Untitled product") and redirects with a
 *   "Draft saved" toast.
 * - Dirty state registers the shared NavigationGuard and a beforeunload listener.
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
import type { Product, ProductCategory } from '@/lib/products/types';
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
    try {
      display = formatNaira(nairaToKobo(value.trim())).replace(/^₦/, '');
    } catch {
      display = value;
    }
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
      helper="The price you charge retailers for each unit."
      onChange={(event) => onChange(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    />
  );
}

function Card({
  title,
  required = false,
  description,
  children,
}: {
  title: string;
  required?: boolean;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-ws-card border border-line bg-surface p-5 shadow-ws-card sm:p-6">
      <div>
        <h2 className="text-base font-semibold text-ink">
          {title}
          {required ? (
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
          ) : null}
        </h2>
        {description ? (
          <p className="mt-1 text-[length:var(--text-ws-caption)] text-caption">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ProductPreview({
  values,
  images,
  categories,
  status,
}: {
  values: ProductFormValues;
  images: UploaderImage[];
  categories: ProductCategory[];
  status: 'draft' | 'published';
}) {
  const main = images.find((image) => image.status === 'uploaded');
  let price = '₦ –';
  if (values.wholesalePrice.trim()) {
    try {
      price = formatNaira(nairaToKobo(values.wholesalePrice.trim()));
    } catch {
      price = '₦ –';
    }
  }
  const stock = /^\d+$/.test(values.stockQuantity.trim())
    ? Number.parseInt(values.stockQuantity.trim(), 10)
    : null;

  const selectedCategoryName =
    categories.find((cat) => cat.id === values.category)?.name || values.category.trim();
  const categoryPart = selectedCategoryName || 'Category';
  const skuPart = values.sku.trim() || 'SKU';

  return (
    <section className="rounded-ws-card border border-line bg-surface p-5 shadow-ws-card">
      <h2 className="text-[length:var(--text-ws-body)] font-semibold text-ink">Preview</h2>
      <p className="mt-0.5 text-[length:var(--text-ws-caption)] text-caption">
        Updates as you fill in the form.
      </p>

      <div className="mt-4 flex flex-col gap-3.5">
        {main ? (
          <div className="aspect-[4/3] w-full overflow-hidden rounded-ws-card border border-line bg-canvas">
            {/* eslint-disable-next-line @next/next/no-img-element -- live preview of an uploaded photo. */}
            <img src={main.url} alt="" className="size-full object-cover" />
          </div>
        ) : (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-ws-card border border-dashed border-line bg-canvas text-caption">
            <DashboardIcon name="image" className="size-7" />
            <span className="text-[length:var(--text-ws-caption)]">No photo yet</span>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <p
            className={cn(
              'truncate text-[length:var(--text-ws-body)] font-semibold',
              values.name.trim() ? 'text-ink' : 'text-caption',
            )}
          >
            {values.name.trim() || 'Product name'}
          </p>
          <p className="truncate text-[length:var(--text-ws-caption)] text-caption">
            {categoryPart} · {skuPart}
          </p>
        </div>

        <div className="flex items-end justify-between gap-3 pt-1">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-base font-semibold text-ink">{price}</p>
            {stock !== null ? (
              <StockText quantity={stock} />
            ) : (
              <span className="text-[length:var(--text-ws-caption)] text-caption">– in stock</span>
            )}
          </div>
          <ProductStatusPill status={status} />
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
  return product.images.map((image) => ({
    id: image.id,
    url: image.url,
    status: 'uploaded',
    progress: 100,
  }));
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
        <span className="block h-8 w-48 animate-pulse rounded-ws-control bg-draft-tint" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_352px]">
          <div className="flex flex-col gap-6">
            <span className="block h-56 animate-pulse rounded-ws-card bg-draft-tint" />
            <span className="block h-80 animate-pulse rounded-ws-card bg-draft-tint" />
          </div>
          <span className="hidden h-96 animate-pulse rounded-ws-card bg-draft-tint xl:block" />
        </div>
      </div>
    );
  }
  if (isEdit && productQuery.isError) {
    if (isEndpointNotImplemented(productQuery.error)) {
      return (
        <StatePanel
          icon="products"
          tone="cream"
          title="Product catalogue is coming soon"
          description="Editing products is not available on the server yet."
          actions={
            <button
              type="button"
              onClick={() => router.push(PRODUCT_ROUTES.list)}
              className="min-h-11 rounded-ws-control border border-line bg-surface px-6 text-[length:var(--text-ws-body)] font-semibold text-ink transition-colors hover:bg-canvas"
            >
              Back to products
            </button>
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
        description={
          notFound
            ? 'It may have been deleted, or it belongs to another business.'
            : 'Check your connection and try again.'
        }
        actions={
          <>
            <button
              type="button"
              onClick={() => router.push(PRODUCT_ROUTES.list)}
              className="min-h-11 rounded-ws-control border border-line bg-surface px-6 text-[length:var(--text-ws-body)] font-semibold text-ink transition-colors hover:bg-canvas"
            >
              Back to products
            </button>
            {!notFound ? (
              <button
                type="button"
                onClick={() => void productQuery.refetch()}
                className="min-h-11 rounded-ws-control bg-primary px-6 text-[length:var(--text-ws-body)] font-semibold text-on-primary transition-colors hover:bg-primary-hover"
              >
                Retry
              </button>
            ) : null}
          </>
        }
      />
    );
  }
  return (
    <ProductForm
      key={product?.id ?? 'new'}
      product={product}
      guard={guard}
      router={router}
      notify={notify}
    />
  );
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
  const initialValues = useMemo(
    () => (product ? valuesFromProduct(product) : EMPTY_PRODUCT_VALUES),
    [product],
  );
  const initialImages = useMemo(() => (product ? imagesFromProduct(product) : []), [product]);
  const initialImageIds = useMemo(
    () => new Set(initialImages.map((image) => image.id)),
    [initialImages],
  );

  const { register, control, reset, getValues, setValue, setError, clearErrors, formState } =
    useForm<ProductFormValues>({
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
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

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

  const isDirty =
    formState.isDirty ||
    images.length !== initialImages.length ||
    images.some((image, index) => initialImages[index]?.id !== image.id);

  // ---- Unsaved-changes guard + beforeunload -------------------------------
  const discardCleanup = useCallback(async () => {
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
    field === 'images' ? (imagesError ?? undefined) : formState.errors[field]?.message;

  const applyErrors = useCallback(
    (errors: ProductFieldErrors) => {
      clearErrors();
      setImagesError(errors.images ?? null);
      for (const [field, message] of Object.entries(errors)) {
        if (field === 'images') continue;
        setError(field as keyof ProductFormValues, { type: 'manual', message });
      }
      const count = Object.keys(errors).length;
      setAlertCount(count > 0 ? count : null);
    },
    [clearErrors, setError],
  );

  const valuesKey = JSON.stringify(values);
  const imagesKey = images.map((image) => `${image.id}:${image.status}`).join('|');
  useEffect(() => {
    if (attemptedIntent.current === null) return;
    const errors = validateProduct(
      getValues(),
      imagesRef.current.filter((image) => image.status === 'uploaded').length,
      attemptedIntent.current,
    );
    applyErrors(errors);
  }, [valuesKey, imagesKey, applyErrors, getValues]);

  function focusFirstInvalid(errors: ProductFieldErrors) {
    const first = PRODUCT_FIELD_ORDER.find((field) => errors[field]);
    if (!first) return;
    const element = document.getElementById(
      first === 'images' ? 'product-photos' : `product-${first}`,
    );
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element?.focus({ preventScroll: true });
  }

  // ---- Submit flows ---------------------------------------------------------
  function buildInput() {
    return productInputFromValues(
      getValues(),
      imagesRef.current.filter((image) => image.status === 'uploaded').map((image) => image.id),
    );
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
    setAlertMessage(
      caught instanceof ApiError && caught.message
        ? caught.message
        : 'Something went wrong while saving. Try again.',
    );
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
      notify({
        title: 'Product published',
        description: `${saved.name} is now listed for retailers to discover.`,
      });
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
      const saved = await saveProduct();
      await invalidate();
      guard.registerGuard(null);
      reset(getValues());
      notify(
        alreadyPublished
          ? { title: 'Product updated', description: `${saved.name} has been updated.` }
          : { title: 'Draft saved', description: `${saved.name} is saved as a draft.` },
      );
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
      <div className="flex flex-col gap-1.5">
        <a
          href={PRODUCT_ROUTES.list}
          onClick={(event) => {
            event.preventDefault();
            guard.navigate(PRODUCT_ROUTES.list);
          }}
          className="inline-flex min-h-8 w-fit items-center gap-1.5 rounded-ws-control text-[length:var(--text-ws-label)] font-medium text-subtle transition-colors hover:text-ink"
        >
          <span aria-hidden="true">←</span>
          Products
        </a>
        <h1 className="font-heading text-[length:var(--text-ws-page-title)] font-semibold text-ink">
          {isEdit ? 'Edit product' : 'Add product'}
        </h1>
        <p className="text-[length:var(--text-ws-body)] text-subtle">
          {isEdit
            ? 'Update the details, price and stock for this product. Fields marked * are required.'
            : 'Add a product for retailers to discover. Fields marked * are required.'}
        </p>
      </div>

      {catalogueUnavailable ? (
        // TODO(BE-002): remove once /api/v1/supplier/categories and /api/v1/supplier/products* exist.
        <p
          role="status"
          className="rounded-ws-card border border-primary-border bg-primary-tint px-4 py-3 text-[length:var(--text-ws-body)] text-ink"
        >
          Product catalogue endpoints are not available on the server yet. Saving and photo uploads
          will unlock once the backend product API is deployed.
        </p>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_352px]">
        <div className="flex min-w-0 flex-col gap-6">
          <div id="product-photos" tabIndex={-1} className="outline-none">
            <Card
              title="Product photos"
              required
              description="Retailers see these photos when they discover your product."
            >
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
              placeholder="e.g. Classic cotton tee"
              maxLength={200}
              error={fieldError('name')}
              disabled={busy}
              {...register('name')}
            />
            <Textarea
              id="product-description"
              label="Description"
              placeholder="Describe the product for retailers"
              rows={4}
              error={fieldError('description')}
              disabled={busy}
              helper="Optional. Mention material, fit or anything retailers should know."
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
                  <option value="">
                    {categories.isPending ? 'Loading categories…' : 'Select a category'}
                  </option>
                  {(categories.data ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
                {categories.isError && !catalogueUnavailable ? (
                  <p className="text-[length:var(--text-ws-caption)] text-danger">
                    Couldn&apos;t load categories.{' '}
                    <button
                      type="button"
                      onClick={() => void categories.refetch()}
                      className="font-semibold underline underline-offset-2"
                    >
                      Retry
                    </button>
                  </p>
                ) : null}
              </div>
              <Input
                id="product-sku"
                label="SKU"
                required
                placeholder="e.g. SF-CT-001"
                maxLength={100}
                error={fieldError('sku')}
                disabled={busy}
                helper="Your own code for this product."
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
                placeholder="0"
                error={fieldError('stockQuantity')}
                disabled={busy}
                helper="Units you currently have available."
                {...register('stockQuantity')}
              />
            </Card>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-24">
          {alertCount !== null && alertCount > 0 ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-ws-card border border-danger/30 bg-danger-tint p-4"
            >
              <DashboardIcon name="alert" className="mt-0.5 size-5 shrink-0 text-danger" />
              <div className="min-w-0 flex-1">
                <p className="text-[length:var(--text-ws-body)] font-semibold text-danger">
                  Product not published
                </p>
                <p className="mt-0.5 text-[length:var(--text-ws-body)] text-danger">
                  Fix the {alertCount} highlighted {alertCount === 1 ? 'field' : 'fields'} and try
                  again.
                </p>
              </div>
              <button
                type="button"
                aria-label="Dismiss alert"
                onClick={() => setAlertCount(null)}
                className="flex size-8 shrink-0 items-center justify-center rounded-ws-control text-danger transition-colors hover:bg-surface/60"
              >
                <DashboardIcon name="close" className="size-4" />
              </button>
            </div>
          ) : null}
          {alertMessage ? (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-ws-card border border-danger/30 bg-danger-tint p-4"
            >
              <DashboardIcon name="alert" className="mt-0.5 size-5 shrink-0 text-danger" />
              <p className="min-w-0 flex-1 text-[length:var(--text-ws-body)] text-danger">
                {alertMessage}
              </p>
              <button
                type="button"
                aria-label="Dismiss alert"
                onClick={() => setAlertMessage(null)}
                className="flex size-8 shrink-0 items-center justify-center rounded-ws-control text-danger transition-colors hover:bg-surface/60"
              >
                <DashboardIcon name="close" className="size-4" />
              </button>
            </div>
          ) : null}

          <ProductPreview
            values={values}
            images={images}
            categories={categories.data ?? []}
            status={alreadyPublished ? 'published' : 'draft'}
          />

          <section className="rounded-ws-card border border-line bg-surface p-5 shadow-ws-card">
            <h2 className="text-[length:var(--text-ws-body)] font-semibold text-ink">
              {alreadyPublished ? 'Save changes' : 'Publish'}
            </h2>
            <p className="mt-1 text-[length:var(--text-ws-caption)] leading-5 text-subtle">
              {alreadyPublished
                ? 'This product is live. Save to update what retailers see.'
                : 'Publishing lists this product for retailers to discover. Save a draft to finish it later.'}
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <button
                type="button"
                disabled={formDisabled || uploading}
                onClick={() => handleSave('publish')}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-ws-control bg-primary px-5 text-[length:var(--text-ws-body)] font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-primary-disabled"
              >
                {submitting === 'publish' ? <Spinner /> : null}
                {publishLabel}
              </button>
              {!alreadyPublished ? (
                <button
                  type="button"
                  disabled={formDisabled || uploading}
                  onClick={() => handleSave('draft')}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-ws-control border border-primary bg-surface px-5 text-[length:var(--text-ws-body)] font-semibold text-primary transition-colors hover:bg-primary-tint disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting === 'draft' ? <Spinner /> : null}
                  Save draft
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => guard.navigate(PRODUCT_ROUTES.list)}
                className="min-h-10 w-full rounded-ws-control px-5 text-center text-[length:var(--text-ws-body)] font-medium text-subtle transition-colors hover:text-ink disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
            {uploading ? (
              <p role="status" className="mt-3 text-[length:var(--text-ws-caption)] text-caption">
                Waiting for photos to finish uploading…
              </p>
            ) : null}
          </section>
        </div>
      </div>

      {/* Confirm publish — only shown after validation passes. */}
      <Dialog
        open={confirmOpen}
        tone="info"
        title="Confirm publish"
        description={`"${nameForDialogs}" will be visible to retailers and available to discover.`}
        onClose={() => {
          if (!busy) setConfirmOpen(false);
        }}
        closeLocked={busy}
        actions={
          <>
            <button
              type="button"
              data-dialog-safe
              className={dialogSecondaryClass}
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={dialogPrimaryClass}
              disabled={busy}
              onClick={() => void doSavePublished()}
            >
              {submitting === 'publish' ? <Spinner /> : null}
              Publish
            </button>
          </>
        }
      />

      {/* Published success. Escape/backdrop → back to products. */}
      <Dialog
        open={successName !== null}
        tone="success"
        title="Product published"
        description={`"${successName ?? ''}" is now live and visible to retailers.`}
        onClose={goToList}
        actions={
          <>
            <button type="button" className={dialogSecondaryClass} onClick={addAnother}>
              Add another product
            </button>
            <button
              type="button"
              data-dialog-safe
              className={dialogPrimaryClass}
              onClick={goToList}
            >
              Back to products
            </button>
          </>
        }
      />
    </>
  );
}
