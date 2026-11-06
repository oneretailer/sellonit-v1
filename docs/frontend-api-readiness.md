> **⚠️ Superseded in part (2026-11-05).** All mocks (MSW handlers/scenarios,
> `MockProvider`/`MockControls`, `auth.mock.ts`, `mockServiceWorker.js`, the
> `NEXT_PUBLIC_API_MOCK` flag and the msw dev dependency) have been **removed**
> at the product owner's request, and the supplier Products module was rebuilt
> at `/dashboard/products` — see `docs/products-module.md` for the current
> state. Sections below that describe MSW, mock controls, the local business
> adapter or `app/products/**` components are historical. The endpoint
> contract, transport, auth and OpenAPI notes remain accurate.

# Sellonit frontend API-readiness handoff

Scope: frontend only (`apps/web`, generated shared API types, additive OpenAPI proposals, root npm metadata/lockfile and `.env.example`). No backend implementation, database migration, or Next.js API route was added. The existing `/api/v1/*` rewrite in `apps/web/next.config.ts` is unchanged.

## 1. Reuse inventory and decisions

### Reused unchanged where possible

- Auth/onboarding UI primitives: `AuthCard`, `AuthPage`, `TextField`, `InlineError`, `PrimaryButton`, `SecondaryButton`, `Spinner`, field style helpers, existing validation/phone/email helpers, `flowState`, `roleApi`, `RequireAuthenticatedSession`, `AuthenticatedAuthRouteGate`.
- Dashboard shell/navigation and the single setup-progress source (`supplierSetup`, six steps, completed ÷ 6). The shell gained only workspace/admin variants and product/admin navigation entries.
- Existing same-origin transport and error envelope in `lib/api-client.ts`; existing cookie session provider and `authDestination` decision. The typed client wraps this transport instead of introducing a second URL/error stack.
- Existing email-verification BroadcastChannel name and storage key. `verificationSignal.ts` remains the public compatibility facade.
- Existing OpenAPI generator/check scripts and `components.parameters.IdempotencyKey`.

### Necessary extensions to existing files

- `lib/api-client.ts`: header merging now uses `Headers`, preserving `Headers` instances supplied by `openapi-fetch` (notably `Idempotency-Key`); additive 422 `error.details[]` field extraction.
- `lib/auth/AuthSessionProvider.tsx`: adds server-resolved workspace context, `can()`, `hasFeature()`, `refreshWorkspace()` while preserving login/session behavior.
- `lib/auth/authDestination.ts`: `/products` and `/admin` join the authenticated destination family; no role-name authorization was introduced.
- `lib/onboarding/businessApi.ts`: default adapter is now the typed HTTP adapter. The local adapter remains exported for legacy tests/reference only and is not selected. A local setup draft is written only after server success.
- `CreateBusinessForm`, `RoleSelectionForm`, `RoleRecommendation`: server preflight, completion lock/notice, idempotent submit, and cross-tab completion. Role save + navigation are committed in one React transition to avoid the old role-selection guard bouncing an already-onboarded user to Overview.
- `SupplierDashboardOverview`/`supplierDashboard`: money is documented and formatted as integer kobo through the shared money helper; no fake dashboard metrics were introduced.
- `apps/web/next.config.ts`: Turbopack explicitly resolves MSW 3’s browser entry because its package export maps `msw/browser` to `null` under Node/SSR conditions. The worker is still imported only in a browser effect behind `NEXT_PUBLIC_API_MOCK=true`. Proxy/security/StrictMode/typedRoutes behavior is otherwise unchanged.

### New frontend modules

- Typed client/foundation: `lib/api.ts`, `lib/money.ts`, `lib/providers/QueryProvider.tsx`, `lib/workspace/*`.
- Shared workspace UI: `components/workspace/*` (route guard, permission/feature guards, state panels, status banner/chip, confirmation dialog, toast, pagination, mock controls/provider, test utilities).
- Admin: `app/admin/suppliers/**`, `components/admin/SupplierQueue.tsx`, `SupplierReview.tsx`.
- Products: `app/products/**`, `components/products/ProductList.tsx`, `ProductForm.tsx`, `ProductEditor.tsx`, `PublishControls.tsx`.
- Cross-tab signup: `lib/auth/crossTab.ts`, `useSignupCompletion.ts`, `components/auth/SignupCompletionNotice.tsx`.
- MSW: `src/mocks/{scenarios,data,handlers,browser,server}.ts`, generated `public/mockServiceWorker.js`.

## 2. Endpoint contract

All paths below are relative to the OpenAPI server base `/v1`; browser requests go to same-origin `/api/v1/...`. **PROPOSED** operations are additive, marked `x-contract-status: PROPOSED`, and require backend review/implementation. A programmatic comparison against `HEAD` confirmed **zero changed pre-existing operations**.

| Method/path                                              | Status       | Request                                                                                                      | Success response                                                                                                                                              |
| -------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /me`                                                | Existing     | cookie session                                                                                               | `{ data: AuthUser }`; used only to confirm identity, not capabilities                                                                                         |
| `GET /auth/me`                                           | Existing     | cookie session                                                                                               | `{ data: AuthUser }`; existing SSR/session hydration                                                                                                          |
| `PUT /auth/business-intent`                              | Existing     | `{ businessType: RETAILER \| ENTREPRENEUR \| ENTERPRISE }`                                                   | `{ data: AuthUser }` with saved `onboardingIntent`                                                                                                            |
| `GET /session/context`                                   | **PROPOSED** | cookie session                                                                                               | `{ data: WorkspaceSessionContext }`: `platformRole`, server `permissions[]`, `features[]`, `businesses[]`, `activeBusiness \| null`, `supplierStatus \| null` |
| `POST /onboarding/businesses`                            | **PROPOSED** | `Idempotency-Key`; `{ name, phone, email, description?, accountType: entrepreneur \| retailer \| supplier }` | `201 { data: Business }`; atomically creates business, owner membership and draft supplier profile for supplier                                               |
| `GET /admin/suppliers?status=&page=&pageSize=`           | **PROPOSED** | status defaults `PENDING_REVIEW`; page/pageSize                                                              | `{ data: AdminSupplierSummary[], meta: PaginationMeta }`; summary has business name, owner phone, submitted date, status                                      |
| `GET /admin/suppliers/{id}`                              | **PROPOSED** | supplier business id                                                                                         | `{ data: AdminSupplierDetail }` including owner contact, description, plan, status, immutable `auditHistory[]`                                                |
| `POST /admin/suppliers/{id}/approve`                     | **PROPOSED** | `{ plan: ENTERPRISE \| ENTERPRISE_PLUS }`                                                                    | `{ data: AdminSupplierDetail }`; only `PENDING_REVIEW → APPROVED`                                                                                             |
| `POST /admin/suppliers/{id}/reject`                      | **PROPOSED** | `{ reason: non-blank, max 2000 }`                                                                            | `{ data: AdminSupplierDetail }`; only `PENDING_REVIEW → REJECTED`                                                                                             |
| `POST /admin/suppliers/{id}/suspend`                     | **PROPOSED** | `{ reason: non-blank, max 2000 }`                                                                            | `{ data: AdminSupplierDetail }`; only `APPROVED → SUSPENDED`                                                                                                  |
| `POST /admin/suppliers/{id}/reinstate`                   | **PROPOSED** | no body                                                                                                      | `{ data: AdminSupplierDetail }`; only `SUSPENDED → APPROVED`                                                                                                  |
| `GET /supplier/products?search=&status=&page=&pageSize=` | **PROPOSED** | active business from session; optional status                                                                | `{ data: WorkspaceProduct[], meta: PaginationMeta }`                                                                                                          |
| `POST /supplier/products`                                | **PROPOSED** | `Idempotency-Key`; `{ name, description?, category, defaultVariant: { sku, basePriceKobo } }`                | `201 { data: WorkspaceProduct }`; server assigns business, `DRAFT`, uncapped pricing rule; no stock fields                                                    |
| `GET /supplier/products/{id}`                            | **PROPOSED** | product id                                                                                                   | `{ data: WorkspaceProduct }`                                                                                                                                  |
| `PATCH /supplier/products/{id}`                          | **PROPOSED** | at least one of name/description/category/defaultVariant                                                     | `{ data: WorkspaceProduct }`; archived products immutable                                                                                                     |
| `PUT /supplier/products/{id}/pricing-rule`               | **PROPOSED** | `{ maxMarkupKobo: integer ≥ 0 \| null }`                                                                     | `{ data: WorkspaceProduct }`; `null` = no ceiling, `0` = fixed base price                                                                                     |
| `POST /supplier/products/{id}/publish`                   | **PROPOSED** | no body                                                                                                      | `{ data: WorkspaceProduct }` with `PUBLISHED` and `publishedAt`; requires approved supplier                                                                   |
| `POST /supplier/products/{id}/unpublish`                 | **PROPOSED** | no body                                                                                                      | `{ data: WorkspaceProduct }` with `UNPUBLISHED`                                                                                                               |

`WorkspaceProduct` contains `id`, `businessId`, name/description/category, one `defaultVariant { sku, basePriceKobo }`, `status: DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED`, `pricingRule { maxMarkupKobo }`, nullable `publishedAt`, `createdAt`, `updatedAt`. Money is safe integer kobo (maximum `Number.MAX_SAFE_INTEGER`).

### Error mapping

The UI maps `UNAUTHENTICATED`, `FORBIDDEN`, `SUPPLIER_NOT_APPROVED`, `NOT_FOUND`, `VALIDATION_FAILED`, `INVALID_STATE_TRANSITION`, `DUPLICATE_SKU`, and `LIMIT_REACHED`. 422 field messages are placed beside the matching input (`defaultVariant.sku` → SKU, `defaultVariant.basePriceKobo` → base price, `maxMarkupKobo` → markup; admin `reason`/`plan` beside their dialog fields). State-transition conflicts refresh the affected row/product; supplier-not-approved refreshes session/banner. Hidden or disabled controls are cosmetic only—the backend must enforce the same grants and transitions.

### Contract conflicts deliberately not “fixed” by editing existing paths

- Existing `/supplier-products` is a different contract: flat SKU/categoryId, `Money { amount, currency }`, required inventoryCount, immutable SKU, `UNPUBLISHED`, and FLEXIBLE/FIXED_MSRP/MAP pricing. The requested no-stock/default-variant/maximum-markup screens therefore use additive `/supplier/products` proposals.
- Existing `POST /businesses` drops contact values in the current implementation; additive `/onboarding/businesses` preserves name/phone/email/description and account type.
- Existing `UserRole` lacks `MANAGER`; authorization uses server grants (`product:read/write`, `pricing:set`, `product:publish`, `supplier:review`), never membership role names. Persona labels in MSW only choose fixture grants.
- Existing `BusinessType` lacks `ENTERPRISE_PLUS`; supplier approval plans are a separate proposed `SupplierPlan` enum.
- `/me` does not expose capabilities; proposed `/session/context` supplies them. The only explicit role-name check is the requested platform-admin route exception `platformRole === 'ADMIN'`.

## 3. Running against mocks vs a real backend

### MSW mocks (no backend required)

```bash
npm install
NEXT_PUBLIC_API_MOCK=true npm run dev -w @sellonit/web
```

Open `/products`, `/products/new`, `/admin/suppliers`, or the signup flow. The bottom-left **API mocks** panel selects:

- Personas: `OWNER` (all product grants), `MANAGER` (read/write/publish, no pricing), `STAFF` (read only), `ADMIN` (supplier review), `NEW_USER` (no business until signup).
- Responses: `success`, `empty`, `401`, `403`, `404`, `409`, `422`, `slow` (~1.8 s).
- Supplier status: DRAFT/PENDING_REVIEW/APPROVED/REJECTED/SUSPENDED.

Selectors are tab-scoped (`sessionStorage`) and reload the tab. Product/admin fixture edits live in that tab’s worker. Mock signup completion/intent is shared across same-origin tabs through non-personal fixture flags so a second tab can confirm membership. Use **Reset mock signup** before repeating the NEW_USER flow. For two-tab tests, set the same persona in both tabs; new tabs do not inherit `sessionStorage`.

### Real backend

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_MOCK=false
API_INTERNAL_URL=http://localhost:4000   # or your API origin; no /v1 suffix
```

```bash
npm run dev -w @sellonit/web
```

Keep the legacy `NEXT_PUBLIC_MOCK_AUTH` off. The browser still calls only same-origin `/api/v1/*`; Next rewrites to the configured API. The proposed endpoints must be implemented and reviewed before the new screens will work against a real backend. After contract changes run:

```bash
npm run generate:api
npm run check:api-types
npm run validate:api
npm run build -w @sellonit/shared
```

## 4. Cross-tab signup semantics

One typed transport (`lib/auth/crossTab.ts`) preserves the original email-verified signal and adds `SIGNUP_COMPLETED { accountType }`. Messages contain only type, timestamp and account type—never tokens, email, phone or business data. BroadcastChannel is primary; localStorage/storage events are fallback; focus/visibility changes recheck the server. Listeners deduplicate, bound memory, close channels and unsubscribe cleanly under StrictMode.

A signal immediately locks onboarding inputs and shows the requested notice, but is only a hint: `GET /me` plus `/session/context` must confirm persisted membership before replacing the route with `/dashboard`. If the server says there is no business, inputs unlock; confirmation failures keep a retry path. Submit preflights membership, disables after click, and reuses a client-generated `Idempotency-Key` on retry. Successful signup refreshes workspace, navigates, then broadcasts.

## 5. Verification

- `npm run generate:api` + `npm run check:api-types`: generated types match the contract.
- `npm run validate:api`: valid OpenAPI; 201 pre-existing/style warnings, no errors.
- `npx eslint apps/web packages --max-warnings 0`: clean. (Root `npm run lint` still runs Prisma generation in `prelint` and is blocked by the environment’s TLS/database setup; unrelated API lint errors were not changed.)
- `npm run typecheck -w @sellonit/web`: clean.
- `npm test -w @sellonit/web`: **41 files / 374 tests passing**. Coverage includes exact money parsing/formatting, price preview, product Zod validation, admin transitions/publish availability, error mapping, permission guards, MSW permission/status/scenario matrix, cross-tab send/receive/unknown/cleanup, server-confirmed completion, preflight/idempotent signup, admin confirmation UI, product create/edit/duplicate SKU/archived/publish UI, and header preservation.
- `npm run build -w @sellonit/web`: production build passes with all admin/product routes.
- Chromium MSW smoke: product list/search/create/edit-context, duplicate-SKU placement, live exact preview, publish confirmation/chip, archived read-only, persona controls, admin default queue/approval/audit, all eight scenarios, admin no-access, two-tab signup redirect, and 390px no horizontal overflow. No application page errors (Next dev-only negative `performance.measure` timestamp noise excluded).

## 6. Dependencies, assumptions and remaining backend work

New exact dependencies: `openapi-fetch@0.17.0`, `@tanstack/react-query@5.106.1`, `react-hook-form@7.91.0`, `@hookform/resolvers@5.2.2`, `zod@4.6.7`; dev `msw@3.0.3`. No shadcn or other UI kit was added. MSW requires Node ≥22.12 (already the repo engine). The generated service worker is checked in at `apps/web/public/mockServiceWorker.js`; root `msw.workerDirectory` records it.

Assumptions for backend review:

1. `/session/context` is authoritative for active business, capabilities, features and supplier status; absent grants fail closed.
2. Supplier review id is the supplier business id; audit history is append-only and transitions are atomic.
3. Product SKU uniqueness is per business; create is idempotent per authenticated user + key; pricing replacement and publish/unpublish are atomic.
4. Signup completion means persisted business + owner membership, not `onboardingIntent` or a local draft. Backend should reject/resolve concurrent duplicate membership atomically.
5. Category is free text in the requested product form; no category-management endpoint was invented.
6. Non-supplier business creation remains behind the existing single `NON_SUPPLIER_BUSINESS_CREATION_ENABLED=false` flag; Join-existing remains a placeholder.

Security/tooling note: `npm audit` reports advisories in the existing dependency tree (including the repo’s Next.js 16.3.6 and tooling transitives). This frontend-only change did not perform a broad framework/tooling upgrade; review those advisories separately before deployment. The newly added web Zod version is 4.6.7.
