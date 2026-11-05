# Frontend–Backend Contract Audit & Sync Plan

- **Date:** 2026-11-05
- **Branch:** `arena/f0a51168-sellonit-v1` (fast-forwarded from `origin/arena/3c3d93ab-sellonit-v1` at `f689d3d2`, which merges `main` backend Phase 2 onto the frontend workspace)
- **Scope:** Read-only audit of `apps/api`, `apps/api/prisma`, `docs/openapi.yaml`, `packages/shared`, and `apps/web`, followed by the prioritized frontend-only sync plan.

---

## Step 0 — Baseline Health Record (Pre-Change)

| Check | Command | Baseline Result on `f689d3d2` |
| --- | --- | --- |
| Dependencies | `npm install` | **PASS** (641 packages installed) |
| Prisma client + TypeScript | `PRISMA_SCHEMA_ENGINE_BINARY=/bin/true npm run typecheck` (`npx tsc --noEmit` across workspaces) | **PASS** (0 errors across `@sellonit/shared`, `@sellonit/config`, `@sellonit/queue`, `@sellonit/api`, `@sellonit/web`, `@sellonit/worker`) |
| OpenAPI generated types | `npm run check:api-types` | **PASS** (`packages/shared/src/api.d.ts` matches `docs/openapi.yaml`) |
| Lint | `npm run lint` | **PASS** (0 errors, 0 warnings) |
| Tests | `npm test` | **FAIL (2 failed / 384 total)** — `@sellonit/api`: 19/19 passed; `@sellonit/web`: 363/365 passed, **2 failed** in `apps/web/src/components/onboarding/CreateBusinessForm.test.tsx:32,90,112` because the test fixture still sets `onboardingIntent: 'ENTERPRISE'` after `BusinessType` narrowed to `'RETAILER' \| 'SUPPLIER'` (`apps/web/src/lib/onboarding/roleApi.ts:17-20`), causing `roleForBusinessType` to return `undefined` and `canCreateBusiness` to block submission with the coming-soon gate |

---

## Backend Inventory & `docs/openapi.yaml` vs Implementation Drift

### Live Express Mounts (`apps/api/src/main.ts:15-19`)

Only four routers and one standalone route are mounted in `apps/api`:

| Mounted Path (`/api/v1/*`) | Route & Handler | Auth | Documented in `docs/openapi.yaml`? | Code vs `openapi.yaml` Drift |
| --- | --- | --- | --- | --- |
| `GET /api/v1/health` | `health.routes.ts:6` → `health.ts:10-14` (`liveCheck`) | Public | Yes (`openapi.yaml:83-94`) | **Drift:** Handler returns `{ status: 'ok' }`; `HealthResponse` (`openapi.yaml:3395-3402`) requires `[status, service, timestamp]`. |
| `GET /api/v1/health/ready` | `health.routes.ts:7` → `health.ts:21-24` (`readinessCheck`) | Public | Yes (`openapi.yaml:95-106`) | **Drift:** Handler returns `{ status: 'api is ready' }` without DB/Redis checks; `HealthResponse` enum allows only `'ok' \| 'ready'` and requires `service` + `timestamp`. |
| `POST /api/v1/auth/register` | `auth.routes.ts:19` → `auth.handlers.ts:132-149` (`registerHandler`) | Public | Yes (`openapi.yaml:108-137`) | **Drift:** Creates `User` with `status: 'ACTIVE'` (`schema.prisma:26`); `UserStatus` in `openapi.yaml:2756` includes `'PENDING_VERIFICATION'` (absent in `schema.prisma:39-43`). In `development`/`test`, adds undocumented top-level `emailVerificationToken` (`auth.handlers.ts:144-146`). Returns `400 VALIDATION_ERROR` (not documented on `/auth/register`). |
| `POST /api/v1/auth/login` | `auth.routes.ts:20` → `auth.handlers.ts:151-169` (`loginHandler`) | Public | Yes (`openapi.yaml:191-206`) | **Drift:** Handler sets `sellonit_access_token` `HttpOnly` cookie and returns `{ user, expiresIn }` (`auth.handlers.ts:165`), omitting `accessToken` from JSON body; `AuthResponse` (`openapi.yaml:3168-3175`) marks `accessToken` as `required`. Spec also omits `400 VALIDATION_ERROR` and `403 EMAIL_NOT_VERIFIED` / `403 ACCOUNT_UNAVAILABLE` (`auth.service.ts:265-272`). |
| `GET /api/v1/auth/me` | `auth.routes.ts:21` → `auth.handlers.ts:171-185` (`meHandler`) | `requireAuth` | **No** (`openapi.yaml:208-229` only documents `PATCH /auth/me`) | **Drift:** Mounted at both `GET /api/v1/auth/me` (`auth.routes.ts:21`) and `GET /api/v1/me` (`main.ts:17`). `publicUserSelect` (`auth.service.ts:14-26`) returns `phone` and `phoneVerifiedAt`, which are missing from `User` in `openapi.yaml:2835-2849`. |
| `GET /api/v1/me` | `main.ts:17` → `auth.handlers.ts:171-185` (`meHandler`) | `requireAuth` | Yes (`openapi.yaml:356-366`) | Same `User` field drift (`phone`, `phoneVerifiedAt` returned by code, absent in `User` schema). |
| `PATCH /api/v1/auth/me` | `auth.routes.ts:22` → `auth.handlers.ts:187-202` (`updatePhoneHandler`) | `requireAuth` | Yes (`openapi.yaml:208-229`) | Aligned (`{ phone } -> { data: User }`). |
| `PUT /api/v1/auth/business-intent` | `auth.routes.ts:23` → `auth.handlers.ts:204-226` (`setBusinessIntentHandler`) | `requireAuth` | Yes (`openapi.yaml:368-390`) | Aligned (`{ businessType: 'RETAILER' \| 'SUPPLIER' } -> { data: User }`). |
| `POST /api/v1/auth/verify-email-and-login` | `auth.routes.ts:24` → `auth.handlers.ts:228-251` (`verifyEmailAndLoginHandler`) | Public | Yes (`openapi.yaml:162-189`) | **Drift:** Same `AuthResponse.accessToken` omission (`auth.handlers.ts:247` returns `{ user, expiresIn }` + `Set-Cookie`). |
| `POST /api/v1/auth/verify-email` | `auth.routes.ts:25` → `auth.handlers.ts:253-264` (`verifyEmailHandler`) | Public | Yes (`openapi.yaml:139-160`) | **Drift:** Handler returns `{ data: { verified: true } }` (`auth.handlers.ts:260`); `openapi.yaml:152` specifies `ApiResponseUser` (`{ data: User }`). |
| `GET /api/v1/auth/verify-email/:token` | `auth.routes.ts:26` → `auth.handlers.ts:253-264` (`verifyEmailHandler`) | Public | **No** | Undocumented convenience GET route. |
| `POST /api/v1/auth/send-phone-verification` | `auth.routes.ts:27` → `auth.handlers.ts:279-290` (`sendPhoneVerificationHandler`) | Public | Yes (`openapi.yaml:231-252`) | Aligned (`{ email } -> { data: { sent: true } }`). |
| `POST /api/v1/auth/verify-phone` | `auth.routes.ts:28` → `auth.handlers.ts:266-277` (`verifyPhoneHandler`) | Public | Yes (`openapi.yaml:254-273`) | Aligned (`{ token } -> { data: { verified: true } }`). |
| `POST /api/v1/auth/forgot-password` | `auth.routes.ts:29` → `auth.handlers.ts:292-302` (`forgotPasswordHandler`) | Public | Yes (`openapi.yaml:304-319`) | Returns `202 { data: { sent: true } }`; note `auth.service.ts:185` returns `404 USER_NOT_FOUND` for unknown emails (anti-enumeration note in `openapi.yaml:305` claims generic acceptance). |
| `POST /api/v1/auth/verification-codes/verify` | `auth.routes.ts:30` → `auth.handlers.ts:304-315` (`verifyResetCodeHandler`) | Public | Yes (`openapi.yaml:321-337`) | Handler accepts `{ identifier, code }` or `{ email, code }`; spec documents `{ email, code }`. |
| `POST /api/v1/auth/reset-password` | `auth.routes.ts:31` → `auth.handlers.ts:317-338` (`resetPasswordHandler`) | Public | Yes (`openapi.yaml:339-354`) | Aligned (`{ email, code, password } -> 200 { data: { message } }`). |
| `GET /api/v1/businesses` | `business.routes.ts:10` → `businesses.handlers.ts:91-98` (`listBusinessesHandler`) | `requireAuth` | Yes (`openapi.yaml:432-443`) | **Drift:** Returns `{ data: BusinessWithMemberships[] }` with **no `meta`** (`PaginationMeta` omitted), includes `ownerId` + `memberships[]` (undocumented on `Business` at `openapi.yaml:2851-2866`), and omits `activeSubscription` / `plan`. |
| `POST /api/v1/businesses` | `business.routes.ts:11` → `businesses.handlers.ts:20-89` (`createBusinessHandler`) | `requireAuth` | Yes (`openapi.yaml:444-456`) | **Drift:** Accepts `type` or `businessType` (`businesses.handlers.ts:32`), creates `Membership(OWNER)` + `BusinessSubscription(Plan='ENTERPRISE')` (`businesses.handlers.ts:79-84`), ignores `Idempotency-Key`, and omits `requestId` on `400` errors (`businesses.handlers.ts:36-60`). |
| `GET /api/v1/supplier/profile` | `supplier.routes.ts:11` → `supplier.handlers.ts:72-84` (`getSupplierProfileHandler`) | `requireAuth` | Yes (`openapi.yaml:392-403`) | Returns `{ data: SupplierProfile }` or synthetic `{ data: { businessId, status: 'DRAFT' } }` (`supplier.handlers.ts:79`) when no row exists yet (`id`, `retailerAccess`, `createdAt`, `updatedAt` absent until first `PUT`). |
| `PUT /api/v1/supplier/profile` | `supplier.routes.ts:12` → `supplier.handlers.ts:86-103` (`upsertSupplierProfileHandler`) | `requireAuth` | Yes (`openapi.yaml:404-417`) | Accepts any JSON for `originLocation` (`supplier.handlers.ts:20-23`), whereas `openapi.yaml:2893` types `originLocation` as `Address`. |
| `POST /api/v1/supplier/profile/submit` | `supplier.routes.ts:13` → `supplier.handlers.ts:105-126` (`submitSupplierProfileHandler`) | `requireAuth` | Yes (`openapi.yaml:419-430`) | Sets `status: 'PENDING_REVIEW'` and `submittedAt: new Date()`; returns `400 PROFILE_REQUIRED` if never saved via `PUT`. |
| `GET /api/v1/supplier/:businessId/profile` | `supplier.routes.ts:14` → `supplier.handlers.ts:72-84` (`getSupplierProfileHandler`) | `requireAuth` | **No** (wrong path in spec) | **Drift:** `openapi.yaml:541-568` documents `/businesses/{businessId}/supplier-profile` (`GET`, `PUT`), which is **not mounted**; code mounts `/supplier/:businessId/profile` instead. |
| `PUT /api/v1/supplier/:businessId/profile` | `supplier.routes.ts:15` → `supplier.handlers.ts:86-103` (`upsertSupplierProfileHandler`) | `requireAuth` | **No** (wrong path in spec) | Same path drift (`/supplier/:businessId/profile` mounted vs `/businesses/{businessId}/supplier-profile` in spec). |
| `POST /api/v1/supplier/:businessId/profile/submit` | `supplier.routes.ts:16` → `supplier.handlers.ts:105-126` (`submitSupplierProfileHandler`) | `requireAuth` | **No** | Mounted in `supplier.routes.ts:16`, completely absent from `docs/openapi.yaml`. |

**Global Server Prefix Drift:** `docs/openapi.yaml:42-48` sets server URLs to `/v1` (`http://localhost:4000/v1`), whereas `apps/api/src/main.ts:15-19` mounts all routes at `/api/v1/*` and `apps/web/next.config.ts:24-28` proxies `/api/v1/:path*` → `${API_PROXY_TARGET}/api/v1/:path*`.

**Empty Backend Module Stubs (`.gitkeep` only):** `apps/api/src/modules/{analytics,catalogue,commerce,fulfillment,logistics,notifications,payments,stores,supplier-products,users}` contain no TypeScript files; `apps/api/src/modules/orders/lifecycle.ts` is pure domain transition logic with no Prisma model or HTTP routes.

---

## Section A — Backend Has It, Frontend Doesn't Use It or Uses It Wrongly

### Summary Classification

#### (1) Frontend Uses Correctly
- `POST /api/v1/auth/register` (`apps/web/src/lib/auth/api.ts:63-67`, `authService.ts:73-96`): splits `fullName` into `{ firstName, lastName }`, normalizes email, maps `409 EMAIL_ALREADY_EXISTS`.
- `POST /api/v1/auth/login` (`apps/web/src/lib/auth/api.ts:89-93`, `authService.ts:109-121`): sends `{ email, password }`, accepts `{ user, expiresIn }` + `HttpOnly` cookie, maps `401 INVALID_CREDENTIALS`, `403 EMAIL_NOT_VERIFIED`, `403 ACCOUNT_UNAVAILABLE`.
- `POST /api/v1/auth/verify-email-and-login` (`apps/web/src/lib/auth/api.ts:80-87`, `VerifyEmailConfirm.tsx:107`): exchanges email token for verified session + cookie.
- `GET /api/v1/auth/me` & `PATCH /api/v1/auth/me` (`apps/web/src/lib/auth/api.ts:95-103`, `AccountPanel.tsx:41-55`): reads current user and updates phone (`+234` normalization).
- `PUT /api/v1/auth/business-intent` (`apps/web/src/lib/onboarding/roleApi.ts:28-36`): sends `{ businessType: 'RETAILER' | 'SUPPLIER' }` and updates `onboardingIntent`.
- `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/verification-codes/verify`, `POST /api/v1/auth/reset-password` (`apps/web/src/lib/auth/api.ts:105-125`, `authService.ts:163-218`): aligned with backend payloads and status codes.
- `GET /api/v1/me` (`apps/web/src/lib/workspace/api.ts:8-11`): used for lightweight auth confirmation.

#### (2) Frontend Uses With a Mismatch (Fixable in Frontend)
- `GET /api/v1/businesses` (`apps/web/src/lib/business/businessesApi.ts:12-56`): stale `BusinessType` (`'ENTERPRISE'`/`'ENTREPRENEUR'` instead of `'SUPPLIER'`) and stale `BusinessRole` (`'OWNER' | 'ADMIN' | 'MEMBER'` instead of `'OWNER' | 'MANAGER' | 'STAFF'`), dropping `status` (`'ACTIVE' | 'SUSPENDED'`) and ignoring subscription/plan metadata.
- Business creation & signup-completion preflight (`apps/web/src/lib/onboarding/businessApi.ts:60-68`, `apps/web/src/lib/auth/useSignupCompletion.ts:20-26`, `CreateBusinessForm.tsx:125-145`): calls unimplemented `GET /session/context` (`404`) and `POST /onboarding/businesses` (`404`) instead of `GET /businesses` + `POST /businesses` + `PUT /supplier/:businessId/profile`; also breaks "Add business" when the user already owns a business.
- Tenancy transport (`apps/web/src/lib/api-client.ts:115-116`, `apps/web/src/lib/business/activeBusiness.ts:12`): sends `X-Business-Id` header, which no backend route reads, instead of passing `:businessId` in supplier route paths / bodies.
- Error parsing & error-to-state mapping (`apps/web/src/lib/api-client.ts:60-99`, `apps/web/src/lib/dashboard/access.ts:22-31`, `apps/web/src/lib/workspace/errors.ts:5-23`): checks `'UNAUTHENTICATED'` and `'VALIDATION_FAILED'` instead of backend's `'UNAUTHORIZED'` and `'VALIDATION_ERROR'`; misses `'NOT_A_SUPPLIER'`, `'BUSINESS_REQUIRED'`, `'PROFILE_REQUIRED'`, and `'ACCOUNT_UNAVAILABLE'`; does not distinguish Express's HTML `Cannot <METHOD> /api/v1/...` 404 (unimplemented endpoint) from resource 404s.
- Root session bootstrap (`apps/web/src/app/layout.tsx:30-46`): performs a raw `fetch` inside an app layout file instead of keeping HTTP calls inside `apps/web/src/lib/`.
- Unconditional `/session/context` query (`apps/web/src/lib/auth/AuthSessionProvider.tsx:136-143`): fires `GET /api/v1/session/context` (`404`) on every authenticated page load across the entire app.

#### (3) Frontend Doesn't Use at All (Needs Wiring)
- `GET /api/v1/supplier/:businessId/profile` (and `GET /api/v1/supplier/profile`) — `supplier.routes.ts:11,14`, `supplier.handlers.ts:72-84`.
- `PUT /api/v1/supplier/:businessId/profile` (and `PUT /api/v1/supplier/profile`) — `supplier.routes.ts:12,15`, `supplier.handlers.ts:86-103`.
- `POST /api/v1/supplier/:businessId/profile/submit` (and `POST /api/v1/supplier/profile/submit`) — `supplier.routes.ts:13,16`, `supplier.handlers.ts:105-126`.
- `POST /api/v1/businesses` — `business.routes.ts:11`, `businesses.handlers.ts:20-89` (bypassed in favor of unimplemented `POST /onboarding/businesses`).
- `GET /api/v1/health`, `GET /api/v1/health/ready`, `POST /api/v1/auth/send-phone-verification`, `POST /api/v1/auth/verify-phone` — ops/verification endpoints not currently surfaced in UI flows (no UI change needed unless phone verification screen is added).

---

### Detailed Audit of Required Section A Areas

#### A.1 Supplier Endpoints (`supplier.routes.ts`) vs Frontend Supplier Setup, Profile, and Progress
- **Backend implementation (`apps/api/src/http/routes/supplier.routes.ts:10-16`, `apps/api/src/modules/suppliers/supplier.handlers.ts:6-126`, `apps/api/prisma/schema/schema.prisma:119-141`):**
  - Supports reading (`GET`), upserting (`PUT`), and submitting for review (`POST .../submit`) a business's `SupplierProfile` (`legalName`, `description`, `contactPhone`, `originLocation`, `retailerAccess`, `status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'`, `submittedAt`).
  - Both implicit (`/supplier/profile`, `/supplier/profile/submit`) and explicit business-scoped (`/supplier/:businessId/profile`, `/supplier/:businessId/profile/submit`) routes are mounted.
  - Before the first `PUT`, `GET` returns `{ data: { businessId, status: 'DRAFT' } }` (`supplier.handlers.ts:79`). Submitting before saving returns `400 PROFILE_REQUIRED` (`supplier.handlers.ts:119-123`).
- **Frontend current behavior:**
  - Zero calls to `/supplier/profile` or `/supplier/:businessId/profile` exist anywhere in `apps/web/src/`.
  - `/dashboard/business-profile` (`SUPPLIER_SETUP_STEPS[1].href` at `apps/web/src/lib/onboarding/supplierSetup.ts:40`) falls into the catch-all placeholder `apps/web/src/app/dashboard/[...section]/page.tsx:31-35` (`"Business Profile is not available yet"`).
  - `useSupplierSetupProgress` (`apps/web/src/lib/onboarding/supplierSetup.ts:99-115`) reads only `sessionStorage` (`sellonit_onboarding_business`) for Step 1 (`business-information`) and relies on unimplemented `GET /supplier/dashboard` for Steps 2–6. Consequently:
    1. Logging in on a fresh browser/session where a supplier business already exists in PostgreSQL shows **0 of 6 steps completed (0%)** instead of recognizing Step 1 (`business-information`) from `GET /businesses`.
    2. Step 2 (`supplier-profile`) can never be completed or reflected in setup progress.

#### A.2 Business Types, Business Roles, and Subscriptions (`20261105000000_business_types_and_subscriptions`)
- **Backend implementation (`apps/api/prisma/migrations/20261105000000_business_types_and_subscriptions/migration.sql:1-91`, `schema.prisma:65-117,183-235`):**
  - `BusinessType` is `'RETAILER' | 'SUPPLIER'` (`ENTREPRENEUR` and `ENTERPRISE` were migrated to `RETAILER` and `SUPPLIER` respectively at `migration.sql:8-15`).
  - `BusinessRole` on `Membership` is `'OWNER' | 'MANAGER' | 'STAFF'` (`ADMIN` → `MANAGER`, `MEMBER` → `STAFF` at `migration.sql:36-43`).
  - `Plan` (`key: 'ENTERPRISE' | 'ENTERPRISE_PLUS'`), `PlanTransition`, `SubscriptionStatus` (`'ACTIVE' | 'CANCELLED' | 'EXPIRED'`), and `BusinessSubscription` are live in PostgreSQL. `POST /businesses` automatically creates an `ACTIVE` `BusinessSubscription` connected to `Plan(key: 'ENTERPRISE')` (`businesses.handlers.ts:80-84`).
  - **Backend omission (`BE-004`):** Neither `createBusinessHandler` (`businesses.handlers.ts:85`) nor `listBusinessesHandler` (`businesses.handlers.ts:94`) includes `activeSubscription: { include: { plan: true } }` in its Prisma `include`.
- **Frontend mismatch (`apps/web/src/lib/business/businessesApi.ts:12-56`, `BusinessProvider.tsx:95-99`):**
  - `BusinessMembershipRole` (`businessesApi.ts:12`) is hand-typed as `'OWNER' | 'ADMIN' | 'MEMBER'`. `normalizeRole` (`businessesApi.ts:25-28`) silently downgrades backend `'MANAGER'` and `'STAFF'` to `'MEMBER'`.
  - `businessTypeLabel` (`businessesApi.ts:44-49`) checks `'ENTERPRISE'` and `'ENTREPRENEUR'`, so a real `'SUPPLIER'` business renders raw `"SUPPLIER · Owner"` instead of `"Supplier · Owner"` in `BusinessSwitcher` (`apps/web/src/components/dashboard/BusinessSwitcher.tsx:46,79`).
  - `BusinessProvider` (`apps/web/src/lib/business/BusinessProvider.tsx:69-72`) defaults `activeBusiness` to `businesses[0]` without preferring `type === 'SUPPLIER'` in the supplier dashboard, and `businessesApi.ts` drops `business.status` (`'ACTIVE' | 'SUSPENDED'`) and optional `plan`/`activeSubscription`.

#### A.3 Business Creation and "My Businesses" (`businesses.handlers.ts`)
- **Backend implementation (`apps/api/src/modules/businesses/businesses.handlers.ts:20-98`):**
  - `POST /api/v1/businesses` accepts `{ name, type?, businessType?, phone?, email? }`, creates `Business` + `Membership(OWNER)` + `BusinessSubscription(ENTERPRISE)`, and returns `201 { data: business }`.
  - `GET /api/v1/businesses` returns `200 { data: businesses }` with `memberships: Membership[]` for all businesses where `req.userId` has a membership.
- **Frontend mismatch:**
  - `apps/web/src/lib/onboarding/businessApi.ts:60-68` calls `POST /api/v1/onboarding/businesses` (`404 Not Found` at runtime).
  - `apps/web/src/lib/auth/useSignupCompletion.ts:21-25` calls `GET /api/v1/session/context` (`404 Not Found` at runtime). In `CreateBusinessForm.tsx:125-127`, that failed preflight sets `formError = 'We could not confirm sign-up. Check your connection and retry.'` and aborts `handleSubmit`, **completely blocking business creation**.
  - Even once `useSignupCompletion` is switched to `GET /businesses`, clicking **"Add business"** in `BusinessSwitcher.tsx:87-91` routes to `/auth/create-business`; if the user already has one business, an unconditional `confirmOnServer()` check would treat `businesses.length > 0` as "already finished sign-up in another tab" and redirect to `/dashboard/overview` instead of creating the second business.

#### A.4 Tenancy: Active Business Identification
- **Frontend assumption:** Stores `sellonit.active-business` in `localStorage` (`apps/web/src/lib/business/activeBusiness.ts:4,12`) and attaches `X-Business-Id: <id>` to every `apiFetchResponse` (`apps/web/src/lib/api-client.ts:115-116`) and `XMLHttpRequest` upload (`apps/web/src/lib/products/productsApi.ts:116-117`).
- **Backend reality:** Zero files in `apps/api` read `X-Business-Id`. `supplier.handlers.ts:38-58` (`businessIdForRequest`) resolves the business strictly from:
  1. `req.params.businessId` (`/api/v1/supplier/:businessId/profile`, `/api/v1/supplier/:businessId/profile/submit`), else
  2. `req.body.businessId` (only available on `PUT` / `POST`), else
  3. The user's oldest (`orderBy: { createdAt: 'asc' }`) `SUPPLIER` membership with `role in ['OWNER', 'MANAGER']`.
  - Without `:businessId` in the URL, a multi-business user who switches to Business #2 in `BusinessSwitcher` would still read/mutate Business #1 on `/api/v1/supplier/profile`!
  - Note also a backend authorization gap (`BE-004`): when `businessId` is passed in `req.params.businessId`, `supplier.handlers.ts:41` calls `requireBusinessMembership` (allowing `STAFF` to `PUT` and `submit`), whereas `tenant.repository.ts:13-19` defines `requireOwnedBusiness` (`OWNER | MANAGER`) which is currently unused.

#### A.5 Auth Middleware (`401` vs `403`) & Frontend Error-to-State Mapping
- **Backend (`apps/api/src/http/middleware/auth.middleware.ts:30-83`, `tenant.repository.ts:4-19`, `supplier.handlers.ts:38-69`):**
  - `requireAuth`: missing/invalid/expired/revoked cookie or bearer token → `401 { error: { code: 'UNAUTHORIZED', message: 'Authentication required', requestId } }`.
  - `requirePermission`: missing `req.userId` → `401 UNAUTHORIZED`; missing global `UserRoleAssignment` permission → `403 { error: { code: 'FORBIDDEN', message: 'Permission denied' } }` (not currently attached to any route).
  - `requireBusinessMembership`: user is not a member of `businessId` (including non-existent/deleted business IDs) → `403 { error: { code: 'FORBIDDEN', message: 'You do not have access to this business' } }`.
  - `supplier.handlers.ts`: business is `RETAILER` → `403 NOT_A_SUPPLIER`; user has no supplier business → `400 BUSINESS_REQUIRED`; submitting unsaved profile → `400 PROFILE_REQUIRED`.
  - `auth.service.ts`: unverified login → `403 EMAIL_NOT_VERIFIED`; suspended/deactivated user → `403 ACCOUNT_UNAVAILABLE`; deleted user on `/auth/me` → `404 USER_NOT_FOUND`.
- **Frontend mappers (`apps/web/src/lib/dashboard/access.ts:22-31`, `apps/web/src/lib/workspace/errors.ts:5-23`):**
  - `presentError` (`workspace/errors.ts:10,14`) checks `'UNAUTHENTICATED'` and `'VALIDATION_FAILED'` instead of `'UNAUTHORIZED'` and `'VALIDATION_ERROR'`, and has no cases for `'NOT_A_SUPPLIER'`, `'BUSINESS_REQUIRED'`, `'PROFILE_REQUIRED'`, or `'ACCOUNT_UNAVAILABLE'`.
  - `mapDashboardError` (`dashboard/access.ts:22-31`) maps HTTP status codes (`401`, `403`, `404/410`, `5xx`), missing `400 BUSINESS_REQUIRED` → `'no-business'` and `403 NOT_A_SUPPLIER` → `'business-unavailable'` / `'page-forbidden'`, and `useDashboardAccess.ts:26-34` does not check `activeBusiness.status === 'SUSPENDED'` or `activeBusiness.type !== 'SUPPLIER'`.

#### A.6 Auth & Onboarding Changes (`roleApi.ts`, `authEndpoints.ts`, Tests)
- `apps/web/src/lib/onboarding/roleApi.ts:10-36`: Correctly maps UI roles `entrepreneur` and `retailer` → `'RETAILER'`, `supplier` → `'SUPPLIER'`, and sends `PUT /auth/business-intent` with `{ businessType }`.
- `apps/web/src/lib/auth/authEndpoints.ts:36-43`: Path table matches mounted `/auth/*` routes except `logout: '/auth/logout'` (`404` on backend, `BE-001`) and `resendVerification: '/auth/resend-verification'` (`404` on backend, `BE-008`). Note stale comment on lines 41–42 claiming logout treats `404` as success while `authService.ts:138-145` intentionally throws so an `HttpOnly` cookie session is never falsely shown as signed out.
- **Test coverage audit after merge `f689d3d2`:**
  - Updated in `f689d3d2`: `roleApi.test.ts`, `authDestination.test.ts`, `postAuthDestination.test.ts`, `LoginForm.test.tsx`, `onboardingScreens.test.tsx`, `AuthenticatedAuthRouteGate.test.tsx`, `DashboardRoute.test.tsx`, `verify-email/page.test.tsx`.
  - **Missed and broken / stale:** `CreateBusinessForm.test.tsx:32,36,65` (uses `'ENTERPRISE'`, failing 2 tests), `businessesApi.test.ts` (tests `'ENTERPRISE'`, `'ENTREPRENEUR'`, `'ADMIN'`, `'MEMBER'` instead of `'SUPPLIER'`, `'MANAGER'`, `'STAFF'`).

#### A.7 Seed Data (`apps/api/prisma/seed.ts`)
Running `npm run db:seed` (`apps/api/prisma/seed.ts:39-118`) creates:
1. **Roles (`Role`):** `ADMIN`, `OWNER`, `SUPPLIER`, `RETAILER` (`seed.ts:14-19,40-43`).
2. **Permissions (`Permission`):** `admin:read`, `admin:write`, `business:write`, `supplier_profile:write` (`seed.ts:21-26,45-48`) — **assigned only to `ADMIN`** via `RolePermission` (`seed.ts:51-66`); `OWNER`, `SUPPLIER`, and `RETAILER` receive zero `RolePermission` rows.
3. **Subscription Plans (`Plan` & `PlanTransition`):** `ENTERPRISE` ("Enterprise") and `ENTERPRISE_PLUS` ("Enterprise_plus"), plus transition `ENTERPRISE -> ENTERPRISE_PLUS` (`seed.ts:68-91`). Note: `Plan(key='ENTERPRISE')` is **mandatory** for `POST /api/v1/businesses` (`businesses.handlers.ts:82`) to succeed.
4. **Seeded User Account (1 total, `seed.ts:28-36,93-117`):**
   - **Email:** `admin@sellonit.local` (overridable via `ADMIN_EMAIL`)
   - **Password:** `ChangeMe123!` (overridable via `ADMIN_PASSWORD`)
   - **State:** `status: 'ACTIVE'`, `emailVerifiedAt: <now>`, `onboardingIntent: null`, global `UserRoleAssignment` → `ADMIN`, **0 businesses**, **0 memberships**, **0 supplier profiles**.
- **Missing seed accounts (`BE-011`):** No pre-seeded Supplier (`DRAFT` / `PENDING_REVIEW` / `APPROVED` / `REJECTED`), Multi-business user, `MANAGER` / `STAFF` member, Retailer, Unverified user, or Suspended user. Logging in as `admin@sellonit.local` routes to `/auth/role-selection` because `onboardingIntent` is `null`.

#### A.8 Error Response Shape & Validation Error Format
- **Backend error shapes:**
  - `auth.handlers.ts:41-43` & `auth.middleware.ts:37-42,52-58`: `{ error: { code, message, requestId } }`.
  - `auth.middleware.ts:68,79`, `businesses.handlers.ts:36-60`, `supplier.handlers.ts:61-68`: `{ error: { code, message } }` (**omits `requestId`**).
  - Validation errors return HTTP **`400`** with `code: 'VALIDATION_ERROR'` and a single human-readable `message` string — never HTTP `422` and never `error.fields` or `error.details[]`.
  - Unmatched routes fall through Express 5's default handler (`apps/api/src/main.ts:15-21`), returning HTTP `404` with `Content-Type: text/html; charset=utf-8` (`<!DOCTYPE html>...Cannot GET /api/v1/...`).
- **Frontend `api-client.ts:60-99`:** Parses `{ error: { code, message, requestId, fields, details } }` safely, tolerating missing `requestId`, but collapses Express HTML `404` responses (`Cannot GET /api/v1/...`) into `ApiError(404, null, 'We could not complete that request. Please try again.')`, making unimplemented endpoints indistinguishable from missing resources (`ProductFormPage.tsx:161`).

#### A.9 Pagination, Filtering, and Sorting Conventions
- **Backend reality:** Zero implemented routes paginate, filter, or sort. `GET /api/v1/businesses` (`businesses.handlers.ts:91-98`) returns `{ data: businesses }` with no `meta` object and no `orderBy`.
- **`docs/openapi.yaml` vs `productsApi.ts`:**
  - `openapi.yaml:2520-2531,3404-3411` standardizes `page` (1-based), `pageSize` (default 20, max 100), `search` (string), uppercase `status` (`DRAFT | PUBLISHED | UNPUBLISHED | ARCHIVED`), `categoryId`, `inStock` (boolean), and `{ data: T[], meta: { page, pageSize, total, totalPages } }`.
  - `apps/web/src/lib/products/productsApi.ts:39-48` sends `page`, `pageSize` (10), `q` (instead of `search`), lowercase `status` (`draft | published`), `category`, and `stock` (`in-stock | low-stock | out-of-stock`).

---

## Section B — Frontend Built It, Backend Doesn't Have It (`BE-001` – `BE-013`)

### Verification Summary of Prompted Frontend Areas
- **Products module (`/dashboard/products`, `/dashboard/products/new`, `/dashboard/products/[id]/edit`):** **0% implemented on backend.** `apps/api/src/modules/supplier-products/` has only `.gitkeep`; Prisma has no product/category/inventory/upload tables (`BE-002`).
- **Product list filters (`q`, `category`, `stock`, status tabs, summary counts):** **0% implemented on backend** (`BE-002`).
- **Supplier dashboard & setup progress (`GET /supplier/dashboard`, 5 vs 6 steps):** `GET /supplier/dashboard` is **not implemented** (`BE-003`). Backend has no step-count constant (neither 5 nor 6); however, Steps 1 (`business-information`) and 2 (`supplier-profile`) **can** now be derived from real `GET /businesses` + `GET /supplier/:businessId/profile`, while Steps 3–6 (`product-catalogue`, `inventory`, `pricing`, `website`) await backend modules (`BE-002`, `BE-003`, `BE-012`).
- **Business switching, "Add business", business status, and page permissions:**
  - Business list (`GET /businesses`) and creation (`POST /businesses`) **exist** and work once wired; active business selection is client-stored (`localStorage`) and must be passed via `:businessId` path/body (`BE-004` for unified tenancy + plan/status exposure).
  - `Business.status` (`ACTIVE | SUSPENDED`) is returned by `GET /businesses` (needs frontend mapping), while backend does not yet block `SUSPENDED` businesses in handlers (`BE-004`).
  - Role-based permission grants are not exposed via API (`GET /session/context` is `404`, `BE-005`).
- **Notifications, Profile menu, Logout, "Join an existing business":**
  - Notifications bell (`DashboardShell.tsx:388-395`) has a hardcoded unread orange dot and no click handler; `/notifications` is unimplemented (`BE-010`).
  - Profile menu Logout (`DashboardShell.tsx:218-281` → `authService.ts:138-145`) calls `POST /api/v1/auth/logout`, which is **unimplemented (`404`)**, preventing cookie sign-out (`BE-001`).
  - "Join an existing business" (`CreateBusinessForm.tsx:271-283`) shows a coming-soon banner; invite/join endpoints do not exist (`BE-009`).
- **Create Business fields (`name`, `phone`, `email`, `description`):**
  - `name`, `phone`, `email` → **stored** on `Business` (`businesses.handlers.ts:69-78`, `schema.prisma:67,77-78`).
  - `description` → **ignored** by `POST /businesses`, **but stored** on `SupplierProfile.description` via `PUT /api/v1/supplier/:businessId/profile` (`supplier.handlers.ts:6-12,92-96`, `schema.prisma:132`). For `RETAILER` businesses, no `RetailerProfile` table/route exists yet (`BE-012`).
- **Local-only state, mock leftovers, or hardcoded stand-ins:**
  - MSW and mock product fixtures were already removed (`docs/frontend-api-readiness.md`).
  - Remaining stand-ins in `apps/web`:
    1. `sellonit_onboarding_business` in `sessionStorage` (`flowState.ts:20-36`, `supplierSetup.ts:99-115`) standing in for server business membership in setup progress.
    2. Hardcoded unread notification dot (`bg-primary`) on the header bell button (`DashboardShell.tsx:394`).
    3. `AuthSessionProvider.tsx:136-143` firing unimplemented `GET /session/context` on every authenticated session.
    4. `NON_SUPPLIER_BUSINESS_CREATION_ENABLED = false` (`businessApi.ts:20`) gating non-supplier business creation until Retailer workspace exists (`BE-012`).

---

### Catalog of Missing Backend Capabilities (`BE-001` – `BE-013`)

#### `BE-001` — Session Logout Endpoint (`POST /api/v1/auth/logout`)
- **Frontend call site:** `apps/web/src/lib/auth/api.ts:127-129`, `apps/web/src/lib/auth/authService.ts:138-145`, triggered from `DashboardShell.tsx:223-233` (`ProfileMenu`) and `AccountPanel.tsx:62-72`.
- **Assumed contract:** `POST /api/v1/auth/logout` (authenticated via `sellonit_access_token` cookie) → `204 No Content`, revoking the `Session` row (`revokedAt = now()`) and clearing `sellonit_access_token` (`res.clearCookie('sellonit_access_token', { path: '/' })`).
- **Runtime result today:** Express returns `404 Not Found` (`text/html`). Because `sellonit_access_token` is `HttpOnly`, browser JS cannot clear it; `logout()` throws and `ProfileMenu` displays `"Could not sign out. Try again."`
- **Recommended backend contract:** Implement `POST /api/v1/auth/logout` in `auth.routes.ts` matching `docs/openapi.yaml:296-302`: revoke session token if present, clear `sellonit_access_token` cookie unconditionally (idempotent `204` even if already expired/missing).

#### `BE-002` — Supplier Products Module (CRUD, Publish/Unpublish, Categories, Image Uploads, Summary)
- **Frontend call sites:** `apps/web/src/lib/products/productsApi.ts:39-145`, `queries.ts:15-103`, `ProductsListPage.tsx`, `ProductFormPage.tsx`, `ProductImageUploader.tsx`.
- **Assumed endpoints & payloads:**
  - `GET /api/v1/supplier/products?page=&pageSize=&status=&q=&category=&stock=` → `{ items/data, page, pageSize, total, totalPages }`
  - `GET /api/v1/supplier/products/summary` → `{ totalProducts, publishedCount, draftCount, outOfStockCount }`
  - `GET /api/v1/supplier/products/:id` → `{ data: SupplierProduct }`
  - `POST /api/v1/supplier/products` → `{ name, description, category, sku?, wholesalePrice, stockQuantity, status: 'draft' | 'published', imageIds }`
  - `PATCH /api/v1/supplier/products/:id`, `DELETE /api/v1/supplier/products/:id`
  - `POST /api/v1/supplier/products/:id/publish`, `POST /api/v1/supplier/products/:id/unpublish`
  - `GET /api/v1/supplier/categories` → `{ data: { id, name }[] }`
  - `POST /api/v1/supplier/uploads/product-images` (`multipart/form-data`, `file`) & `DELETE /api/v1/supplier/uploads/product-images/:id`
- **Runtime result today:** All 10 endpoints return `404 Not Found`. `/dashboard/products` renders an error state; `/dashboard/products/[id]/edit` misinterprets any `404` as `"This product is no longer available"` (`ProductFormPage.tsx:161,203-216`).
- **Recommended backend contract:** Reconcile the 3-way contract split (`openapi.yaml` `/supplier-products` vs `openapi.yaml` `PROPOSED` `/supplier/products` vs `productsApi.ts`) into business-scoped `/api/v1/supplier/:businessId/products*` (or `/api/v1/supplier/products*` honoring `:businessId` / `X-Business-Id`), integer kobo money fields, and `PaginationMeta`.

#### `BE-003` — Supplier Dashboard Overview & Authoritative Setup Progress
- **Frontend call sites:** `apps/web/src/lib/dashboard/supplierDashboard.ts:80-86`, `useSupplierDashboard.ts:18-36`, `SupplierDashboardOverview.tsx`, `DashboardShell.tsx:336-339`.
- **Assumed contract:** `GET /api/v1/supplier/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` (business-scoped) → `{ metrics: { totalRevenue, activeOrders, connectedRetailers, productsListed }, revenueSeries, topProducts, orderStatus, recentOrders, setup: { completedStepIds } }`.
- **Runtime result today:** Returns `404 Not Found`; `SupplierDashboardOverview` renders an error alert with Retry.
- **Recommended backend contract:** Implement `GET /api/v1/supplier/:businessId/dashboard?from=&to=` returning zeroed metrics for newly created supplier businesses plus server-computed `setup.completedStepIds` (confirming canonical 5- vs 6-step list).

#### `BE-004` — Unified Business Tenancy, Business Detail/Update, Status Enforcement & Subscription Exposure
- **Frontend call sites:** `apps/web/src/lib/business/businessesApi.ts:30-41`, `BusinessProvider.tsx`, `api-client.ts:115-116`, `supplierSetup.ts`.
- **Assumed contract:** Business-scoped requests resolve the active business consistently; `GET /businesses` exposes each business's active subscription plan (`ENTERPRISE | ENTERPRISE_PLUS`) and supplier profile status; `OWNER` and `MANAGER` (not `STAFF`) can mutate/submit supplier profiles; `SUSPENDED` businesses cannot mutate resources.
- **Runtime result today:** `X-Business-Id` is ignored; `GET /businesses` omits `activeSubscription` and `meta`; `GET/PATCH /businesses/:businessId` (`openapi.yaml:458-484`) return `404`; `supplier.handlers.ts:41` allows `STAFF` to `PUT`/submit when `:businessId` is in path; `openapi.yaml:541-568` documents `/businesses/{businessId}/supplier-profile` while `supplier.routes.ts:14-16` mounts `/supplier/:businessId/profile`.
- **Recommended backend contract:** Include `activeSubscription: { select: { status: true, plan: { select: { key: true, name: true } } } }` and `orderBy: { createdAt: 'asc' }` in `businesses.handlers.ts`, enforce `requireOwnedBusiness` on `PUT`/`submit` in `supplier.handlers.ts`, block `SUSPENDED` businesses with `403 BUSINESS_SUSPENDED`, and align `openapi.yaml` paths with `/supplier/:businessId/profile`.

#### `BE-005` — Workspace Session Context & Role Permission Grants
- **Frontend call sites:** `apps/web/src/lib/workspace/api.ts:4-6`, `AuthSessionProvider.tsx:136-143`, `PermissionGuard.tsx`, `BusinessProvider.tsx:95-99`.
- **Assumed contract:** `GET /api/v1/session/context` (`openapi.yaml:1857-1869`) or per-membership `permissions: string[]` + `features: string[]` on `GET /businesses` + `platformRole` on `GET /auth/me`.
- **Runtime result today:** `GET /session/context` returns `404` on every authenticated page load; `seed.ts:51-66` seeds permissions only for `ADMIN`.
- **Recommended backend contract:** Either implement `GET /api/v1/session/context` per `openapi.yaml:1857-1869` or include `platformRoles` on `/auth/me` and `permissions` + `plan` on `GET /businesses`, seeding `RolePermission` grants for `OWNER`, `MANAGER`, and `STAFF`.

#### `BE-006` — Admin Supplier Review Queue & Moderation Actions (`/api/v1/admin/suppliers*`)
- **Frontend call sites:** `apps/web/src/lib/workspace/adminApi.ts:7-32`, `WorkspaceRoute.tsx`, `SupplierQueue.tsx`, `SupplierReview.tsx` (`/admin/suppliers`, `/admin/suppliers/[id]`).
- **Assumed contract:** `GET /api/v1/admin/suppliers?status=&search=&page=&pageSize=`, `GET /api/v1/admin/suppliers/:id`, and `POST /api/v1/admin/suppliers/:id/{approve,reject,suspend,reinstate}` (`openapi.yaml:1886-1913`).
- **Runtime result today:** Blocked first by `404` on `GET /session/context` in `WorkspaceRoute.tsx:28`, and all `/admin/suppliers*` endpoints also return `404`. Also note enum mismatch: `SupplierProfileStatus` (`schema.prisma:119-124`) has `DRAFT | PENDING_REVIEW | APPROVED | REJECTED`, while `SupplierReviewStatus` (`openapi.yaml:2589`) adds `SUSPENDED` (which lives on `Business.status` in Prisma).
- **Recommended backend contract:** Mount `/api/v1/admin/suppliers*` guarded by `requireAuth` + `requirePermission('admin:read' / 'admin:write')`, updating `SupplierProfile.status`, `Business.status`, and `BusinessSubscription.planId` (`ENTERPRISE` / `ENTERPRISE_PLUS`) with audit events.

#### `BE-007` — JSON 404 Catch-All, Standard Error Envelope (`requestId` + Field Errors), and `openapi.yaml` Sync
- **Frontend call sites:** `apps/web/src/lib/api-client.ts:60-99`, all form error handlers (`CreateBusinessForm.tsx`, `RegisterForm.tsx`, `ProductFormPage.tsx`).
- **Runtime result today:** Unmatched `/api/v1/*` paths return Express HTML `404`; `businesses.handlers.ts` and `supplier.handlers.ts` omit `requestId` and per-field `details`; `docs/openapi.yaml` has multiple drifts listed in the table above.
- **Recommended backend contract:** Add a `/api/v1` catch-all middleware returning `404 { error: { code: 'NOT_FOUND', message: 'Route not found', requestId } }`, include `requestId` + `details: [{ field, code, message }]` on validation errors, and update `docs/openapi.yaml` + regenerate `packages/shared/src/api.d.ts`.

#### `BE-008` — Resend Verification Email & Session Refresh (`POST /auth/resend-verification`, `POST /auth/refresh`)
- **Frontend call sites:** `apps/web/src/lib/auth/api.ts:69-77`, `apps/web/src/app/auth/verify-email/page.tsx:167`.
- **Runtime result today:** `resendVerification` rejects locally with an honest error because no backend endpoint exists; `POST /auth/refresh` (`openapi.yaml:275-294`) is unmounted.
- **Recommended backend contract:** Implement rate-limited `POST /api/v1/auth/resend-verification` (`{ email } -> 202 { data: { sent: true } }`) issuing a fresh `EMAIL` `VerificationToken` via Resend.

#### `BE-009` — Join an Existing Business & Team Member Invitations
- **Frontend call sites:** `apps/web/src/components/onboarding/CreateBusinessForm.tsx:271-283`.
- **Runtime result today:** Displays non-blocking `JOIN_COMING_SOON_MESSAGE`.
- **Recommended backend contract:** Implement `/api/v1/businesses/:businessId/members*` (`openapi.yaml:486-539`) plus an invite-token acceptance endpoint (`POST /api/v1/business-invites/accept`).

#### `BE-010` — In-App Notifications (`GET /api/v1/notifications`, `POST /api/v1/notifications/:id/read`)
- **Frontend call sites:** `apps/web/src/components/dashboard/DashboardShell.tsx:388-395`.
- **Runtime result today:** Static bell icon with hardcoded unread indicator dot and no endpoint.
- **Recommended backend contract:** Implement `/api/v1/notifications` and `/api/v1/notifications/:id/read` (`openapi.yaml:1661-1683`) with unread count in `meta`.

#### `BE-011` — Comprehensive Development Seed Fixtures (`apps/api/prisma/seed.ts`)
- **Frontend need:** Immediate manual/automated QA of Supplier Setup (`DRAFT` vs `PENDING_REVIEW` vs `APPROVED`), Business Switcher (multi-business), Role permissions (`OWNER` vs `MANAGER` vs `STAFF`), and Retailer/Unverified/Suspended edge cases without manual DB setup.
- **Runtime result today:** Only `admin@sellonit.local` (no businesses) is seeded.
- **Recommended backend contract:** Gate dev demo accounts behind `NODE_ENV !== 'production'` (or `npm run db:seed:dev`) in `seed.ts`.

#### `BE-012` — Retailer Onboarding & Remaining Supplier Workspace Sections (`Inventory`, `Pricing`, `Website`, `Orders`, `Wallet`)
- **Frontend call sites:** `apps/web/src/lib/onboarding/businessApi.ts:20` (`NON_SUPPLIER_BUSINESS_CREATION_ENABLED`), `apps/web/src/app/dashboard/[...section]/page.tsx`.
- **Runtime result today:** Retailer/Entrepreneur business creation shows a coming-soon gate; non-Overview/Products/Profile sidebar links render `PlaceholderWorkspace`.
- **Recommended backend contract:** Implement `/retailer/profile`, `/stores`, `/inventory`, `/pricing`, `/orders`, and `/settlements` per roadmap phases.

#### `BE-013` — Google/Apple OAuth & Phone-Identifier Login / Password Reset
- **Frontend call sites:** `SignupMethodChooser.tsx:22-23`, `LoginForm.tsx:234-252`, `authService.ts:109-111,163-165`.
- **Runtime result today:** OAuth buttons are `aria-disabled="true"`; phone login/reset returns explicit `'phone-login-unsupported'` message.
- **Recommended backend contract:** Add OAuth callback routes or remove from v1 scope; extend login/reset to look up verified `User.phone` + SMS OTP if phone sign-in is required.

---

## Section C — Contract Mismatches Table

| Feature | Frontend Assumption | Backend Reality | Which Side Changes | Severity |
| --- | --- | --- | --- | --- |
| Signup preflight on Role Selection & Create Business | Calls `GET /api/v1/session/context` (`useSignupCompletion.ts:22`) | `/session/context` is unimplemented (`404`); `CreateBusinessForm.tsx:125` aborts submission | **Frontend** (use `GET /businesses` + handle `mode=add`) | **Blocking** |
| Create Business endpoint & payload | Calls `POST /api/v1/onboarding/businesses` with `{ name, phone, email, description, accountType }` (`businessApi.ts:61`) | Implements `POST /api/v1/businesses` (`{ name, type, phone, email }`) + `PUT /api/v1/supplier/:businessId/profile` (`{ legalName, description, contactPhone }`) | **Frontend** | **Blocking** |
| Add second business from Business Switcher | Navigates to `/auth/create-business` where `confirmOnServer()` treats any existing business as duplicate-tab completion | `POST /api/v1/businesses` allows creating multiple businesses per user | **Frontend** (`?mode=add` + active-business switch) | **Blocking** |
| Global session context query | `AuthSessionProvider.tsx:136` calls `GET /api/v1/session/context` on every authenticated load | Unimplemented (`404`), leaving `workspaceStatus = 'error'` everywhere | **Frontend** (stop unconditional query) + **Backend (`BE-005`)** | **Blocking** (for `/admin/*`) / **Degraded** (global 404 noise) |
| Logout | Calls `POST /api/v1/auth/logout` (`authService.ts:138`) to clear `HttpOnly` cookie | Unimplemented (`404`); cookie cannot be cleared by JS | **Backend (`BE-001`)** + **Frontend** (honest error message) | **Blocking** |
| Products module (list, create, edit, delete, publish, images, categories) | Calls `/api/v1/supplier/products*`, `/categories`, `/uploads/product-images` (`productsApi.ts`) | Unimplemented (`404`); no Product tables in Prisma | **Backend (`BE-002`)** + **Frontend** (honest unavailable state instead of fake "deleted product" on edit 404) | **Blocking** |
| Supplier Profile & Step 2 setup progress | Never calls `/supplier/:businessId/profile`; `/dashboard/business-profile` shows "not available yet"; progress reads `sessionStorage` only | `GET/PUT /api/v1/supplier/:businessId/profile` and `POST .../submit` are live in `supplier.routes.ts:11-16` | **Frontend** (wire profile read/upsert/submit + derive Steps 1 & 2 from server) | **Blocking** |
| Active business tenancy | Sends `X-Business-Id` header (`api-client.ts:115`) | Ignores `X-Business-Id`; `supplier.handlers.ts:39` reads `:businessId` param or `body.businessId`, else oldest supplier business | **Frontend** (pass `:businessId` in supplier profile paths/bodies + cache keys) & **Backend (`BE-004`)** | **Blocking** (multi-business) |
| `BusinessType` enum & labels | `businessesApi.ts:17,45` & `CreateBusinessForm.test.tsx:32` expect `'ENTERPRISE' \| 'ENTREPRENEUR' \| 'RETAILER'` | `BusinessType` is `'RETAILER' \| 'SUPPLIER'` (`schema.prisma:108`) | **Frontend** | **Degraded** (renders raw `"SUPPLIER"` + 2 failing tests) |
| `BusinessRole` enum & permissions | `businessesApi.ts:12,25` expects `'OWNER' \| 'ADMIN' \| 'MEMBER'` | `Membership.role` is `'OWNER' \| 'MANAGER' \| 'STAFF'` (`schema.prisma:113`); backend treats `OWNER \| MANAGER` as managers (`supplier.handlers.ts:52`) | **Frontend** (use `UserRole` from `@sellonit/shared`, map labels & permissions) | **Degraded** (`MANAGER` downgraded to `'MEMBER'`) |
| Business subscription & status | `businessesApi.ts` drops `status` and ignores `plan` | `POST /businesses` creates `BusinessSubscription(ENTERPRISE)` (not yet included in `GET /businesses` JSON); returns `status: 'ACTIVE' \| 'SUSPENDED'` | **Frontend** (parse `status` + optional `plan`/`activeSubscription`, gate `SUSPENDED`) + **Backend (`BE-004`)** | **Degraded** |
| Supplier Dashboard Overview | Calls `GET /api/v1/supplier/dashboard?from=&to=` (`supplierDashboard.ts:80`) | Unimplemented (`404`) | **Backend (`BE-003`)** + **Frontend** (honest unavailable state when endpoint returns Express 404) | **Degraded** |
| Error code & Express HTML 404 mapping | `workspace/errors.ts` checks `UNAUTHENTICATED` / `VALIDATION_FAILED`; `api-client.ts` treats HTML 404 same as JSON 404 | Backend sends `UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_A_SUPPLIER`, `BUSINESS_REQUIRED`, `PROFILE_REQUIRED`, and HTML `Cannot <METHOD> /api/v1/...` on missing routes | **Frontend** + **Backend (`BE-007`)** | **Degraded** |
| Notifications bell | Shows permanent orange unread dot (`DashboardShell.tsx:394`) with dead click | `/notifications` is unimplemented (`404`) | **Frontend** (remove fake unread dot; show honest coming-soon state) + **Backend (`BE-010`)** | **Cosmetic / Trust** |
| Root layout session fetch | Raw `fetch` in `apps/web/src/app/layout.tsx:38` | Works via Next rewrite, but lives outside `src/lib/` API layer | **Frontend** (extract to `src/lib/auth/serverSession.ts`) | **Cosmetic / Architecture** |

---

## Prioritized Sync Plan

### Group (1) — Frontend Can Fix Right Now Against the Current Backend (`apps/web` only)
1. **API Client & Error Layer (`api-client.ts`, `dashboard/access.ts`, `workspace/errors.ts`, `auth/serverSession.ts`):**
   - Detect Express's unimplemented-route HTML 404 (`Cannot <METHOD> /api/v1/...`) as `code: 'ENDPOINT_NOT_IMPLEMENTED'` so missing backend modules never impersonate deleted domain records or leak HTML.
   - Align error mappers with real backend codes (`UNAUTHORIZED`, `VALIDATION_ERROR`, `NOT_A_SUPPLIER`, `BUSINESS_REQUIRED`, `PROFILE_REQUIRED`, `ACCOUNT_UNAVAILABLE`).
   - Move `readInitialSession` out of `app/layout.tsx` into `src/lib/auth/serverSession.ts` so all HTTP calls live strictly in the API layer.
2. **Auth, Business Creation, Business Switcher & Tenancy (`auth/types.ts`, `AuthSessionProvider.tsx`, `useSignupCompletion.ts`, `businessesApi.ts`, `BusinessProvider.tsx`, `businessApi.ts`, `CreateBusinessForm.tsx`, `BusinessSwitcher.tsx`):**
   - Replace duplicate hand-written request/role/business types with `@sellonit/shared` schema types (`UserRole`, `BusinessType`, `PlanKey`, `CreateBusinessRequest`, `UpsertSupplierProfileRequest`, `SupplierProfile`, etc.).
   - Stop firing `GET /session/context` unconditionally on every authenticated page load in `AuthSessionProvider`.
   - Switch `useSignupCompletion` from `GET /session/context` to `GET /businesses`, and support `?mode=add` from `BusinessSwitcher` so existing users can create additional businesses and immediately switch into the newly created business.
   - Switch `businessApi.createBusiness` from `POST /onboarding/businesses` to `POST /businesses`, and for `SUPPLIER` businesses persist `legalName`, `contactPhone`, and `description` via `PUT /supplier/:businessId/profile`.
   - Fix `businessesApi.ts` to use `'RETAILER' | 'SUPPLIER'` and `'OWNER' | 'MANAGER' | 'STAFF'`, preserve `status` (`'ACTIVE' | 'SUSPENDED'`) and optional `plan`, prefer an active `SUPPLIER` business by default in `BusinessProvider`, and surface `'business-unavailable'` / `'page-forbidden'` when a business is `SUSPENDED` or non-supplier.
   - Fix `CreateBusinessForm.test.tsx` and update `businessesApi.test.ts` / `BusinessSwitcher` / onboarding tests.
3. **Supplier Profile & Real Setup Progress (`lib/supplier/supplierProfileApi.ts`, `onboarding/supplierSetup.ts`, `dashboard/business-profile/page.tsx`, `SupplierSetupScreen.tsx`, `DashboardShell.tsx`):**
   - Create `supplierProfileApi.ts` wrapping `GET /supplier/:businessId/profile`, `PUT /supplier/:businessId/profile`, and `POST /supplier/:businessId/profile/submit` (scoping React Query keys by `businessId` and clearing on business switch).
   - Wire `/dashboard/business-profile` so suppliers can view/save their real `SupplierProfile` (`legalName`, `description`, `contactPhone`, `originLocation`, `retailerAccess`) and submit it for review (`DRAFT -> PENDING_REVIEW`), displaying the real `SupplierProfileStatus`.
   - Derive Step 1 (`business-information`) from persisted `activeBusiness` (with local draft fallback only before query resolution) and Step 2 (`supplier-profile`) from the persisted `SupplierProfile` (`status !== 'DRAFT'` / submitted or completed profile), updating both the sidebar setup widget and `/dashboard/supplier-setup` from 0% → 17% → 33% against the live API.
4. **Honest States for Unimplemented Modules (`DashboardShell.tsx`, `SupplierDashboardOverview.tsx`, `ProductsListPage.tsx`, `ProductFormPage.tsx`, `WorkspaceRoute.tsx`):**
   - Remove the fake unread dot on the Notifications bell and show a clear "Notifications are coming soon" state with `TODO(BE-010)`.
   - Surface clear, non-deceptive "not available yet" / error states with `TODO(BE-001)`, `TODO(BE-002)`, `TODO(BE-003)`, `TODO(BE-005)`, and `TODO(BE-006)` when logout, products, dashboard analytics, or admin supplier review hit `ENDPOINT_NOT_IMPLEMENTED`.

### Group (2) — Blocked on Backend Work (`docs/backend-handoff.md`)
- `BE-001` (P0): `POST /api/v1/auth/logout` cookie + session revocation.
- `BE-002` (P0): Supplier Products CRUD, publish/unpublish, categories, image uploads, and summary counts.
- `BE-003` (P1): Supplier Dashboard Overview metrics & server-computed setup step IDs.
- `BE-004` (P1): Unified business tenancy + `activeSubscription`/`plan` in `GET /businesses` + `requireOwnedBusiness` on supplier profile mutations + `SUSPENDED` enforcement.
- `BE-005` (P1): `GET /api/v1/session/context` / role permission grants.
- `BE-006` (P1): Admin supplier review queue & moderation endpoints (`/api/v1/admin/suppliers*`).
- `BE-007` (P1): JSON 404 middleware, standardized `requestId` + field validation errors, and `docs/openapi.yaml` drift fixes.
- `BE-008`–`BE-013` (P2–P3): Resend verification, join existing business, notifications, dev seed accounts, retailer/storefront modules, and OAuth/phone login.

### Group (3) — Product / Contract Decisions & Conservative Defaults Chosen for Phase 2
1. **Supplier Setup step count (5 vs 6 steps) & Step 2 completion rule:**
   - *Decision needed:* Whether `website` (Step 6) applies to all suppliers or only `ENTERPRISE_PLUS` B2C plans, and whether Step 2 (`supplier-profile`) completes on draft save (`PUT`) vs review submission (`POST .../submit`).
   - *Conservative Phase 2 choice:* Keep the existing 6-step `SUPPLIER_SETUP_STEPS` list unchanged so UI copy stays stable, and mark Step 2 (`supplier-profile`) complete once the supplier profile has been submitted for review (`status === 'PENDING_REVIEW' || status === 'APPROVED'`).
2. **`MANAGER` vs `OWNER` client-side permission fallback (`BusinessProvider.can`):**
   - *Decision needed:* Exact permission matrix between `OWNER`, `MANAGER`, and `STAFF` once `BE-005` lands (`delete` vs `write` vs `read`).
   - *Conservative Phase 2 choice:* Mirror `apps/api/src/modules/tenancy/tenant.repository.ts:15` (`['OWNER', 'MANAGER']`) for supplier management actions (`product:read`, `product:write`, `product:publish`), keeping `product:delete` restricted to `'OWNER'` and `'STAFF'` read-only (`product:read`) until server permission grants (`BE-005`) are exposed.
3. **Products contract shape (`openapi.yaml` `/supplier-products` vs `PROPOSED` `/supplier/products` vs `productsApi.ts`):**
   - *Decision needed:* Canonical URL prefix, money unit (integer kobo vs decimal NGN), and embedded vs separate inventory/pricing endpoints (`BE-002`).
   - *Conservative Phase 2 choice:* Keep `productsApi.ts` isolated in `src/lib/products/`, align shared pagination types with `@sellonit/shared`, pass active `businessId` cleanly, and render an honest unavailable banner when the API returns `ENDPOINT_NOT_IMPLEMENTED` (`404`).
4. **Switching to a `RETAILER` business inside the Supplier Dashboard:**
   - *Decision needed:* Whether `/dashboard/*` will eventually host both Retailer and Supplier workspaces or redirect Retailers to a dedicated `/retailer/*` app.
   - *Conservative Phase 2 choice:* Prefer a `SUPPLIER` business as the default active business when available; if the user explicitly switches to a `RETAILER` business, surface an honest "Retailer workspace is coming soon — switch to a supplier business" access state instead of letting `/supplier/:businessId/profile` fail with raw `403`.
