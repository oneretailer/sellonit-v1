# Supplier Products module — implementation handoff

Date: 2026-11-05. Scope: `apps/web` only (plus this doc and deprecation notes in
older docs). **All mocks were removed first**, per the product owner's
instruction — the app now talks to the real API exclusively and shows honest
loading / empty / error states until each backend endpoint exists.

## 1. What was built

### Routes
| Route | Screen |
|---|---|
| `/dashboard/products` | Products list (stats, tabs, search/filters, table, pagination) |
| `/dashboard/products/new` | Add product |
| `/dashboard/products/[id]/edit` | Edit product (both **View** and **Edit** row actions land here) |
| `/products`, `/products/new`, `/products/[id]` | Redirect to the new routes (old module retired) |

Unbuilt sidebar sections (Inventory, Pricing, Orders, Fulfilment, Analytics,
Business profile, Settings, Website) keep linking to their existing
`/dashboard/[...section]` "coming soon" placeholder. No new pages were invented
for them.

### App shell (`components/dashboard/DashboardShell.tsx`)
- Header: wordmark, **business-switcher pill**, notification bell with orange
  dot (notifications themselves are a stub), profile menu with **Log out**.
- ~240px (`w-60`) sticky sidebar with its own scroll: business name +
  "Supplier workspace", orange **setup-progress card** (percent, "n of total
  steps completed", bar, full-width **Continue setup** → Supplier Setup;
  hidden at 100%), Dashboard → Overview and the three collapsible nav groups.
  Active item = light-orange background + short orange bar at the right edge.
- `min-h-dvh`, fluid widths, ~28px main padding (`sm:px-7 sm:py-7`), 24px gaps.
  Mobile drawer is a focus-trapped native `<dialog>` that closes on route
  change, Escape and backdrop click.

### Products list (`components/products/ProductsListPage.tsx`)
- Three stat cards (Total with published/drafts split, Low stock, Out of
  stock) fed by `GET /supplier/products/summary`; inventory cards link to
  `/dashboard/inventory`.
- All / Published / Drafts tabs with count pills from the summary; debounced
  (~300ms) search "Search by product name or SKU"; Category + Stock selects.
- Table (md+) / stacked cards (below md): thumbnail + name + SKU, category,
  wholesale price (₦, shared formatter), stock text, status pill, actions
  (View, Edit, ··· menu → Publish/Unpublish/Delete). Delete asks via the
  shared ConfirmDialog. Publish/unpublish is optimistic with rollback.
- Footer "Showing 1–10 of N products" + Previous/Next; server pagination,
  page size 10 (`PRODUCTS_PAGE_SIZE`).
- Four states: ~7-row skeleton with `aria-busy`, true-empty ("No products
  yet" + Add product), filter-empty ("No products match your filters" + Clear
  filters), error (+ Try again). Previous rows stay visible while refetching
  (`keepPreviousData`, dimmed).
- Filters are URL-synced (`status`, `q`, `category`, `stock`, `page`) via
  `useProductFilters`; any filter change resets page 1.

### Add/Edit form (`components/products/ProductFormPage.tsx`)
- "← Products" breadcrumb, photos / details / pricing / inventory cards;
  sticky right column (~340–360px) with live **Preview** and **Publish** card
  (Publish product, Save draft, Cancel).
- React Hook Form holds raw text; validation is the pure
  `lib/products/validation.ts` (`validateProduct`, exact brief messages).
  Publish requires ≥1 uploaded photo + name/category/SKU/price/stock; a draft
  requires **name only** (assumption). Failed publish shows the dismissible
  `role="alert"` "Product not published / Fix the n highlighted fields" card,
  scrolls + focuses the first invalid field, and errors clear as fields
  become valid. Server 422/409 `fields` map onto inputs (duplicate SKU).
- Price input: ₦ prefix, decimal text (no spinners), formatted on blur, raw
  numeric text kept in state; kobo conversion happens exactly once at submit.
- Publish flow: validate → **Confirm publish** dialog → create/update +
  publish → **Product published** success dialog (Add another product / Back
  to products). Draft flow: save → "Draft saved." toast → redirect to the
  list (**assumption D**, implemented in `doSaveDraft`).
- Dirty forms register the shared **NavigationGuard** (sidebar links,
  breadcrumb, Cancel, business switch all confirm "Discard this product?")
  and a `beforeunload` listener. Discarding best-effort deletes session-only
  uploaded photos.

### Photo uploader (`components/products/ProductImageUploader.tsx`)
Reusable `value` / `onChange` / `uploadFn` component: empty drag-drop zone,
drag-over, per-file progress with Cancel, uploaded tiles (Main photo badge,
Replace, Remove), failed tiles with Retry. JPG/PNG only, 5MB each, 8 max
(named constants). Keyboard accessible. Uploads start immediately per file;
one failure never blocks the rest. Tile ids become the server image ids that
the form submits as `imageIds`.

### Overlays (`components/workspace/Dialog.tsx`, `ConfirmDialog.tsx`)
One native-`<dialog>` base: 60% black backdrop, white panel, 24px radius,
32px padding (24 below sm), fluid `max-w-[460px]`, 40px tone icon tile,
two equal-width buttons (outlined secondary + solid orange primary; stacked
primary-first below sm), focus trapped, initial focus on the **safe** action
(`data-dialog-safe`), Escape/backdrop → safe action, scroll lock, loading
state locks closing. `ConfirmDialog` is a thin wrapper kept API-compatible
for the admin workspace. The discard / switch-business confirmations live in
`NavigationGuard`; publish confirm/success live in the form.

### Business switcher (`components/dashboard/BusinessSwitcher.tsx`)
Header pill → "Your businesses" popover (bottom sheet below sm): rows with
type · role, orange check + `aria-current` on the active business, divider +
**Add business** → Create Business. Arrow keys/Enter/Escape/outside-click,
scrolls past 6 rows. Switching while the form is dirty asks "Switch
business?". `BusinessProvider` persists the active id
(`sellonit.active-business`), clears all business-scoped caches
(products/summary/categories/dashboard/workspace), lands on
`/dashboard/overview`, and the api-client sends `X-Business-Id` on every
request.

### Access/error states (`lib/dashboard/access.ts`, `useDashboardAccess.ts`, `components/dashboard/DashboardFrame.tsx`)
One mapper + one hook + one frame render the generic `StatePanel` inside the
shell: load failed (Retry), business unavailable (Switch business), access
denied (Go back), page forbidden (Back to dashboard / Switch business), no
business (Create business — assumption), 401 → existing session
refresh/login redirect. Product pages pass a permission; owners pass
everything today (`can()` is the single tightening point).

## 2. Where things live

| Concern | File |
|---|---|
| Product API contract (ALL endpoints) | `apps/web/src/lib/products/productsApi.ts` |
| Types / constants / stock rule | `apps/web/src/lib/products/{types,constants,stock}.ts` |
| Query keys + hooks (business-scoped, optimistic publish) | `apps/web/src/lib/products/queries.ts` |
| Form validation + payload mapping | `apps/web/src/lib/products/validation.ts` |
| Business context / switcher data | `apps/web/src/lib/business/{BusinessProvider,businessesApi,activeBusiness}.tsx/ts` |
| Business header injection | `apps/web/src/lib/api-client.ts` + `activeBusiness.ts` |
| Error → state mapping | `apps/web/src/lib/dashboard/access.ts` |
| Dialogs | `apps/web/src/components/workspace/{Dialog,ConfirmDialog,NavigationGuard}.tsx` |
| Setup progress (single source, 6 steps) | `apps/web/src/lib/onboarding/supplierSetup.ts` |
| Money / date formatters | `apps/web/src/lib/money.ts`, `apps/web/src/lib/format/date.ts` |

## 3. Backend TODOs (isolated, honest failures until implemented)

1. **Products contract** — `productsApi.ts` assumes the brief's
   `/supplier/products*`, `/supplier/categories`,
   `/supplier/uploads/product-images` (+ best-effort DELETE for discarded
   uploads). None exist yet; the older PROPOSED OpenAPI `/supplier/products`
   shape (defaultVariant/pricingRule, no stock/images/summary) **conflicts**
   and was deliberately not used. Reconcile in `productsApi.ts` +
   `docs/openapi.yaml` when the backend lands.
2. **`GET /supplier/dashboard`** — assumed by
   `lib/dashboard/supplierDashboard.ts` (replaces the removed local adapter).
   Overview shows its error + Retry state until implemented.
3. **`GET /me/businesses`** — absent; `businessesApi.ts` normalizes the real
   `GET /businesses` membership response into `{id,name,type,role}`.
4. **`POST /auth/logout`** — documented in OpenAPI but not mounted. The
   profile menu calls it; only success (or 401 = already expired) clears the
   local session and redirects to login. Any other failure — including 404
   while the endpoint is absent — shows "Could not sign out. Try again."
   and keeps the session (no fake success). **The httpOnly cookie can only
   be cleared server-side**, so real sign-out needs this endpoint.
5. **`X-Business-Id` header** — transport assumption in `activeBusiness.ts`;
   the server must still authorize membership.
6. **Permissions** — `can()` allows OWNER everything; other roles fail
   closed until server grants exist.

## 4. Named assumptions (constants)

- `LOW_STOCK_THRESHOLD = 10` → stock 1–10 is "low"; 0 is out. A backend
  `lowStock` flag wins when present.
- `PRODUCTS_PAGE_SIZE = 10` (design's 6 rows was sample data).
- `MAX_IMAGE_SIZE_BYTES = 5MB`, `MAX_PRODUCT_IMAGES = 8`, JPG/PNG only.
- `DRAFT_REQUIRED_FIELDS = ['name']` — drafts need only a name.
- **Assumption D**: Save draft redirects to the list with a "Draft saved."
  toast (one place: `doSaveDraft`).
- **State 5 copy** ("Create your first business") was unspecified; chosen in
  `DashboardFrame.AccessPanel`.
- Setup progress uses the shared **6-step** source, so "1 of 6 ≈ 17%" — not
  the design annotation's 1-of-5 = 20%.

## 5. Conflicts with the pasted briefs (reported, not guessed)

- The briefs said "mock adapter on by default" + `?mock=` flags; the owner's
  later instruction (**remove all mocks**) overrides that. All states are
  still reachable and covered by unit/DOM tests with service spies.
- The design's sample texts ("Cotton polo shirt" as *sample*, "prototype
  simulation only…") are **not** rendered anywhere; dialog product names come
  from the live form value.
- Notifications bell is visual-only (dot, no panel) — no notifications
  backend exists.

## 6. Verification

- `npx eslint apps/web packages --max-warnings 0` — clean.
- `npx tsc --noEmit` (apps/web) — clean.
- `npx vitest run` — 47 files / 368 tests passing (products list/form/
  uploader/switcher DOM tests use `vi.spyOn` on the real API modules; no
  mock server).
- `npm run build --workspace apps/web` (with `API_INTERNAL_URL` set) —
  succeeds; all 26 routes compile, including `/dashboard/products`,
  `/dashboard/products/new`, `/dashboard/products/[id]/edit` and the
  `/products/*` legacy redirects.
- Chromium layout sweep — **all 30 checks pass**: list / new / edit at
  360, 390, 768, 1024, 1280, 1440, 1920 plus 125% and 150% zoom (27
  checks), plus empty-list, error-state and discard-dialog at 360 (3
  checks). No horizontal page overflow and no page errors; drawer below
  lg, table→cards below md, dialogs stack buttons below sm. The sweep
  runs the real app against Playwright route fixtures (test-harness
  only — the app itself is mock-free). It caught one real bug, now
  fixed: the desktop table now lives in an `overflow-x-auto` wrapper so
  it scrolls inside its card at 768–1024px instead of widening the page.
