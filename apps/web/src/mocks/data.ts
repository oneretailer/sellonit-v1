import type { AuthUser } from '@/lib/auth/types';
import type { Product, SessionContext, SupplierDetail, SupplierStatus } from '@/lib/workspace/types';
import { readMockConfig, type MockPersona } from './scenarios';

// MSW handlers execute in the requesting tab. These non-personal fixture flags
// emulate shared backend membership across tabs; persona selectors stay tab-scoped.
const SIGNUP_KEY = 'sellonit.api-mock.signup-completed';
const INTENT_KEY = 'sellonit.api-mock.business-intent';
let signupCompleted = false;
let savedIntent: AuthUser['onboardingIntent'] = null;
function sharedSignupCompleted(): boolean { try { return signupCompleted || window.localStorage.getItem(SIGNUP_KEY) === 'true'; } catch { return signupCompleted; } }
function sharedIntent(): AuthUser['onboardingIntent'] { try { const value = window.localStorage.getItem(INTENT_KEY); return value === 'ENTERPRISE' || value === 'RETAILER' || value === 'ENTREPRENEUR' ? value : savedIntent; } catch { return savedIntent; } }
export function currentMockUser(): AuthUser { return { ...mockUser, onboardingIntent: readMockConfig().persona === 'NEW_USER' ? sharedIntent() : mockUser.onboardingIntent }; }
export function saveMockIntent(intent: AuthUser['onboardingIntent']): void { savedIntent = intent; try { if (intent) window.localStorage.setItem(INTENT_KEY, intent); else window.localStorage.removeItem(INTENT_KEY); } catch { /* In-memory fixture fallback. */ } }
export function completeMockSignup(): void { signupCompleted = true; try { window.localStorage.setItem(SIGNUP_KEY, 'true'); } catch { /* In-memory fixture fallback. */ } }
export function resetMockSignup(): void { signupCompleted = false; savedIntent = null; try { window.localStorage.removeItem(SIGNUP_KEY); window.localStorage.removeItem(INTENT_KEY); } catch { /* In-memory fixture fallback. */ } }
export const MOCK_BUSINESS_ID = '11111111-1111-4111-8111-111111111111';
type WorkspaceBusiness = SessionContext['businesses'][number];
const business: WorkspaceBusiness = { id: MOCK_BUSINESS_ID, name: 'Lagos Cotton Studio', type: 'ENTERPRISE' };
export const mockUser: AuthUser = {
  id: '22222222-2222-4222-8222-222222222222', email: 'ada@example.test', firstName: 'Ada', lastName: 'Okafor', phone: '08031234567', status: 'ACTIVE', onboardingIntent: 'ENTERPRISE', emailVerifiedAt: '2026-10-01T09:00:00.000Z', phoneVerifiedAt: null, createdAt: '2026-10-01T09:00:00.000Z', updatedAt: '2026-10-01T09:00:00.000Z',
};
const allProductPermissions = ['product:read', 'product:write', 'pricing:set', 'product:publish'] as const;
/** Fixture membership labels select server-like grants; application authorization never reads these labels. */
export function mockSession(): SessionContext {
  const config = readMockConfig();
  const effectivePersona: MockPersona = config.persona === 'NEW_USER' && sharedSignupCompleted() ? 'OWNER' : config.persona;
  const permissions: Record<MockPersona, SessionContext['permissions']> = {
    OWNER: [...allProductPermissions], MANAGER: ['product:read', 'product:write', 'product:publish'], STAFF: ['product:read'], ADMIN: ['supplier:review'], NEW_USER: [],
  };
  const isAdmin = config.persona === 'ADMIN';
  const isNew = config.persona === 'NEW_USER' && !sharedSignupCompleted();
  return {
    platformRole: isAdmin ? 'ADMIN' : 'USER', permissions: permissions[effectivePersona],
    features: isAdmin ? ['admin-supplier-review'] : isNew ? [] : ['supplier-workspace', 'product-catalogue'],
    businesses: isAdmin || isNew ? [] : [business], activeBusiness: isAdmin || isNew ? null : business,
    supplierStatus: isAdmin || isNew ? null : config.supplierStatus,
  };
}
const timestamp = '2026-10-20T09:00:00.000Z';
function product(id: string, name: string, sku: string, basePriceKobo: number, status: Product['status']): Product {
  return { id, businessId: MOCK_BUSINESS_ID, name, description: 'A sample product supplied by this MSW fixture.', category: 'Clothing', defaultVariant: { sku, basePriceKobo }, status, pricingRule: { maxMarkupKobo: null }, publishedAt: status === 'PUBLISHED' ? timestamp : null, createdAt: timestamp, updatedAt: timestamp };
}
export function initialProducts(): Product[] {
  return [
    product('33333333-3333-4333-8333-333333333331', 'Everyday cotton shirt', 'COTTON-001', 850000, 'DRAFT'),
    product('33333333-3333-4333-8333-333333333332', 'Indigo tote bag', 'TOTE-002', 450050, 'PUBLISHED'),
    product('33333333-3333-4333-8333-333333333333', 'Classic bucket hat', 'HAT-003', 350000, 'ARCHIVED'),
  ];
}
export function initialSuppliers(): SupplierDetail[] {
  const statuses: SupplierStatus[] = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED', 'DRAFT'];
  return statuses.map((status, index) => ({
    id: `44444444-4444-4444-8444-44444444444${index}`, businessName: ['Lagos Cotton Studio', 'Abuja Home Goods', 'Kano Leather Works', 'Enugu Textiles', 'Jos Craft Co'][index]!,
    ownerName: ['Ada Okafor', 'Musa Bello', 'Amina Yusuf', 'Chidi Eze', 'Zainab Ahmed'][index]!, ownerPhone: `0803123456${index}`, ownerEmail: `owner${index}@example.test`, description: 'Independent Nigerian maker supplying quality products to retailers.',
    submittedAt: status === 'DRAFT' ? null : timestamp, status, plan: status === 'APPROVED' ? 'ENTERPRISE' : null,
    auditHistory: status === 'DRAFT' ? [] : [{ id: `55555555-5555-4555-8555-55555555555${index}`, action: 'SUBMITTED', actorName: 'Business owner', fromStatus: 'DRAFT', toStatus: 'PENDING_REVIEW', reason: null, createdAt: timestamp }],
  }));
}
