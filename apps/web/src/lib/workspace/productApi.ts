import { api, newIdempotencyKey, unwrap } from '@/lib/api';
import type { CreateProductRequest, ProductStatus, UpdateProductRequest } from './types';

export async function listProducts(filters: { search: string; status?: ProductStatus; page: number; pageSize: number }, signal?: AbortSignal) {
  return unwrap(api.GET('/supplier/products', { params: { query: filters }, signal }));
}
export async function getProduct(id: string, signal?: AbortSignal) {
  return (await unwrap(api.GET('/supplier/products/{id}', { params: { path: { id } }, signal }))).data;
}
export async function createProduct(body: CreateProductRequest, idempotencyKey: string) {
  return (await unwrap(api.POST('/supplier/products', { body, params: { header: { 'Idempotency-Key': idempotencyKey } } }))).data;
}
export async function updateProduct(id: string, body: UpdateProductRequest) {
  return (await unwrap(api.PATCH('/supplier/products/{id}', { params: { path: { id } }, body }))).data;
}
export async function setPricingRule(id: string, maxMarkupKobo: number | null) {
  return (await unwrap(api.PUT('/supplier/products/{id}/pricing-rule', { params: { path: { id } }, body: { maxMarkupKobo } }))).data;
}
export async function publishProduct(id: string, action: 'publish' | 'unpublish') {
  return (await unwrap(action === 'publish'
    ? api.POST('/supplier/products/{id}/publish', { params: { path: { id } } })
    : api.POST('/supplier/products/{id}/unpublish', { params: { path: { id } } }))).data;
}
export { newIdempotencyKey };
