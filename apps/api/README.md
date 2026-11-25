# Sellonit Backend

Sellonit is a B2B commerce and supply-chain platform. This repository contains a
TypeScript/Express REST API backed by PostgreSQL and Prisma. The implemented
backend currently covers identity, business onboarding, supplier catalogue
management, supplier review, subscription administration, and selected commerce
rules. It is not yet a complete ordering, payment, inventory, or fulfilment
platform.

## Backend highlights

- **Identity and account security:** registration, password login, email and
  phone verification, password reset by one-time code, and database-backed
  sessions. Passwords are hashed with bcrypt; verification tokens are stored as
  hashes and expire. Authenticated requests accept the HttpOnly access-token
  cookie or a Bearer token.
- **Businesses and access control:** retailer/supplier businesses, memberships,
  owner/manager access checks, role/permission guards, and business-scoped data
  access.
- **Supplier onboarding and administration:** profile creation and submission,
  configurable status transitions, admin approval/rejection/suspension and
  reinstatement, review history, and plan assignment. Review changes use
  PostgreSQL transactions and lock the supplier profile row.
- **Supplier catalogue:** product and SKU variant creation/editing, paginated
  search, pricing-rule configuration in Nigerian kobo, and guarded product
  publishing. Publishing requires an approved supplier, a valid priced variant,
  and a default warehouse. Publishing is recorded in the audit log.
- **Commerce rules:** unit-tested retail-price floor/ceiling validation and
  pure order lifecycle guards for payment, fulfilment, shipment, settlement,
  escrow, and final order completion. These guards define allowed state
  changes; they do not execute payments or persist order transitions.

Supplier review events are emitted through an in-process event emitter, not a
durable queue. The readiness endpoint currently returns a static response and
does not check database or Redis connectivity.

## API surface

All routes are mounted under `/api/v1`.

| Area              | Routes                                                                                                                                                                                                                                                                    | Access / capability                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Health            | `GET /health`, `GET /health/ready`                                                                                                                                                                                                                                        | Liveness and readiness responses                                      |
| Identity          | `POST /auth/register`, `POST /auth/login`, `POST /auth/verify-email`, `POST /auth/verify-email-and-login`, `GET /auth/verify-email/:token`, `POST /auth/verify-phone`, `POST /auth/send-phone-verification`, `POST /auth/forgot-password`, `POST /auth/verification-codes/verify`, `POST /auth/reset-password` | Registration, session, verification, and password reset               |
| Current user      | `GET /me`, `PATCH /auth/me`, `PUT /auth/business-intent`                                                                                                                                                                                                                  | Authenticated profile and onboarding intent                           |
| Businesses        | `GET /businesses`, `POST /businesses`                                                                                                                                                                                                                                     | Authenticated user's business memberships                             |
| Supplier profile  | `GET/PUT /supplier/profile`, `POST /supplier/profile/submit`; also available under `/supplier/:businessId/profile` and `/supplier/:businessId/profile/submit`                                                                                                              | Supplier membership required                                          |
| Supplier products | `GET/POST /supplier/products`, `GET/PATCH /supplier/products/:id`, `PUT /supplier/products/:id/pricing-rule`, `POST /supplier/products/:productId/publish`                                                                                                                | Requires `X-Business-Id` (or request `businessId` where supported) and product/pricing permissions |
| Admin             | `GET /admin/suppliers`, `GET /admin/suppliers/:id`, `POST /admin/suppliers/:id/{approve,reject,suspend,reinstate}`, `POST /admin/businesses/:id/subscription/change`                                                                                                      | Requires the corresponding admin read/write permission                |

Protected endpoints use session authentication. Admin and catalogue routes also
apply permission checks; supplier operations additionally verify business
membership or ownership. See the route files for the exact HTTP methods and
request shapes.

Product creation requires a client-supplied, business-unique SKU and a positive
integer `basePriceKobo` in the required `defaultVariant` object. Pricing rule
amounts are also integer kobo; `maxMarkupKobo: null` means no ceiling and zero
means the retailer price must equal the base price. The API contract is
[`docs/openapi.yaml`](../../docs/openapi.yaml), and its shared TypeScript types
are generated into `packages/shared/src/api.d.ts` with `npm run generate:api`.

## Current scope and next work

The API does **not** yet provide implemented order, checkout, payment-provider
webhook, inventory-reservation, shipment, or settlement endpoints. The tested
commercial lifecycle module is a set of pure transition and eligibility
functions, not a persistence or provider integration. Those capabilities remain
future backend work. The root OpenAPI contract should be kept aligned as the
implemented route surface evolves.

## Resume-ready summary

**Sellonit — Backend Engineering**

- Built a TypeScript/Express REST API with PostgreSQL and Prisma for account
  management, retailer/supplier onboarding, supplier catalogue operations, and
  administrative workflows.
- Implemented cookie/Bearer session authentication, email and phone
  verification, password recovery, business-scoped authorization, and
  role/permission checks.
- Developed transactional supplier approval workflows with validated state
  transitions, reviewer audit history, and subscription-plan assignment.
- Added supplier product publishing requirements and kobo-based pricing limits,
  plus unit-tested commerce lifecycle rules for multi-supplier settlement and
  order completion.

Adjust these bullets to reflect your specific contribution and ownership.

## Local development

From the repository root, install dependencies and configure the root `.env`
using [`.env.example`](../../.env.example). PostgreSQL is required for the API;
the repository's local infrastructure can be started with `npm run infra:up`.

```bash
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev:api
```

The API listens on `API_HOST` and `API_PORT` (defaults are documented in
`.env.example`). Email verification uses Resend when configured; phone
verification uses Twilio. Relevant scripts can also be run from this workspace:

| Script                                     | Purpose                                                        |
| ------------------------------------------ | -------------------------------------------------------------- |
| `npm run dev`                              | Run the API in `tsx` watch mode                                |
| `npm run build` / `npm start`              | Compile TypeScript / run the compiled API                      |
| `npm run typecheck`                        | Type-check the API                                             |
| `npm test`                                 | Run API unit tests                                             |
| `npm run test:integration`                 | Run integration tests                                          |
| `npm run db:generate`                      | Generate the Prisma client                                     |
| `npm run db:migrate` / `npm run db:deploy` | Create development migrations / apply committed migrations     |
| `npm run db:seed`                          | Seed roles, permissions, plans, transitions, and admin account |

## Implementation layout

```text
src/
  http/                 Express routes and authentication/permission middleware
  infrastructure/       Prisma PostgreSQL client
  modules/
    admin/               Supplier review and subscription administration
    auth/                Registration, sessions, verification, password reset
    businesses/          Business creation and membership listing
    orders/              Pure commercial lifecycle guards and tests
    pricing/             Retail price validation and tests
    supplier-products/   Catalogue, pricing rules, and publishing
    suppliers/           Supplier profiles, approval workflow, events
    tenancy/             Business membership and ownership checks
prisma/
  schema/                Multi-file Prisma schema
  migrations/            Versioned PostgreSQL migrations
```

The API package uses Express 5, TypeScript, Prisma 7, PostgreSQL, Vitest,
Resend, and Twilio. The Prisma client is generated into `src/generated/prisma`.
