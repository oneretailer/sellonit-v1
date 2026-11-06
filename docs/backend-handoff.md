# Backend Handoff — Frontend–Backend Contract Alignment

- **Date:** 2026-11-05
- **Companion Audit:** [`docs/frontend-backend-sync-audit.md`](./frontend-backend-sync-audit.md)
- **Context:** `apps/web` has been synced against all currently mounted `/api/v1/*` routes in `apps/api` (`health`, `auth`, `me`, `businesses`, `supplier/profile`). Every item below is a self-contained backend task needed to unblock the remaining frontend flows without client workarounds.
- **Conventions:** All runtime paths below are mounted under `/api/v1` (`apps/api/src/main.ts:15-19`). After implementing or changing any contract, update `docs/openapi.yaml` and run `npm run generate:api-types` (`packages/shared/src/api.d.ts`).

---

## Priority Summary

| ID       | Priority | Area                   | Summary                                                                                                  |
| -------- | -------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `BE-001` | **P0**   | Auth / Session         | Implement `POST /api/v1/auth/logout` to revoke session and clear `HttpOnly` cookie                       |
| `BE-002` | **P0**   | Supplier Products      | Implement Supplier Products CRUD, publish/unpublish, categories, image uploads, and summary              |
| `BE-003` | **P1**   | Supplier Dashboard     | Implement `GET /api/v1/supplier/:businessId/dashboard` metrics + setup step completion                   |
| `BE-004` | **P1**   | Tenancy & Businesses   | Expose `activeSubscription`/`plan`, enforce `OWNER \| MANAGER` & `SUSPENDED` checks, unify tenancy       |
| `BE-005` | **P1**   | RBAC / Session Context | Implement `GET /api/v1/session/context` (or return role permission grants on `/businesses` + `/auth/me`) |
| `BE-006` | **P1**   | Admin Moderation       | Implement `/api/v1/admin/suppliers*` queue, detail, approve/reject/suspend/reinstate                     |
| `BE-007` | **P1**   | API & OpenAPI Hygiene  | Add JSON 404 catch-all, standardize `requestId` + field validation details, fix `openapi.yaml` drift     |
| `BE-008` | **P2**   | Auth Verification      | Implement `POST /api/v1/auth/resend-verification` and `POST /api/v1/auth/refresh`                        |
| `BE-009` | **P2**   | Team Onboarding        | Implement business member invitations & "Join an existing business" acceptance                           |
| `BE-010` | **P2**   | Notifications          | Implement `GET /api/v1/notifications` and `POST /api/v1/notifications/:id/read`                          |
| `BE-011` | **P2**   | Seed Fixtures          | Expand `apps/api/prisma/seed.ts` with dev accounts covering supplier/multi-business/role states          |
| `BE-012` | **P3**   | Retailer & Commerce    | Implement Retailer onboarding and Supplier Inventory / Pricing / Website / Orders / Wallet modules       |
| `BE-013` | **P3**   | OAuth & Phone Auth     | Implement Google/Apple OAuth and phone-identifier login / password reset (or remove from v1 spec)        |

---

## Detailed Backend Tasks

### `BE-001` — Implement Session Logout (`POST /api/v1/auth/logout`)

- **Priority:** **P0 (Critical)**
- **Why Frontend Needs It:** `loginHandler` (`apps/api/src/modules/auth/auth.handlers.ts:157-164`) sets `sellonit_access_token` as an `HttpOnly` cookie (`path: '/'`, `sameSite: 'lax'`). Browser JavaScript cannot delete an `HttpOnly` cookie. Currently `POST /api/v1/auth/logout` is not mounted in `apps/api/src/http/routes/auth.routes.ts`, so clicking **Log out** in `DashboardShell.tsx` or `AccountPanel.tsx` hits `404` and leaves the user signed in on refresh.
- **Proposed Contract:**
  - **Method & Path:** `POST /api/v1/auth/logout`
  - **Auth:** Optional cookie/Bearer token (must be idempotent: even if the session is already expired, missing, or revoked, still clear the cookie and return `204`).
  - **Request Body:** None.
  - **Behavior:**
    1. Extract token from `sellonit_access_token` cookie or `Authorization: Bearer <token>`.
    2. If found, set `revokedAt = new Date()` on matching `Session` rows where `revokedAt IS NULL`.
    3. Call `res.clearCookie('sellonit_access_token', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' })`.
  - **Response:** `204 No Content` (matches `docs/openapi.yaml:296-302`).

---

### `BE-002` — Implement Supplier Products Module (CRUD, Publish/Unpublish, Categories, Image Uploads, Summary)

- **Priority:** **P0 (Critical)**
- **Why Frontend Needs It:** The entire Supplier Products UI (`/dashboard/products`, `/dashboard/products/new`, `/dashboard/products/[id]/edit` backed by `apps/web/src/lib/products/productsApi.ts`) is built and tested, while `apps/api/src/modules/supplier-products/` contains only `.gitkeep` and `schema.prisma` has no product/category/image models.
- **Contract Decision to Resolve First:** Reconcile `docs/openapi.yaml` `/supplier-products` (lines 729–869), `docs/openapi.yaml` `PROPOSED` `/supplier/products` (lines 1914–2055), and `productsApi.ts` into one canonical contract.
- **Proposed Contract (aligned with `productsApi.ts` + business scoping):**
  - **Tenancy:** Accept `:businessId` path prefix (`/api/v1/supplier/:businessId/products*`) **and/or** resolve `X-Business-Id` header via `requireBusinessMembership` (`type === 'SUPPLIER'`). Require `OWNER | MANAGER` for write/publish (`OWNER` for delete), allow `STAFF` for `GET`.
  - **Endpoints:**
    1. `GET /api/v1/supplier/products` (or `/api/v1/supplier/:businessId/products`)
       - Query: `page` (int, default `1`), `pageSize` (int, default `10`, max `100`), `status` (`DRAFT | PUBLISHED | draft | published`), `q` / `search` (string, matches `name` or `sku`), `category` (category id or slug), `stock` (`in-stock | low-stock | out-of-stock`).
       - Response `200`:
         ```json
         {
           "data": [
             {
               "id": "uuid",
               "name": "Wireless Earbuds Pro",
               "description": "Active noise cancellation...",
               "category": "cat-electronics",
               "categoryName": "Electronics",
               "sku": "EAR-PRO-01",
               "wholesalePrice": 1500000,
               "stockQuantity": 45,
               "status": "published",
               "images": [{ "id": "uuid", "url": "https://..." }],
               "createdAt": "2026-11-05T10:00:00.000Z",
               "updatedAt": "2026-11-05T10:00:00.000Z"
             }
           ],
           "meta": { "page": 1, "pageSize": 10, "total": 1, "totalPages": 1 }
         }
         ```
         _(Note: Document explicitly whether `wholesalePrice` is integer kobo or NGN; `apps/web/src/lib/money.ts` and `openapi.yaml` kobo fields must match.)_
    2. `GET /api/v1/supplier/products/summary`
       - Response `200`: `{ "data": { "totalProducts": 12, "publishedCount": 8, "draftCount": 4, "outOfStockCount": 2 } }`
    3. `GET /api/v1/supplier/products/:id` → `200 { "data": SupplierProduct }` | `404 { "error": { "code": "NOT_FOUND", ... } }`
    4. `POST /api/v1/supplier/products`
       - Body: `{ name, description, category, sku?, wholesalePrice, stockQuantity, status: 'draft' | 'published', imageIds: string[] }`
       - Publishing guard: if `status === 'published'` and `SupplierProfile.status !== 'APPROVED'`, return `403 { "error": { "code": "SUPPLIER_NOT_APPROVED", "message": "Your supplier account must be approved before publishing.", "requestId": "..." } }`.
       - Duplicate SKU per business: `409 { "error": { "code": "DUPLICATE_SKU", "message": "...", "fields": { "sku": "..." }, "requestId": "..." } }`.
       - Response: `201 { "data": SupplierProduct }`.
    5. `PATCH /api/v1/supplier/products/:id` → `200 { "data": SupplierProduct }`.
    6. `DELETE /api/v1/supplier/products/:id` → `204 No Content`.
    7. `POST /api/v1/supplier/products/:id/publish` → `200 { "data": SupplierProduct }` (enforces `SUPPLIER_NOT_APPROVED` and required fields).
    8. `POST /api/v1/supplier/products/:id/unpublish` → `200 { "data": SupplierProduct }`.
    9. `GET /api/v1/supplier/categories` → `200 { "data": [{ "id": "uuid", "name": "Electronics" }] }` (seed default categories in `seed.ts`).
    10. `POST /api/v1/supplier/uploads/product-images` (`multipart/form-data`, field `file`, PNG/JPG/WebP ≤ 5 MB) → `201 { "data": { "id": "uuid", "url": "https://..." } }`; `DELETE /api/v1/supplier/uploads/product-images/:id` → `204 No Content`.

---

### `BE-003` — Implement Supplier Dashboard Overview & Authoritative Setup Progress

- **Priority:** **P1 (High)**
- **Why Frontend Needs It:** `/dashboard/overview` (`apps/web/src/lib/dashboard/supplierDashboard.ts:80-86`) requests `GET /api/v1/supplier/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` for KPI cards, revenue chart, top products, order breakdown, recent orders, and `setup.completedStepIds`. Currently Steps 1 (`business-information`) and 2 (`supplier-profile`) are derived from `GET /businesses` and `GET /supplier/:businessId/profile`, while Steps 3–6 and dashboard metrics have no endpoint.
- **Proposed Contract:**
  - **Method & Path:** `GET /api/v1/supplier/:businessId/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD` (and alias `GET /api/v1/supplier/dashboard` reading `X-Business-Id`).
  - **Auth:** `requireAuth` + `requireBusinessMembership` (`type === 'SUPPLIER'`).
  - **Response `200`:**
    ```json
    {
      "data": {
        "metrics": {
          "totalRevenue": { "value": 0, "changePercent": null },
          "activeOrders": { "value": 0, "changePercent": null },
          "connectedRetailers": { "value": 0, "changePercent": null },
          "productsListed": { "value": 0, "changePercent": null }
        },
        "revenueSeries": [],
        "topProducts": [],
        "orderStatus": {
          "pending": 0,
          "processing": 0,
          "shipped": 0,
          "completed": 0,
          "cancelled": 0
        },
        "recentOrders": [],
        "setup": {
          "completedStepIds": ["business-information", "supplier-profile"]
        }
      }
    }
    ```
  - **Product Decision Needed:** Confirm canonical setup step IDs (`business-information`, `supplier-profile`, `product-catalogue`, `inventory`, `pricing`, and whether `website` is included for `ENTERPRISE` or only `ENTERPRISE_PLUS`).

---

### `BE-004` — Standardize Business Tenancy, Subscription Exposure, Role Guards & `SUSPENDED` Status

- **Priority:** **P1 (High)**
- **Why Frontend Needs It:**
  1. `GET /api/v1/businesses` and `POST /api/v1/businesses` (`apps/api/src/modules/businesses/businesses.handlers.ts:85,94`) create `BusinessSubscription(Plan='ENTERPRISE')` in PostgreSQL but omit `activeSubscription` and `supplierProfile` from the response JSON, and omit `orderBy` and `meta`.
  2. `supplier.handlers.ts:41` calls `requireBusinessMembership` instead of `requireOwnedBusiness` when `:businessId` is provided, allowing `STAFF` members to overwrite or submit a supplier profile.
  3. `Business.status === 'SUSPENDED'` is not enforced on business-scoped endpoints.
  4. `X-Business-Id` header sent by `apps/web/src/lib/api-client.ts:115` is ignored; `GET /supplier/profile` without `:businessId` silently falls back to the oldest supplier business.
- **Proposed Contract:**
  - In `businesses.handlers.ts`:
    - Add `orderBy: { createdAt: 'asc' }` and `include: { memberships: { where: { userId: req.userId } }, activeSubscription: { include: { plan: true } }, supplierProfile: { select: { status: true } } }`.
    - Return `{ data: businesses, meta: { page: 1, pageSize: businesses.length, total: businesses.length, totalPages: 1 } }`.
    - Support `Idempotency-Key` header on `POST /api/v1/businesses` (or document non-support).
  - In `supplier.handlers.ts`:
    - Check `req.params.businessId ?? bodyOf(req).businessId ?? req.header('x-business-id')`.
    - Require `requireOwnedBusiness` (`OWNER | MANAGER`) on `upsertSupplierProfileHandler` and `submitSupplierProfileHandler` (keep `requireBusinessMembership` on `getSupplierProfileHandler`).
    - Return `403 { error: { code: 'BUSINESS_SUSPENDED', message: 'This business is currently suspended', requestId } }` when `business.status === 'SUSPENDED'`.
  - Mount `GET /api/v1/businesses/:businessId` and `PATCH /api/v1/businesses/:businessId` (`docs/openapi.yaml:458-484`).

---

### `BE-005` — Implement Workspace Session Context & Role Permission Grants

- **Priority:** **P1 (High)**
- **Why Frontend Needs It:** `WorkspaceRoute.tsx` (`/admin/suppliers`), `PermissionGuard.tsx`, and `BusinessProvider.can()` (`apps/web/src/lib/business/BusinessProvider.tsx:95-99`) need server-resolved platform roles (`ADMIN | USER`), business permissions (`product:read`, `product:write`, `product:publish`, `product:delete`, `supplier_profile:write`), and plan-gated features. Currently `GET /api/v1/session/context` (`docs/openapi.yaml:1857-1869`) is unmounted (`404`) and `seed.ts:51-66` assigns permissions only to `ADMIN`.
- **Proposed Contract:**
  - Mount `GET /api/v1/session/context` (`requireAuth`, honoring `X-Business-Id` or query `businessId`) returning `WorkspaceSessionContext` (`docs/openapi.yaml:2593-2615`):
    ```json
    {
      "data": {
        "userId": "uuid",
        "platformRole": "USER",
        "businesses": [
          {
            "id": "uuid",
            "name": "Acme Ltd",
            "slug": "acme-ltd",
            "type": "SUPPLIER",
            "status": "ACTIVE"
          }
        ],
        "activeBusiness": {
          "id": "uuid",
          "name": "Acme Ltd",
          "slug": "acme-ltd",
          "type": "SUPPLIER",
          "status": "ACTIVE"
        },
        "supplierStatus": "PENDING_REVIEW",
        "plan": "ENTERPRISE",
        "permissions": [
          "supplier.dashboard.view",
          "supplier.profile.edit",
          "supplier.products.view",
          "supplier.products.create",
          "supplier.products.edit"
        ],
        "features": ["supplier-portal", "product-catalogue", "inventory", "pricing"]
      }
    }
    ```
  - Populate `RolePermission` rows in `seed.ts` for `OWNER`, `MANAGER`, `STAFF`, `SUPPLIER`, and `RETAILER`.

---

### `BE-006` — Implement Admin Supplier Review Queue & Moderation Actions

- **Priority:** **P1 (High)**
- **Why Frontend Needs It:** `/admin/suppliers` and `/admin/suppliers/[id]` (`SupplierQueue.tsx`, `SupplierReview.tsx`, `apps/web/src/lib/workspace/adminApi.ts`) are fully built against `docs/openapi.yaml:1886-1913` (`PaginatedAdminSuppliers`, `AdminSupplierDetail`), but no `/api/v1/admin/*` router exists, so supplier profiles submitted via `POST /api/v1/supplier/:businessId/profile/submit` (`PENDING_REVIEW`) have no way to be approved or assigned `ENTERPRISE` vs `ENTERPRISE_PLUS` plans except via raw SQL.
- **Proposed Contract:**
  - Guard all routes with `requireAuth` + `requirePermission('admin:read')` (for `GET`) / `requirePermission('admin:write')` (for `POST`).
  - `GET /api/v1/admin/suppliers?status=PENDING_REVIEW&search=&page=1&pageSize=20` → `PaginatedAdminSuppliers`
  - `GET /api/v1/admin/suppliers/:id` → `ApiResponseAdminSupplierDetail`
  - `POST /api/v1/admin/suppliers/:id/approve` (`{ plan: 'ENTERPRISE' | 'ENTERPRISE_PLUS', note? }`) → sets `SupplierProfile.status = 'APPROVED'`, updates `BusinessSubscription` to selected `Plan`, records audit event.
  - `POST /api/v1/admin/suppliers/:id/reject` (`{ reason }`) → sets `SupplierProfile.status = 'REJECTED'`.
  - `POST /api/v1/admin/suppliers/:id/suspend` (`{ reason }`) → sets `Business.status = 'SUSPENDED'` (and reconcile `SupplierProfileStatus` vs `SupplierReviewStatus` in `schema.prisma` / `openapi.yaml`).
  - `POST /api/v1/admin/suppliers/:id/reinstate` (`{ note? }`) → sets `Business.status = 'ACTIVE'`.

---

### `BE-007` — Add JSON 404 Catch-All, Standardize Error Envelopes, and Fix `docs/openapi.yaml` Drift

- **Priority:** **P1 (High)**
- **Why Frontend Needs It:**
  1. `apps/api/src/main.ts:15-21` has no catch-all 404 middleware, so Express 5 returns `text/html` (`<!DOCTYPE html>...Cannot GET /api/v1/...`) on unmatched routes instead of `ErrorResponse`.
  2. `businesses.handlers.ts:36-60`, `supplier.handlers.ts:61-68`, and `auth.middleware.ts:68,79` omit `requestId` and return single-string `400 VALIDATION_ERROR` responses with no `fields` / `details[]` for inline field highlighting.
  3. `docs/openapi.yaml` has drifted from live handlers in several places:
     - Server URL prefix is `/v1` (`openapi.yaml:42-48`) instead of `/api/v1` (`main.ts:15-19`).
     - `AuthResponse` (`openapi.yaml:3168-3175`) marks `accessToken` as `required`, while `loginHandler` (`auth.handlers.ts:165`) and `verifyEmailAndLoginHandler` (`auth.handlers.ts:247`) return `{ user, expiresIn }` + `Set-Cookie` only.
     - `GET /auth/me` (`auth.routes.ts:21`) and `GET /auth/verify-email/:token` (`auth.routes.ts:26`) are undocumented; `User` (`openapi.yaml:2835-2849`) omits `phone` and `phoneVerifiedAt` returned by `publicUserSelect` (`auth.service.ts:14-26`).
     - `POST /auth/verify-email` returns `{ data: { verified: true } }` (`auth.handlers.ts:260`), not `ApiResponseUser` (`openapi.yaml:152`).
     - Supplier profile business-scoped routes are mounted at `/api/v1/supplier/:businessId/profile` and `/api/v1/supplier/:businessId/profile/submit` (`supplier.routes.ts:14-16`), whereas `openapi.yaml:541-568` documents unmounted `/businesses/{businessId}/supplier-profile` and omits business-scoped `/submit`.
     - `HealthResponse` (`openapi.yaml:3395-3402`) does not match `health.ts:13,23`.
- **Proposed Contract:**
  - Add JSON 404 middleware before `errorHandler` in `apps/api/src/main.ts`:
    `app.use('/api/v1', (req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found', requestId: res.getHeader('x-request-id') } }));`
  - Include `requestId` on all error responses and `details: [{ field, code, message }]` on `400/422` validation failures.
  - Reconcile `docs/openapi.yaml` with live routes and regenerate `packages/shared/src/api.d.ts`.

---

### `BE-008` — Implement Resend Email Verification & Session Refresh

- **Priority:** **P2 (Medium)**
- **Why Frontend Needs It:** `VerifyEmailPage` (`apps/web/src/app/auth/verify-email/page.tsx:167`, `apps/web/src/lib/auth/api.ts:69-77`) provides a "Resend verification link" button with a 30s cooldown, but `POST /api/v1/auth/resend-verification` does not exist. `POST /api/v1/auth/refresh` (`openapi.yaml:275-294`) is also unmounted.
- **Proposed Contract:**
  - `POST /api/v1/auth/resend-verification` (public, rate-limited per IP + email, e.g. 1/30s):
    - Body: `{ "email": "user@example.com" }`
    - Behavior: If user exists and `emailVerifiedAt === null`, invalidate/create `VerificationToken(type='EMAIL')` and send verification link; return generic `202 { "data": { "sent": true } }` (do not leak account existence; if already verified, still return `202`).
  - Either mount `POST /api/v1/auth/refresh` or remove it from `docs/openapi.yaml` while 30-day DB-backed cookie sessions are used.

---

### `BE-009` — Implement Business Member Invitations & "Join an Existing Business"

- **Priority:** **P2 (Medium)**
- **Why Frontend Needs It:** `CreateBusinessForm.tsx:271-283` includes a "Join an existing business" CTA (currently showing a coming-soon notice), and multi-user supplier teams need a way to add `MANAGER` and `STAFF` memberships (`Membership.role`).
- **Proposed Contract:**
  - Mount `/api/v1/businesses/:businessId/members` (`GET`, `POST`) and `/api/v1/businesses/:businessId/members/:memberId` (`PATCH`, `DELETE`) per `docs/openapi.yaml:486-539` (`requireOwnedBusiness` / `OWNER`).
  - Add `POST /api/v1/business-invites/accept` (`requireAuth`, body `{ tokenOrCode: string }`) creating the `Membership` and returning `{ data: Business }`.

---

### `BE-010` — Implement In-App Notifications

- **Priority:** **P2 (Medium)**
- **Why Frontend Needs It:** `DashboardShell.tsx:388-395` includes a header notifications trigger so suppliers know when their profile is approved/rejected or orders arrive.
- **Proposed Contract:**
  - Mount `GET /api/v1/notifications?page=1&pageSize=20&unreadOnly=false` and `POST /api/v1/notifications/:id/read` (`docs/openapi.yaml:1661-1683`), including `unreadCount` in `meta`.

---

### `BE-011` — Expand Development Seed Fixtures (`apps/api/prisma/seed.ts`)

- **Priority:** **P2 (Medium)**
- **Why Frontend Needs It:** `seed.ts` currently creates only `admin@sellonit.local` (`onboardingIntent: null`, 0 businesses). Adding deterministic non-production fixtures (`if (process.env.NODE_ENV !== 'production')`) lets engineers immediately test every UI state:
  1. `admin@sellonit.local` / `ChangeMe123!` — Platform `ADMIN`.
  2. `supplier.draft@sellonit.local` / `ChangeMe123!` — Verified `SUPPLIER`, 1 business (`ACTIVE`, `ENTERPRISE`), `SupplierProfile` in `DRAFT`.
  3. `supplier.pending@sellonit.local` / `ChangeMe123!` — Verified `SUPPLIER`, `SupplierProfile` in `PENDING_REVIEW`.
  4. `supplier.approved@sellonit.local` / `ChangeMe123!` — Verified `SUPPLIER`, 2 businesses (`ACTIVE`, `ENTERPRISE` & `ENTERPRISE_PLUS`, `APPROVED`) for Business Switcher testing.
  5. `supplier.staff@sellonit.local` / `ChangeMe123!` — Verified `SUPPLIER`, `Membership(role='STAFF')` on `supplier.approved`'s business for RBAC permission testing.
  6. `supplier.suspended@sellonit.local` / `ChangeMe123!` — Verified `SUPPLIER` whose `Business.status = 'SUSPENDED'`.
  7. `retailer@sellonit.local` / `ChangeMe123!` — Verified `RETAILER` (`onboardingIntent = 'RETAILER'`).

---

### `BE-012` — Retailer Workspace & Remaining Supplier Workspace Modules

- **Priority:** **P3 (Roadmap)**
- **Why Frontend Needs It:** Unblocks flipping `NON_SUPPLIER_BUSINESS_CREATION_ENABLED` (`apps/web/src/lib/onboarding/businessApi.ts:20`) and replacing `PlaceholderWorkspace` on `/dashboard/{inventory,pricing,website,orders,customers,wallet,analytics,settings}`.
- **Proposed Contract:** Implement per `docs/openapi.yaml` domain tags (`Retailers`, `Stores`, `Catalogue`, `Commerce`, `Payments`, `Fulfillment`, `Logistics`, `Analytics`).

---

### `BE-013` — Google/Apple OAuth & Phone-Identifier Login / Password Reset

- **Priority:** **P3 (Roadmap)**
- **Why Frontend Needs It:** `SignupMethodChooser.tsx` and `LoginForm.tsx` render disabled Google/Apple buttons, and login/forgot-password inputs accept phone numbers with a polite "use your email address" fallback (`authService.ts:109-111,163-165`).
- **Proposed Contract:** Either implement OAuth redirect/callback routes and verified-phone login/OTP reset, or confirm email-only auth for v1.
