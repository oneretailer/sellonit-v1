# Auth routing, verification and role recommendation — rework report

Scope: **`apps/web` only**. No changes under `apps/api`, `apps/worker` or `packages/*`
(no OpenAPI/spec edits, no generated type edits). The backend contract is treated
as read-only truth.

Flow in scope:

```
Register → Verify email (link may open in another browser/device) →
"How will you use Sellonit?" → recommendation → dashboard
```

Acceptance goals:

1. Onboarding state comes from **server user data only** (never storage/cookies alone).
2. Once onboarded — on any browser — the user is never asked again.
3. One destination function drives every guard, so there is no ping-pong.
4. Verification is detected automatically (no 20s+ manual wait).
5. Picking a role shows a recommendation; nothing is saved or navigated until
   "Continue as X".
6. **Only the supplier workspace exists today**: retailer and entrepreneur
   accounts get a **custom 404 page** (product directive).

---

## 1. Why the redirect loop happened

There were **six independent deciders** and **two sources of truth**:

| Decider                                                                         | Source of truth                                   | Result                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------ |
| `RequireAuthenticatedSession` (guarded `/auth/role-selection`, `/auth/welcome`) | server user (`onboardingIntent`)                  | onboarded → `/dashboard/overview`                            |
| `DashboardRoute`                                                                | **sessionStorage role only**                      | `role === null` → `/auth/role-selection`                     |
| `postAuthDestination` (login / verify-email / reset success)                    | server intent, **falling back to sessionStorage** | role-specific route                                          |
| `roleApi.getRecommendation`                                                     | sessionStorage                                    | non-supplier → `/dashboard/coming-soon`                      |
| `DashboardRoute.routeMatches`                                                   | sessionStorage                                    | supplier on `/dashboard/coming-soon` → `/dashboard/overview` |
| `/auth/verify-email` + `/auth/verify-email/confirm`                             | their own local logic                             | third entry point into the flow                              |

Concrete loop: a user who onboarded on another browser has
`onboardingIntent` on the account but **no sessionStorage role**. The dashboard
guard read only storage → `null` → sent them to `/auth/role-selection`;
`RequireAuthenticatedSession` read the server user → already onboarded → sent
them back to `/dashboard/overview`. Each hop re-fetched `/auth/me`, so the loop
also looked like an endless "loading → bounce" flicker.

Contributing bugs:

- **Loading was treated as "not onboarded."** `status: 'checking'` and `'error'`
  both looked like "no role", so an unresolved session triggered redirects.
- **`RoleSelectionForm` threw away the API response.** `saveRole()` already
  returns the updated user; the form discarded it, so the dashboard guard still
  read stale/no data on the next screen.
- **`/dashboard/coming-soon` existed as a real route**, so a "wrong" role could
  be _parked_ there instead of being resolved once.
- **`subscribeWithoutRoleChanges`** was a no-op store subscription — dead code
  that made the dashboard look like it reacted to role changes when it did not.
- **Three entry pages** (`/auth/verify-email`, `/auth/verify-email/confirm`,
  `/auth/welcome`) each decided their own next step.

### Fix: one decision function

`apps/web/src/lib/auth/authDestination.ts` is now the only place that decides
where a signed-in user belongs. It reads **only** `status` +
`user.emailVerifiedAt` + `user.onboardingIntent`:

| Session                                             | Destination                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `checking` / `error` / authenticated without a user | `{ kind: 'loading', path: null }` — render a skeleton, **never redirect**       |
| `unauthenticated`                                   | `/auth/login`                                                                   |
| authenticated, `emailVerifiedAt == null`            | `/auth/verify-email`                                                            |
| verified, `onboardingIntent == null`                | `/auth/role-selection`                                                          |
| verified, onboarded                                 | `/dashboard/overview` (the dashboard decides whether that role has a workspace) |

`redirectTarget(destination, pathname)` returns `null` when the target **is** the
current page, and treats the whole `/dashboard/*` tree as one destination family.
That makes "redirect a page to itself" structurally impossible and stops a
signed-in supplier from being bounced out of a dashboard section.

Every guard now calls it: `RedirectAuthenticatedUser`,
`RequireAuthenticatedSession`, `AuthenticatedAuthRouteGate`, `DashboardRoute`,
the role-selection page and the success handlers (login, email verification,
password reset — via `getPostAuthDestination`, now a thin wrapper).

Storage is still used for **local selection memory only** (so "Go Back" keeps
the radio choice and a refresh inside the flow is friendly). It is never an
input to routing.

---

## 2. Why verification took 20s+ (and often never finished)

Root causes, in order of impact:

1. **Nothing polled.** `/auth/verify-email` made one `/auth/me` call through the
   initial session hydration and then sat still; a user who returned from their
   inbox had no way to be recognised.
2. **"I've verified my email" made no request.** It pushed
   `/auth/login?email=…` immediately, so verification was never confirmed —
   the user was told to log in even when already verified.
3. **Every guard hop re-fetched `/auth/me`.** The server-side initial read uses
   a 1.8s abort timeout; on failure the session becomes `checking`, the client
   fetches again, and the provider retries once after 180ms. Combined with the
   loop, one "wait" was routinely 2–4s per hop.
4. **Dev-only compile cost** made the same hops feel much worse in development
   (see timings below). This was _not_ fixed with dev hacks; it is Next.js dev
   compilation.

### What the check-your-email page does now

- Re-checks `GET /auth/me` every **2.5s** while the tab is **visible**.
- **Immediate** check on `focus`, on `visibilitychange`, and on a cross-tab
  signal (`BroadcastChannel` + `localStorage`/`storage` fallback, both in
  `try/catch`) published by the confirm page right after verification succeeds.
- Stops polling on success, on unmount, and after **120s** (then shows
  "Still waiting for confirmation" and points at the force-check button).
- On success: `acceptAuthenticatedUser(user)` then **one** `router.replace`
  through the shared destination (dashboard / role selection as appropriate) and
  a brief "Email verified. Taking you into Sellonit…" state.
- **"I've verified my email"** now performs a real check: verified → straight
  into the app; not verified → prefilled login (the only honest fallback without
  a status endpoint, see §6).
- `router.prefetch('/auth/role-selection')` and `/dashboard/overview` run on
  mount, so the post-verification hand-off is warm.

The confirm page shows the success state as soon as the API resolves (unchanged
behaviour) and now also broadcasts the signal to any open check-your-email tab.
If the verify response ever arrives without `emailVerifiedAt` (stale payload),
the page stamps it locally before routing — a just-verified account must never
be routed back to `/auth/verify-email`.

---

## 3. Retailer / Entrepreneur → custom 404 (product directive)

Only the supplier workspace exists, so:

- `PUT /auth/business-intent` still stores the choice (server truth, so the user
  is never asked again — on any browser).
- `DashboardRoute` resolves the session through the shared function; an onboarded
  account whose intent is not the supplier track calls **`notFound()`**.
- `apps/web/src/app/dashboard/not-found.tsx` renders the custom design
  (`components/errors/NotFoundPage.tsx`: Navbar + `AuthCard` + `BagMark`, title
  "This workspace isn't available yet", "Back to home").
- `apps/web/src/app/not-found.tsx` gives every unknown URL the same custom
  design instead of the Next.js default.

Because the throw happens during render it is also a **real 404**: with a
retailer session the server render answers `404` with the custom page
(verified, §7). Deleted as dead: `app/dashboard/coming-soon/page.tsx` and
`components/dashboard/ComingSoon.tsx` (no more "parked" roles).

Trade-off documented: `notFound()` from a client component on a _client-side_
navigation keeps the URL but cannot change an already-sent HTTP status; the
initial document request for that URL is a true 404.

---

## 4. Role selection → recommendation

- One route (`/auth/role-selection`), two views, same `AuthPage`/`AuthCard`:
  the choice list and `components/onboarding/RoleRecommendation.tsx`.
- Picking a radio **only** stores local selection memory. "Continue" switches
  the view. **Nothing is saved and nothing navigates.**
- The recommendation view uses the supplied design: white 36px-radius card,
  1px line border, header + subtitle, inner role card with `Recommended` pill,
  40px icon tiles, four bullets, full-width orange action, text-only "Go Back"
  with arrow. It reuses `AuthCard`, `PrimaryButton`, `SecondaryButton`,
  `InlineError`, `Spinner`, `ArrowLeftIcon` and the `@theme` tokens
  (`canvas`/`surface`/`line`/`subtle`/`ink`/`primary`), with 26px/32px title,
  24px padding and 32px gaps under 640px. Focus moves to the heading on mount
  and back to the chosen radio on "Go Back".
- **"Continue as X"**: `PUT /auth/business-intent` → the response user is pushed
  into the shared session (`acceptAuthenticatedUser`) → **one**
  `router.replace('/dashboard/overview')`. No extra `/auth/me`.
  Failure keeps the view and the selection, re-enables the button and shows an
  inline error (401 gets a "session expired" message).
- Copy lives in `lib/onboarding/roles.ts` as data (`ROLE_RECOMMENDATIONS`).
- Two deliberate deviations from the pixel spec, both to reuse existing
  components/tokens instead of one-off values: the card keeps `AuthCard`'s width
  ramp (416 → 560px) rather than a new 624px width, and the action uses
  `PrimaryButton shape="rounded"` (the `--radius-button` 16px token) instead of a
  new 8px radius.

---

## 5. Timings

Sandbox, production build (`next build` + `next start`), local mock API for the
session (no real backend available), `time_starttransfer` over 3 runs each.

| Page / state                           | Before (dev, cold) | Before (prod)           | After (prod)                    |
| -------------------------------------- | ------------------ | ----------------------- | ------------------------------- |
| `/auth/role-selection`                 | 299ms              | 16ms cold / 7–11ms warm | — (guarded; not measured again) |
| `/dashboard/overview` (supplier, 200)  | 435ms              | 41ms cold / 6–8ms warm  | **12–23ms**                     |
| `/dashboard/overview` (retailer → 404) | n/a (redirect)     | n/a                     | **15–18ms (HTTP 404)**          |
| `/auth/verify-email`                   | 343ms              | 33ms                    | **9–18ms**                      |
| `/auth/login`                          | 351ms              | 12ms                    | unchanged                       |

Dev cold numbers (299–435ms) are Next.js dev compilation, not app work; warm dev
is 31–45ms. No dev-specific code was added.

Perceived waits, before → after:

| Wait                            | Before                                                                   | After                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Verify link → app recognises it | never (no polling)                                                       | ≤2.5s (poll), ~instant on focus/visibility, immediate in the same browser (BroadcastChannel) |
| "I've verified my email"        | 0 requests, then a login form (~1 page load)                             | 1 × `GET /auth/me` + 1 navigation                                                            |
| Verify page → next screen       | loop, 2–4s per hop (1.8s server timeout + 180ms retry + re-fetch)        | 1 `router.replace`, prewarmed route                                                          |
| Role saved → dashboard          | PUT (returned user discarded) + guard re-fetch per hop + possible bounce | PUT response used directly, **one** `replace`, no extra fetch                                |
| Picking a role → recommendation | immediate but _saved and navigated_                                      | immediate, **no network**                                                                    |

---

## 6. Endpoint contract used (unchanged, verified against `apps/api`)

| Call                                                                                                            | Response                                 | Used for                                                                             |
| --------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `GET /api/v1/auth/me`                                                                                           | 200 `{ data: user }`, 401 `UNAUTHORIZED` | the only routing input (`emailVerifiedAt`, `onboardingIntent`); verification polling |
| `PUT /api/v1/auth/business-intent` `{ businessType }`                                                           | 200 `{ data: user }`                     | saving the role; response feeds the session (no re-fetch)                            |
| `POST /api/v1/auth/verify-email-and-login` `{ token }`                                                          | 200 `{ user, expiresIn }` + cookie       | link landing (`/auth/verify-email/confirm`)                                          |
| `POST /api/v1/auth/login` `{ email, password }`                                                                 | 200 `{ user, expiresIn }` + cookie       | login, then the shared destination                                                   |
| `POST /api/v1/auth/register`, `POST /api/v1/auth/verification-codes/verify`, `POST /api/v1/auth/reset-password` | —                                        | unchanged                                                                            |

`supplier → ENTERPRISE` (there is no SUPPLIER enum member; ENTERPRISE is the
supplier track), `retailer → RETAILER`, `entrepreneur → ENTREPRENEUR`.
Onboarded = `onboardingIntent != null`; verified = `emailVerifiedAt != null`.

---

## 7. Verification performed

| Command                                              | Result                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npx prettier --check "apps/web/src/**/*.{ts,tsx}"`  | pass ("All matched files use Prettier code style!")                                                           |
| `npx eslint apps/web/src`                            | pass, 0 problems                                                                                              |
| `npx tsc --noEmit -p apps/web`                       | pass, 0 errors                                                                                                |
| `npm run test -w @sellonit/web`                      | **25 files / 219 tests passed** (was 22 / 162)                                                                |
| `npm run build -w @sellonit/web`                     | pass; `/_not-found` + `/dashboard/overview` + `/dashboard/[...section]` built (20 routes; `coming-soon` gone) |
| `git diff \| grep -E '^(<<<<<<<\|=======\|>>>>>>>)'` | no merge markers                                                                                              |

Runtime smoke test with the production server and a local mock API
(`GET /api/v1/auth/me` returning a session):

| Request                                           | Result                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| `/nope`                                           | `404`, custom "Page not found" + "Back to home"                         |
| `/dashboard/overview` with a **retailer** session | `404`, title "Workspace not available — Sellonit", custom copy rendered |
| `/dashboard/overview` with a **supplier** session | `200`, supplier overview rendered                                       |
| `/auth/verify-email`                              | `200`, waiting state + polling UI                                       |

New tests cover: the destination table (loading/unauthenticated/unverified/
verified-not-onboarded/every onboarded role), `redirectTarget` loop-proofing and
the dashboard route family, dashboard 404 for retailer/entrepreneur (overview and
section), the custom not-found page, the recommendation copy, "picking a role
saves nothing", "Continue" payload + session refresh + single `replace`, "Go
Back" preserving the choice, a save failure keeping the view, an onboarded user
at `/auth/role-selection` redirected exactly once, the verify page auto-detecting
verification, the cross-tab signal, the force-check button, the prefilled-login
fallback, and cross-browser login going straight to the dashboard.

Removed tests that asserted the old behaviour: coming-soon redirects, the
sessionStorage role lookup in routing, and the `nextRoute` recommendation table.

---

## 8. Backend gaps (no changes made — described only)

1. **No verification-status endpoint.** `GET /auth/me` needs a session, so a
   link opened on **another device** cannot be detected automatically. Same
   browser/other tab is covered (cookie + BroadcastChannel). Other devices get
   the force-check button, the timeout message and a prefilled login. Suggested
   backend addition: `POST /auth/verification-status { email }` (rate-limited,
   no account enumeration) or a short-lived polling token issued at registration.
2. **No logout / no session revocation endpoint**, so the 404 page cannot offer
   "sign out" or "switch role". It only offers "Back to home".
3. **No role-change endpoint** beyond overwriting `business-intent`. The UI
   therefore never promises a role switch.
4. **No dashboard endpoints for retailer/entrepreneur workspaces** — that is why
   they do not exist yet; the 404 is the honest state.

### Placeholder copy to review

- Recommendation copy for **supplier** and **entrepreneur**
  (`ROLE_RECOMMENDATIONS` in `lib/onboarding/roles.ts`) — the retailer variant
  follows the supplied design; the other two are product copy written for this
  build.
- The availability note under the recommendation CTA ("… dashboard is still
  being built. Supplier tools are the first workspace available.").
- 404 copy (`app/dashboard/not-found.tsx`) and the check-your-email waiting /
  timeout strings.

---

## 9. Files changed (this task)

Added:

- `apps/web/src/lib/auth/authDestination.ts` — the single destination function,
  `redirectTarget`, `AUTH_ROUTE`, `DASHBOARD_BASE`.
- `apps/web/src/lib/auth/verificationSignal.ts` — cross-tab verified signal
  (BroadcastChannel + storage fallback, try/catch).
- `apps/web/src/components/onboarding/RoleRecommendation.tsx` — recommendation
  view (saves only on "Continue as X").
- `apps/web/src/components/errors/NotFoundPage.tsx` — reusable custom 404.
- `apps/web/src/app/not-found.tsx`, `apps/web/src/app/dashboard/not-found.tsx` —
  404 boundaries.
- Tests: `lib/auth/authDestination.test.ts`, `lib/auth/postAuthDestination.test.ts`
  (rewritten), `components/errors/NotFoundPage.test.tsx`.

Rewritten / updated:

- `components/auth/RedirectAuthenticatedUser.tsx`,
  `components/auth/RequireAuthenticatedSession.tsx`,
  `components/auth/AuthenticatedAuthRouteGate.tsx` — shared decision, skeleton
  while loading, retry on error, `router.replace`.
- `components/dashboard/DashboardRoute.tsx` — no storage role, no `routeMatches`,
  no coming-soon branch; `notFound()` for retailer/entrepreneur.
- `components/onboarding/RoleSelectionForm.tsx` — view switch, no save on select.
- `app/auth/verify-email/page.tsx` — polling, focus/visibility, cross-tab signal,
  force check, timeout, prefetch, verified state.
- `components/auth/VerifyEmailConfirm.tsx` — broadcast after success; never
  routes a just-verified account back to `/auth/verify-email`.
- `lib/onboarding/roleApi.ts` — `saveRole` returns `{ user, businessType }`;
  no `nextRoute`/`coming-soon` recommendations.
- `lib/onboarding/roles.ts` — recommendation copy as data.
- `lib/auth/postAuthDestination.ts` — thin wrapper over the shared decision.
- `lib/auth/AuthSessionProvider.tsx` — `AuthSessionStatus` re-exported from the
  destination module (single definition).
- Tests updated: `DashboardRoute.test.tsx`, `AuthenticatedAuthRouteGate.test.tsx`,
  `onboardingScreens.test.tsx`, `LoginForm.test.tsx`, `roleApi.test.ts`,
  `AuthSessionProvider.test.tsx`, `app/auth/verify-email/page.test.tsx`.
- Deleted: `app/dashboard/coming-soon/page.tsx`,
  `components/dashboard/ComingSoon.tsx`.

(The working tree also contains the earlier auth-contract sync from the previous
task — see `docs/web-auth-sync.md`.)

---

## 10. Post-delivery fix: signed-out visitors were bounced to login

Reported after delivery: `/` showed the login form instead of the sign-up
chooser, and "Create an account" (`/auth/register`) snapped back to login.

Cause (one line, shipped in the rework): `RedirectAuthenticatedUser` — the gate
wraps `/`, `/auth/register`, `/auth/forgot-password`, … — rendered the public
page for a signed-out visitor **and** still ran its redirect effect with
`destination.path = /auth/login`, so every public page immediately replaced
itself with login. The existing test only covered `/auth/login` itself, where
`redirectTarget` returns `null` because the target equals the current page, so
the bug passed CI.

Fix: on this gate, `login` is not a redirect target at all — it only answers
"is this page visible to the current visitor?". Signed-out visitors now stay on
the page they asked for; signed-in visitors are still sent to their single
resolved destination. Protected surfaces (`RequireAuthenticatedSession`,
`DashboardRoute`) still redirect signed-out users to `/auth/login`.

Regression tests added (4): a signed-out visitor on `/`, `/auth/register`,
`/auth/register/account-details` and `/auth/forgot-password` sees the public
content and `router.replace` is **never** called; the same is asserted for the
verification callback.
