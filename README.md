# Sellonit

Virtual-inventory commerce and supply-chain platform.

> **Status: backend foundations and supplier workflows implemented.** The API
> includes authentication, business onboarding, supplier catalogue and review
> workflows, subscription administration, and tested pricing/order lifecycle
> rules. Order/payment/fulfilment endpoints and external commerce integrations
> remain future work. See the [API implementation summary](apps/api/README.md).

## Repository layout

```
apps/
  api/        Express REST API + Prisma (PostgreSQL)
    prisma/     Multi-file Prisma schema and migrations
    src/        Authentication, businesses, suppliers, supplier products, admin,
                tenancy, pricing rules, and pure order lifecycle guards
    test/       integration/ tests go here
  worker/     BullMQ background worker (separate process); src/jobs/ is empty
  web/        Next.js frontend (App Router); src/app, src/lib, src/config
packages/
  shared/     Browser-safe code shared by the apps; holds the generated API types
  config/     Shared configuration (empty)
  queue/      SERVER-ONLY shared BullMQ/Redis setup (empty)
docs/
  openapi.yaml                   The API contract — source of truth for the HTTP API
  README.md                      Contract README: domain rules, MVP rules, CI contract gate
  Contract_Engineering_Rules.md  Versioning, HTTP semantics, authorization, payment rules
  contract-review.md             Open questions found in the contract
scripts/
  check-api-types.mjs   Fails if generated API types drift from docs/openapi.yaml
.github/workflows/      ci.yml, api-contract.yml, deploy-api.yml
docker-compose.yml      PostgreSQL + Redis (default) and containerised apps (profile `apps`)
```

**Boundaries (enforced by ESLint):** `apps/web` and `packages/shared` may not
import Prisma, database code, Redis, BullMQ, `@sellonit/queue`, `@sellonit/config`
or other apps. Only `@sellonit/shared` crosses the frontend/backend boundary.

## Stack

Node.js 22 LTS · TypeScript 5.9 (strict) · npm workspaces · Express 5 ·
PostgreSQL 17 + Prisma 7 · Redis 7 + BullMQ 5 + ioredis · Next.js 16 + React 19 ·
openapi-typescript · Vitest · ESLint · Prettier · Docker Compose.

## Getting started

Prerequisites: Node.js ≥ 22.12 (`nvm use`), npm ≥ 10, Docker (for PostgreSQL and Redis).

```bash
npm ci
cp .env.example .env
docker compose up -d            # PostgreSQL + Redis on 127.0.0.1
npm run dev                     # api :4000, worker, web :3000
```

To run everything in containers instead: `docker compose --profile apps up --build`.

## Commands

| Command                                            | What it does                                                               |
| -------------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`                                      | Build shared packages, generate Prisma client, run api + worker + web      |
| `npm run lint`                                     | ESLint (type-aware), zero warnings allowed                                 |
| `npm run format` / `format:check`                  | Prettier                                                                   |
| `npm run typecheck`                                | `tsc --noEmit` in every workspace                                          |
| `npm test`                                         | Unit tests (`*.test.ts`)                                                   |
| `npm run test:integration`                         | Integration tests (`*.int.test.ts`) against real PostgreSQL + Redis        |
| `npm run build`                                    | Build every workspace                                                      |
| `npm run generate:api`                             | Regenerate `packages/shared/src/api.d.ts` from `docs/openapi.yaml`         |
| `npm run validate:api`                             | Lint the OpenAPI contract (Redocly)                                        |
| `npm run check:api-types`                          | Fail if the committed generated types differ from the contract (read-only) |
| `npm run db:generate` / `db:migrate` / `db:deploy` | Prisma client / dev migration / apply migrations                           |
| `npm run infra:up` / `infra:down`                  | Start / stop the compose stack                                             |

Test scripts retain `--passWithNoTests` for the still-empty workspaces;
the API lifecycle unit tests run normally and failures fail CI.

## API contract workflow

`docs/openapi.yaml` is the source of truth. To change the API:

1. Edit `docs/openapi.yaml` following `docs/Contract_Engineering_Rules.md`.
2. `npm run validate:api && npm run generate:api`, then commit the regenerated
   `packages/shared/src/api.d.ts` together with the contract.

CI never regenerates or commits files; it only verifies (`check:api-types`).

## Environment

All variables are listed in [`.env.example`](.env.example). Never commit `.env`.
