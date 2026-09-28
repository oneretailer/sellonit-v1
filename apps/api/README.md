# @sellonit/api

Express REST API for Sellonit. The contract is [`docs/openapi.yaml`](../../docs/openapi.yaml);
follow [`docs/Contract_Engineering_Rules.md`](../../docs/Contract_Engineering_Rules.md) and the
[contract README](../../docs/README.md).

`src/main.ts` still starts an empty Express server. `modules/orders/lifecycle.ts`
contains pure v1.0.3 transition guards with unit tests, using generated contract
states. They are not HTTP handlers and do not perform external financial effects.
See the [alignment audit](../../docs/v1.0.3-alignment.md) for remaining work.

## Layout

```
prisma/
  schema/schema.prisma   generator + datasource only; add one <module>.prisma per module
  migrations/            created by `npm run db:migrate`
prisma.config.ts         Prisma CLI config (reads DATABASE_URL, loads the root .env)
src/
  main.ts                entry point
  config/                (empty)
  http/middleware/       (empty)
  infrastructure/        (empty)
  modules/<domain>/      scaffolded; orders/ has pure lifecycle guards and tests
test/integration/        (empty) *.int.test.ts files run with `npm run test:integration`
```

The Prisma client is generated into `src/generated/prisma` (git-ignored) by `npm run db:generate`.

## Scripts

| Script                     | What it does                                 |
| -------------------------- | -------------------------------------------- |
| `npm run dev`              | Watch mode with `tsx`, loads the root `.env` |
| `npm run build` / `start`  | Compile to `dist/` / run `dist/main.js`      |
| `npm test`                 | Unit tests (`src/**/*.test.ts`)              |
| `npm run test:integration` | Integration tests (needs PostgreSQL + Redis) |
| `npm run db:migrate`       | Create and apply a development migration     |
| `npm run db:deploy`        | Apply committed migrations                   |
