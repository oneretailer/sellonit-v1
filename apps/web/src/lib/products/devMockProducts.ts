/**
 * Dev-only in-memory review adapter for `/dashboard/products*`.
 *
 * STRICTLY OFF BY DEFAULT: only active when `NODE_ENV !== 'production'` AND
 * `NEXT_PUBLIC_DEV_MOCK_PRODUCTS === '1'`. Never runs in production builds or
 * standard local/CI runs without that explicit opt-in flag.
 */
import { ApiError } from '@/lib/api-client';
import { stockLevel } from './stock';
import type {
  Paginated,
  Product,
  ProductCategory,
  ProductInput,
  ProductListParams,
  ProductSummary,
  UploadImageOptions,
  UploadedImage,
} from './types';

export const SAMPLE_PRODUCT_CATEGORIES: readonly ProductCategory[] = [
  { id: 'Tops', name: 'Tops' },
  { id: 'Bottoms', name: 'Bottoms' },
  { id: 'Accessories', name: 'Accessories' },
  { id: 'Outerwear', name: 'Outerwear' },
] as const;

export const SAMPLE_PRODUCTS: readonly Product[] = [
  {
    id: 'prod-ps-022',
    name: 'Cotton polo shirt',
    description: 'Soft pique cotton polo in a regular fit. Available in six colours.',
    category: 'Tops',
    sku: 'SF-PS-022',
    wholesalePrice: 750000,
    stockQuantity: 60,
    status: 'draft',
    images: [],
    createdAt: '2026-11-01T09:00:00.000Z',
    updatedAt: '2026-11-01T09:00:00.000Z',
  },
  {
    id: 'prod-ct-001',
    name: 'Classic cotton tee',
    description: 'Breathable combed cotton crew-neck tee for everyday retail assortments.',
    category: 'Tops',
    sku: 'SF-CT-001',
    wholesalePrice: 850000,
    stockQuantity: 0,
    status: 'published',
    images: [],
    createdAt: '2026-11-01T09:10:00.000Z',
    updatedAt: '2026-11-01T09:10:00.000Z',
  },
  {
    id: 'prod-ls-014',
    name: 'Linen shirt',
    description: 'Lightweight woven linen button-down shirt with relaxed tailoring.',
    category: 'Tops',
    sku: 'SF-LS-014',
    wholesalePrice: 1400000,
    stockQuantity: 3,
    status: 'published',
    images: [],
    createdAt: '2026-11-01T09:20:00.000Z',
    updatedAt: '2026-11-01T09:20:00.000Z',
  },
  {
    id: 'prod-sj-008',
    name: 'Straight-leg jeans',
    description: 'Mid-rise rigid denim jeans with classic five-pocket construction.',
    category: 'Bottoms',
    sku: 'SF-SJ-008',
    wholesalePrice: 1850000,
    stockQuantity: 5,
    status: 'published',
    images: [],
    createdAt: '2026-11-01T09:30:00.000Z',
    updatedAt: '2026-11-01T09:30:00.000Z',
  },
  {
    id: 'prod-rt-021',
    name: 'Ribbed tank top',
    description: 'Stretch cotton-ribbed tank designed for layering.',
    category: 'Tops',
    sku: 'SF-RT-021',
    wholesalePrice: 600000,
    stockQuantity: 8,
    status: 'published',
    images: [],
    createdAt: '2026-11-01T09:40:00.000Z',
    updatedAt: '2026-11-01T09:40:00.000Z',
  },
  {
    id: 'prod-tb-032',
    name: 'Canvas tote bag',
    description: 'Heavyweight cotton canvas tote with reinforced shoulder straps.',
    category: 'Accessories',
    sku: 'SF-TB-032',
    wholesalePrice: 750000,
    stockQuantity: 64,
    status: 'draft',
    images: [],
    createdAt: '2026-11-01T09:50:00.000Z',
    updatedAt: '2026-11-01T09:50:00.000Z',
  },
] as const;

export function isDevProductsMockEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.NEXT_PUBLIC_DEV_MOCK_PRODUCTS === '1';
}

const storeByBusiness = new Map<string, Product[]>();
const uploadedImages = new Map<string, UploadedImage>();
let seq = 100;

function rowsForBusiness(businessId: string | null): Product[] {
  const key = businessId ?? '__default__';
  let rows = storeByBusiness.get(key);
  if (!rows) {
    rows = SAMPLE_PRODUCTS.map((item) => ({ ...item, images: [...item.images] }));
    storeByBusiness.set(key, rows);
  }
  return rows;
}

export const devMockProducts = {
  list(businessId: string | null, params: ProductListParams): Promise<Paginated<Product>> {
    const allRows = rowsForBusiness(businessId);
    const query = params.q?.trim().toLowerCase() ?? '';
    const filtered = allRows.filter((row) => {
      if (params.status && row.status !== params.status) return false;
      if (params.category && row.category.toLowerCase() !== params.category.toLowerCase()) {
        return false;
      }
      if (params.stock && params.stock !== 'all') {
        if (
          row.stockQuantity === null ||
          stockLevel(row.stockQuantity, row.lowStock) !== params.stock
        ) {
          return false;
        }
      }
      if (query) {
        const matchesName = row.name.toLowerCase().includes(query);
        const matchesSku = row.sku.toLowerCase().includes(query);
        if (!matchesName && !matchesSku) return false;
      }
      return true;
    });
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / params.pageSize));
    const start = (params.page - 1) * params.pageSize;
    const data = filtered
      .slice(start, start + params.pageSize)
      .map((item) => ({ ...item, images: [...item.images] }));
    return Promise.resolve({
      data,
      meta: { page: params.page, pageSize: params.pageSize, total, totalPages },
    });
  },

  summary(businessId: string | null): Promise<ProductSummary> {
    const allRows = rowsForBusiness(businessId);
    return Promise.resolve({
      total: allRows.length,
      published: allRows.filter((row) => row.status === 'published').length,
      drafts: allRows.filter((row) => row.status === 'draft').length,
      lowStock: allRows.filter(
        (row) =>
          row.stockQuantity !== null && stockLevel(row.stockQuantity, row.lowStock) === 'low-stock',
      ).length,
      outOfStock: allRows.filter(
        (row) =>
          row.stockQuantity !== null &&
          stockLevel(row.stockQuantity, row.lowStock) === 'out-of-stock',
      ).length,
    });
  },

  get(businessId: string | null, id: string): Promise<Product> {
    const found = rowsForBusiness(businessId).find((row) => row.id === id);
    if (!found) return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Product not found.'));
    return Promise.resolve({ ...found, images: [...found.images] });
  },

  create(businessId: string | null, input: ProductInput): Promise<Product> {
    const allRows = rowsForBusiness(businessId);
    const trimmedSku = input.sku.trim();
    if (trimmedSku && allRows.some((row) => row.sku.toLowerCase() === trimmedSku.toLowerCase())) {
      return Promise.reject(
        new ApiError(409, 'DUPLICATE_SKU', 'SKU already exists.', null, {
          sku: 'A product with this SKU already exists. Use a unique SKU.',
        }),
      );
    }
    seq += 1;
    const now = new Date().toISOString();
    const created: Product = {
      id: `prod-dev-${seq}`,
      name: input.name,
      description: input.description,
      category: input.category,
      sku: input.sku,
      wholesalePrice: input.wholesalePrice,
      stockQuantity: input.stockQuantity,
      status: 'draft',
      images: input.imageIds
        .map((imageId) => uploadedImages.get(imageId))
        .filter((img): img is UploadedImage => Boolean(img)),
      createdAt: now,
      updatedAt: now,
    };
    allRows.unshift(created);
    return Promise.resolve({ ...created, images: [...created.images] });
  },

  update(businessId: string | null, id: string, input: Partial<ProductInput>): Promise<Product> {
    const allRows = rowsForBusiness(businessId);
    const target = allRows.find((row) => row.id === id);
    if (!target) return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Product not found.'));
    if (input.name !== undefined) target.name = input.name;
    if (input.description !== undefined) target.description = input.description;
    if (input.category !== undefined) target.category = input.category;
    if (input.sku !== undefined) target.sku = input.sku;
    if (input.wholesalePrice !== undefined) target.wholesalePrice = input.wholesalePrice;
    if (input.stockQuantity !== undefined) target.stockQuantity = input.stockQuantity;
    if (input.imageIds !== undefined) {
      const existingById = new Map(target.images.map((img) => [img.id, img]));
      target.images = input.imageIds
        .map((imgId) => existingById.get(imgId) ?? uploadedImages.get(imgId))
        .filter((img): img is UploadedImage => Boolean(img));
    }
    target.updatedAt = new Date().toISOString();
    return Promise.resolve({ ...target, images: [...target.images] });
  },

  updatePricingRule(
    businessId: string | null,
    id: string,
    maxMarkupKobo: number | null,
  ): Promise<Product> {
    const allRows = rowsForBusiness(businessId);
    const target = allRows.find((row) => row.id === id);
    if (!target) return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Product not found.'));
    target.pricingRule = { maxMarkupKobo };
    target.updatedAt = new Date().toISOString();
    return Promise.resolve({ ...target, images: [...target.images] });
  },

  remove(businessId: string | null, id: string): Promise<void> {
    const allRows = rowsForBusiness(businessId);
    const index = allRows.findIndex((row) => row.id === id);
    if (index >= 0) allRows.splice(index, 1);
    return Promise.resolve();
  },

  setPublished(businessId: string | null, id: string, published: boolean): Promise<Product> {
    const allRows = rowsForBusiness(businessId);
    const target = allRows.find((row) => row.id === id);
    if (!target) return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Product not found.'));
    target.status = published ? 'published' : 'draft';
    target.updatedAt = new Date().toISOString();
    return Promise.resolve({ ...target, images: [...target.images] });
  },

  categories(): Promise<ProductCategory[]> {
    return Promise.resolve([...SAMPLE_PRODUCT_CATEGORIES]);
  },

  uploadImage(file: File, options: UploadImageOptions = {}): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      if (options.signal?.aborted) {
        reject(new DOMException('Upload cancelled', 'AbortError'));
        return;
      }
      options.onProgress?.(45);
      const timer = setTimeout(() => {
        options.onProgress?.(100);
        seq += 1;
        const image: UploadedImage = {
          id: `img-dev-${seq}`,
          url: URL.createObjectURL(file),
        };
        uploadedImages.set(image.id, image);
        resolve(image);
      }, 120);
      options.signal?.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('Upload cancelled', 'AbortError'));
        },
        { once: true },
      );
    });
  },

  deleteImage(id: string): Promise<void> {
    const img = uploadedImages.get(id);
    if (img) {
      URL.revokeObjectURL(img.url);
      uploadedImages.delete(id);
    }
    return Promise.resolve();
  },
};
