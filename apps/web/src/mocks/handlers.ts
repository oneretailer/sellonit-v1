import { http, HttpResponse, delay } from 'msw';
import type { Product, SupplierDetail, SupplierPlan } from '@/lib/workspace/types';
import { initialProducts, initialSuppliers, completeMockSignup, currentMockUser, saveMockIntent, resetMockSignup, MOCK_BUSINESS_ID, mockSession } from './data';
import { readMockConfig } from './scenarios';
import { availableSupplierActions, nextSupplierStatus } from '@/lib/workspace/adminActions';

let products = initialProducts();
let suppliers = initialSuppliers();
const signupKeys = new Map<string, unknown>();
export function resetMockData(): void { products = initialProducts(); suppliers = initialSuppliers(); signupKeys.clear(); resetMockSignup(); }
const base = '/api/v1';
function failure(status: number, code: string, message: string, fields?: Record<string, string>) {
  return HttpResponse.json({ error: { code, message, requestId: 'mock-request-id', ...(fields ? { fields } : {}) } }, { status });
}
async function scenarioResponse(): Promise<Response | null> {
  const { scenario } = readMockConfig();
  if (scenario === 'slow') await delay(1800);
  switch (scenario) {
    case 'success': case 'empty': case 'slow': return null;
    case '401': return failure(401, 'UNAUTHENTICATED', 'Your session has expired.');
    case '403': return failure(403, 'FORBIDDEN', 'You do not have permission.');
    case '404': return failure(404, 'NOT_FOUND', 'This item was not found.');
    case '409': return failure(409, 'INVALID_STATE_TRANSITION', 'This item changed. Refresh and try again.');
    case '422': return failure(422, 'VALIDATION_FAILED', 'Check the highlighted fields.', { name: 'Enter a valid name.', 'defaultVariant.sku': 'Use a different SKU.', 'defaultVariant.basePriceKobo': 'Enter an amount greater than zero.', reason: 'A reason is required.', plan: 'Choose a plan.' });
    default: return null;
  }
}
function paginate<T>(items: T[], url: URL) {
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20)));
  return { data: items.slice((page - 1) * pageSize, page * pageSize), meta: { page, pageSize, total: items.length, totalPages: Math.ceil(items.length / pageSize) } };
}
function grant(permission: string): Response | null { return mockSession().permissions.includes(permission as never) ? null : failure(403, 'FORBIDDEN', 'Your membership does not grant this action.'); }
function adminOnly(): Response | null { return mockSession().platformRole === 'ADMIN' ? null : failure(403, 'FORBIDDEN', 'Platform administrator access required.'); }
function findProduct(id: string): Product | undefined { return products.find((item) => item.id === id && item.businessId === MOCK_BUSINESS_ID); }
async function json(request: Request): Promise<Record<string, unknown>> { return await request.json() as Record<string, unknown>; }

export const handlers = [
  http.get(`${base}/me`, async () => await scenarioResponse() ?? HttpResponse.json({ data: currentMockUser() })),
  http.get(`${base}/auth/me`, async () => await scenarioResponse() ?? HttpResponse.json({ data: currentMockUser() })),
  http.put(`${base}/auth/business-intent`, async ({ request }) => { const body = await json(request); const intent = body.businessType; if (intent !== 'ENTERPRISE' && intent !== 'RETAILER' && intent !== 'ENTREPRENEUR') return failure(422, 'VALIDATION_FAILED', 'Choose an account type.'); saveMockIntent(intent); return HttpResponse.json({ data: currentMockUser() }); }),
  http.get(`${base}/session/context`, async () => {
    const config = readMockConfig();
    if (config.scenario === 'slow') await delay(1800);
    if (config.scenario === '401') return failure(401, 'UNAUTHENTICATED', 'Your session has expired.');
    return HttpResponse.json({ data: mockSession() });
  }),
  http.get(`${base}/admin/suppliers`, async ({ request }) => {
    const failed = await scenarioResponse() ?? adminOnly(); if (failed) return failed;
    const url = new URL(request.url); const status = url.searchParams.get('status') ?? 'PENDING_REVIEW';
    const empty = readMockConfig().scenario === 'empty';
    return HttpResponse.json(paginate(empty ? [] : suppliers.filter((item) => item.status === status), url));
  }),
  http.get(`${base}/admin/suppliers/:id`, async ({ params }) => {
    const failed = await scenarioResponse() ?? adminOnly(); if (failed) return failed;
    const supplier = suppliers.find((item) => item.id === params.id);
    return supplier ? HttpResponse.json({ data: supplier }) : failure(404, 'NOT_FOUND', 'Supplier not found.');
  }),
  ...(['approve', 'reject', 'suspend', 'reinstate'] as const).map((action) => http.post(`${base}/admin/suppliers/:id/${action}`, async ({ params, request }) => {
    const failed = await scenarioResponse() ?? adminOnly(); if (failed) return failed;
    const index = suppliers.findIndex((item) => item.id === params.id); const supplier = suppliers[index];
    if (!supplier) return failure(404, 'NOT_FOUND', 'Supplier not found.');
    if (!availableSupplierActions(supplier.status).includes(action)) return failure(409, 'INVALID_STATE_TRANSITION', 'This supplier status has changed.');
    const body = action === 'approve' || action === 'reject' || action === 'suspend' ? await json(request) : {};
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if ((action === 'reject' || action === 'suspend') && !reason) return failure(422, 'VALIDATION_FAILED', 'A reason is required.', { reason: 'A reason is required.' });
    if (action === 'approve' && body.plan !== 'ENTERPRISE' && body.plan !== 'ENTERPRISE_PLUS') return failure(422, 'VALIDATION_FAILED', 'Choose a plan.', { plan: 'Choose a plan.' });
    const fromStatus = supplier.status; const status = nextSupplierStatus(action);
    const updated: SupplierDetail = { ...supplier, status, plan: status === 'APPROVED' ? (body.plan as SupplierPlan | undefined) ?? supplier.plan ?? 'ENTERPRISE' : supplier.plan, auditHistory: [...supplier.auditHistory, { id: crypto.randomUUID(), action: action === 'approve' ? 'APPROVED' : action === 'reject' ? 'REJECTED' : action === 'suspend' ? 'SUSPENDED' : 'REINSTATED', actorName: 'Platform administrator', fromStatus, toStatus: status, reason: reason || null, createdAt: new Date().toISOString() }] };
    suppliers[index] = updated; return HttpResponse.json({ data: updated });
  })),
  http.get(`${base}/supplier/products`, async ({ request }) => {
    const failed = await scenarioResponse() ?? grant('product:read'); if (failed) return failed;
    const url = new URL(request.url); const search = (url.searchParams.get('search') ?? '').toLowerCase(); const status = url.searchParams.get('status');
    const filtered = products.filter((item) => (!search || `${item.name} ${item.defaultVariant.sku}`.toLowerCase().includes(search)) && (!status || item.status === status));
    return HttpResponse.json(paginate(readMockConfig().scenario === 'empty' ? [] : filtered, url));
  }),
  http.post(`${base}/supplier/products`, async ({ request }) => {
    const failed = await scenarioResponse() ?? grant('product:write'); if (failed) return failed;
    const body = await json(request); const variant = body.defaultVariant as Product['defaultVariant'] | undefined;
    if (!variant || typeof body.name !== 'string' || !body.name.trim() || !variant.sku?.trim() || !Number.isSafeInteger(variant.basePriceKobo) || variant.basePriceKobo <= 0) return failure(422, 'VALIDATION_FAILED', 'Check the product fields.', { name: 'Enter a product name.', 'defaultVariant.sku': 'Enter a SKU.', 'defaultVariant.basePriceKobo': 'Enter a positive whole-kobo amount.' });
    if (products.some((item) => item.defaultVariant.sku.toLowerCase() === variant.sku.trim().toLowerCase())) return failure(409, 'DUPLICATE_SKU', 'This SKU already exists.', { 'defaultVariant.sku': 'This SKU already exists in your business.' });
    const now = new Date().toISOString();
    const created: Product = { id: crypto.randomUUID(), businessId: MOCK_BUSINESS_ID, name: body.name.trim(), description: typeof body.description === 'string' ? body.description : '', category: typeof body.category === 'string' ? body.category : '', defaultVariant: { sku: variant.sku.trim(), basePriceKobo: variant.basePriceKobo }, status: 'DRAFT', pricingRule: { maxMarkupKobo: null }, publishedAt: null, createdAt: now, updatedAt: now };
    products.unshift(created); return HttpResponse.json({ data: created }, { status: 201 });
  }),
  http.get(`${base}/supplier/products/:id`, async ({ params }) => {
    const failed = await scenarioResponse() ?? grant('product:read'); if (failed) return failed;
    const item = findProduct(String(params.id)); return item ? HttpResponse.json({ data: item }) : failure(404, 'NOT_FOUND', 'Product not found.');
  }),
  http.patch(`${base}/supplier/products/:id`, async ({ params, request }) => {
    const failed = await scenarioResponse() ?? grant('product:write'); if (failed) return failed;
    const item = findProduct(String(params.id)); if (!item) return failure(404, 'NOT_FOUND', 'Product not found.');
    if (item.status === 'ARCHIVED') return failure(409, 'INVALID_STATE_TRANSITION', 'Archived products are read-only.');
    const body = await json(request); const variant = (body.defaultVariant ?? item.defaultVariant) as Product['defaultVariant'];
    if (products.some((other) => other.id !== item.id && other.defaultVariant.sku.toLowerCase() === variant.sku.toLowerCase())) return failure(409, 'DUPLICATE_SKU', 'This SKU already exists.', { 'defaultVariant.sku': 'This SKU already exists in your business.' });
    const updated: Product = { ...item, name: typeof body.name === 'string' ? body.name : item.name, description: typeof body.description === 'string' ? body.description : item.description, category: typeof body.category === 'string' ? body.category : item.category, defaultVariant: variant, updatedAt: new Date().toISOString() };
    products = products.map((other) => other.id === item.id ? updated : other); return HttpResponse.json({ data: updated });
  }),
  http.put(`${base}/supplier/products/:id/pricing-rule`, async ({ params, request }) => {
    const failed = await scenarioResponse() ?? grant('pricing:set'); if (failed) return failed;
    const item = findProduct(String(params.id)); if (!item) return failure(404, 'NOT_FOUND', 'Product not found.');
    if (item.status === 'ARCHIVED') return failure(409, 'INVALID_STATE_TRANSITION', 'Archived products are read-only.');
    const body = await json(request); const markup = body.maxMarkupKobo;
    if (markup !== null && (!Number.isSafeInteger(markup) || Number(markup) < 0)) return failure(422, 'VALIDATION_FAILED', 'Invalid markup.', { maxMarkupKobo: 'Enter zero or a positive whole-kobo amount.' });
    const updated = { ...item, pricingRule: { maxMarkupKobo: markup as number | null }, updatedAt: new Date().toISOString() };
    products = products.map((other) => other.id === item.id ? updated : other); return HttpResponse.json({ data: updated });
  }),
  ...(['publish', 'unpublish'] as const).map((action) => http.post(`${base}/supplier/products/:id/${action}`, async ({ params }) => {
    const failed = await scenarioResponse() ?? grant('product:publish'); if (failed) return failed;
    const item = findProduct(String(params.id)); if (!item) return failure(404, 'NOT_FOUND', 'Product not found.');
    if (mockSession().supplierStatus !== 'APPROVED') return failure(403, 'SUPPLIER_NOT_APPROVED', 'Supplier approval is required.');
    const valid = action === 'publish' ? item.status === 'DRAFT' || item.status === 'UNPUBLISHED' : item.status === 'PUBLISHED';
    if (!valid) return failure(409, 'INVALID_STATE_TRANSITION', 'This product status has changed.');
    const updated: Product = { ...item, status: action === 'publish' ? 'PUBLISHED' : 'UNPUBLISHED', publishedAt: action === 'publish' ? new Date().toISOString() : item.publishedAt, updatedAt: new Date().toISOString() };
    products = products.map((other) => other.id === item.id ? updated : other); return HttpResponse.json({ data: updated });
  })),
  http.post(`${base}/onboarding/businesses`, async ({ request }) => {
    const failed = await scenarioResponse(); if (failed) return failed;
    const key = request.headers.get('Idempotency-Key'); if (!key) return failure(422, 'VALIDATION_FAILED', 'Idempotency-Key is required.');
    const previous = signupKeys.get(key); if (previous) return HttpResponse.json(previous, { status: 201 });
    const body = await json(request);
    const result = { data: { id: MOCK_BUSINESS_ID, name: String(body.name), type: body.accountType === 'supplier' ? 'ENTERPRISE' : body.accountType === 'retailer' ? 'RETAILER' : 'ENTREPRENEUR', createdAt: new Date().toISOString() } };
    signupKeys.set(key, result); completeMockSignup(); return HttpResponse.json(result, { status: 201 });
  }),
];
