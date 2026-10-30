# Authentication UI/API audit

## Summary

- **Implemented:** Outfit/Poppins theme hookup; responsive auth card and type tokens; separate first/last-name inputs; inert social sign-in buttons; loading labels; real email-verification-and-login endpoint; phone normalization and client validation; unsupported reset/code operations now fail without issuing guessed network requests.
- **Verified:** backend route/source inspection in `apps/api/src/http/routes/auth.routes.ts`, `apps/api/src/modules/auth/auth.handlers.ts`, and `apps/api/src/modules/auth/auth.service.ts`; frontend uses same-origin `apiFetch`.
- **UNVERIFIED:** visual pixel comparison against Figma (not provided); exact Next.js font download/build in this sandbox; whether already-verified links have a distinct backend response; profile-complete destination; any auth contract not evident in source or `docs/openapi.yaml`.

## Backend auth inventory (source-confirmed)

All paths below are mounted under `/api/v1/auth` unless marked `/api/v1/me`.

| Method + path                   | Request                                    | Success response                                                                                  | Observed errors                                                                                                                | Frontend use                                                                                   |
| ------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| POST `/register`                | `{ email, password, firstName, lastName }` | 201 `{ data: user, emailVerificationToken? }` (token only dev/test)                               | `VALIDATION_ERROR` 400; `EMAIL_ALREADY_EXISTS` 409; internal error 500                                                         | Yes, signup (`api.ts`)                                                                         |
| POST `/login`                   | `{ email, password }`                      | 200 `{ user, expiresIn }`; sets HttpOnly `sellonit_access_token` cookie                           | `VALIDATION_ERROR` 400; `INVALID_CREDENTIALS` 401; `ACCOUNT_UNAVAILABLE` 403; `EMAIL_NOT_VERIFIED` 403                         | Yes (`authService.ts`); account currently routes to `/account`                                 |
| GET `/me`                       | Cookie                                     | `{ data: user }`                                                                                  | `UNAUTHORIZED` 401; `USER_NOT_FOUND` 404                                                                                       | Yes (`AccountPanel`, verify preflight)                                                         |
| PATCH `/me`                     | `{ phone }`                                | 200 `{ data: user }`                                                                              | `UNAUTHORIZED` 401; `INVALID_PHONE` 400                                                                                        | Yes (`AccountPanel`)                                                                           |
| POST `/verify-email-and-login`  | `{ token }`                                | 200 `{ user, expiresIn }`; sets HttpOnly session cookie; marks email verified and creates session | `VALIDATION_ERROR` 400; `INVALID_VERIFICATION_TOKEN` 400 for invalid/expired/consumed; `ACCOUNT_UNAVAILABLE` 403; internal 500 | Yes (`verifyEmail` via callback)                                                               |
| POST `/verify-email`            | `{ token }`                                | `{ data: { verified: true } }`; does not establish session                                        | `VALIDATION_ERROR` 400; `INVALID_VERIFICATION_TOKEN` 400                                                                       | No: callback must use session-establishing route                                               |
| GET `/verify-email/:token`      | Token path parameter                       | Same as POST `/verify-email`; does not establish session                                          | Same as above                                                                                                                  | No                                                                                             |
| POST `/send-phone-verification` | `{ email }` (email lookup key)             | `{ data: { sent: true } }`                                                                        | `VALIDATION_ERROR` 400; `USER_NOT_FOUND` 404; `PHONE_NOT_SET` 400; `PHONE_ALREADY_VERIFIED` 409; SMS/configuration errors      | No; existing account UI does not currently expose phone-verification control                   |
| POST `/verify-phone`            | `{ token }`                                | `{ data: { verified: true } }`                                                                    | `VALIDATION_ERROR` 400; `INVALID_VERIFICATION_TOKEN` 400                                                                       | No                                                                                             |
| GET `/api/v1/me`                | Cookie                                     | `{ data: user }`                                                                                  | Same auth middleware                                                                                                           | Frontend `getMe` currently calls `/auth/me`; this separate route is duplicate backend behavior |

No backend forgot-password, reset-password, email-resend, generic code-resend, or generic code-verify route was found in route registration or handlers. The frontend does not ship requests to these unconfirmed routes.

## Frontend auth inventory

| Feature                           | Files                                                       | Endpoint                                                        | Backend support                                                                 |
| --------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Login                             | `components/login/LoginForm.tsx`, `lib/auth/authService.ts` | POST `/auth/login`                                              | Yes for email/password; **no** phone identifier support                         |
| Registration                      | `components/auth/CreateAccountForm.tsx`, `lib/auth/api.ts`  | POST `/auth/register`                                           | Yes for email, password, first/last name; phone in email field fails validation |
| Email verification callback       | `components/auth/VerifyEmailConfirm.tsx`, `lib/auth/api.ts` | POST `/auth/verify-email-and-login`                             | Yes; sets browser-managed cookie and returns authenticated user                 |
| Account/session hydration         | `components/auth/AccountPanel.tsx`                          | GET `/auth/me`, PATCH `/auth/me`                                | Yes                                                                             |
| Phone verification                | Existing account/legacy UI                                  | POST `/auth/send-phone-verification`, POST `/auth/verify-phone` | Backend exists; not currently consumed in account UI                            |
| Forgot password/code/new password | `components/password-reset/*`, `lib/auth/authService.ts`    | No network request is sent for unsupported operations           | No backend routes; graceful explicit failures                                   |
| Email verification resend         | `app/auth/verify-email/page.tsx`, `lib/auth/api.ts`         | No network request is sent                                      | No backend resend route; graceful failure                                       |
| Google/Apple                      | `components/login/LoginForm.tsx`                            | None                                                            | Not wired; intentionally inert                                                  |

## Mismatches

- Backend login and registration accept only an `email` field and validate it as an email. Frontend accepts phone numbers; API calls are therefore not known to succeed for phones. We do not change the field shape or pretend the backend supports phone login/registration.
- Frontend registration's phone-valid path is intentionally retained per UI requirements, but submits that value in existing `email`; backend returns `VALIDATION_ERROR`. This is a known gap, not a new endpoint/field.
- UI `ACCOUNT_NOT_VERIFIED` handling is retained; backend currently emits `EMAIL_NOT_VERIFIED` (mapped to same state). Current backend has no email resend route, so resend fails gracefully.
- Reset/code UI exists and persists route/identifier/cooldown only; API actions fail with a clear message because matching backend endpoints are absent. Password/code/reset token are not persisted.
- Backend verification endpoint that establishes a session is `/auth/verify-email-and-login`, not `/auth/verify-email`; callback now calls the former.
- The design asks for Account details in logged-out reset header; implemented as specified and flagged below as likely design inconsistency.
- Reset subtitle says “phone number” but the field accepts email or phone; copy is implemented as specified.
- The profile-completion target is not represented as a backend flag. Callback currently routes to existing `/account`, where profile/phone completion is managed.

## Unsupported frontend features and behavior

- Password reset send/verify/update: screens remain available; service functions reject locally with a “not supported” failure. Recommended backend addition: send reset token/code, verify it, and consume a short-lived reset token for password update.
- Resend email verification: existing UI remains; service rejects locally, no network call. Recommended backend addition: rate-limited resend endpoint with non-enumerating response.
- Resend account verification / generic OTP verify: retained UI fails visibly and makes no request. Add purpose-aware operations if these flows are still required.
- Phone auth/signup: client normalization/validation remains; the existing backend only accepts email. Add explicit identifier-type support rather than overloading `email` if phone auth is desired.
- Google and Apple: rendered but inert until an OAuth handler/backend provider integration is supplied.

## Backend features not consumed

- `POST /verify-email` and `GET /verify-email/:token` only verify without session establishment; callback uses `/verify-email-and-login` instead to satisfy instant-login behavior.
- Phone verification endpoints exist, but no phone verification flow is surfaced in the account page; could be consumed when an account-design flow is defined.
- `GET /api/v1/me` duplicates the auth router's `/auth/me`; frontend uses the latter to match existing client convention.

## Instant login after email verification

Callback reads `token` from the query string, checks for an existing signed-in user via `/auth/me` when a pending registration email is available, and stops with a clear different-account message if the current user differs. Otherwise it posts `{ token }` to `/auth/verify-email-and-login`. Backend sets the HttpOnly session cookie and returns `{ user, expiresIn }`; browser sends cookie on the subsequent `/account` request. Existing `/account` displays loading while `getMe` resolves, so it does not rely on a client token hydration race.

Invalid/expired/consumed tokens show the backend's invalid-token message and recovery links; network/server errors offer retry. “Already verified” is not a distinct backend error: a consumed link currently maps to `INVALID_VERIFICATION_TOKEN`, so the UI cannot distinguish that case. The different-account recovery message advises logging out; no logout endpoint exists to perform it. Whether `/account` is the correct destination for a fully complete profile is unconfirmed.

## Google/Apple readiness checklist

- [x] Buttons visibly rendered on Login with Google G and Apple mark.
- [x] Buttons do not submit the form and are inert/accessibility-marked.
- [x] TODO comments identify integration points.
- [ ] Choose OAuth provider flow and redirect/callback URL.
- [ ] Backend creates/links Sellonit users and issues the same HttpOnly session cookie.
- [ ] Add loading/error/cancel states and test both provider callbacks before removing inert state.

## Backend requests (handoff)

1. **Phone login/signup support:** define a backward-compatible contract with `identifier` and `identifierType` (email/phone), validation, normalization, and generic credential errors. Current UI cannot safely call this without the backend change.
2. **Forgot password:** provide send-code, verify-code, and reset-password operations, with exact request/response and stable error codes; recommended code response must never contain a password and reset token should be short-lived and single use.
3. **Resend email verification:** provide rate-limited resend keyed by email, non-enumerating success response, and defined rate-limit errors.
4. **Purpose-aware verification codes:** if the UI's account-verification OTP remains a requirement, provide a purpose-aware resend and verify contract (or explicitly remove this flow from product requirements).
5. **Already-verified link behavior:** return a distinct stable error/result for already verified so UI can show a precise recovery state rather than treating it as expired/consumed.
6. **Account destination:** expose profile-completeness in user response (or document exact next route); current callback routes to `/account`.
7. **Logout:** provide logout/session-revocation endpoint if recovery should sign out a different account from the verification callback.

## Design assumptions and gaps

- [I] Error color uses existing `danger` token; success uses existing `success` token.
- [I] Name placeholders “Enter your first name” / “Enter your last name”; password placeholders follow provided copy.
- [I] Loading labels use ellipsis and no spinner, matching explicit button spec.
- [I] Inert social controls use disabled cursor/ARIA state until OAuth is wired.
- [E] Header padding/height, shadow, input dimensions and responsive type snap to the closest CSS/token values; font embedding may fall back if external font fetch is unavailable at build time.
- Mobile spec's 10px-ish input text is not used: input text remains >=16px, labels >=14px, helper/rules >=12px, and tap targets >=44px for accessibility.
- Header label “Account details” on a logged-out reset screen looks inconsistent with the logged-out Login header.
- Reset subtitle says phone number while field label permits email or phone.
- No designs supplied for check-your-email, OTP/code entry, new-password, verification success/failure; those existing screens retain their own layout beyond shared primitives.
- Signup design says “Email address” while preserved behavior accepts phone in the same field; backend only accepts email. This remains a mismatch pending product/backend decision.

## Test notes and results

- `npm ci` completed successfully; npm reported 8 dependency audit findings (6 high, 2 critical). Added self-hosted Fontsource Outfit/Poppins packages so production build does not depend on Google Fonts network access.
- Web Vitest: 74 tests pass, including presentation-token source assertions, password rule validation, phone normalization and the real verify-and-login request.
- Web typecheck and `npx eslint apps/web/src --max-warnings 0` pass. Web production build passes.
- Root `npm run lint` is blocked in its prelint Prisma generation step: Prisma binary download from `binaries.prisma.sh` failed due sandbox network restrictions. Direct repository-wide eslint also reports pre-existing/generated Prisma unsafe-type diagnostics in `apps/api`; backend was not changed.
- No browser/Playwright executable is installed. The presentation test verifies source CSS values, not computed browser styles; screenshots and runtime viewport measurements remain UNVERIFIED.

## Added chooser/account-details design notes

### BagMark

- Reusable component: `apps/web/src/components/brand/BagMark.tsx`, one named export `BagMark`.
- Its SVG paths are placeholder artwork. Replace them with the final mark while preserving the `0 0 56 60` viewBox, public props, `stroke="currentColor"`, and scaling classes. Default color comes from the existing orange token.
- Used only on the sign-up-method chooser (`/auth/register`) and account-details form (`/auth/register/account-details`). It is intentionally absent on Login and Reset password.

### Routing

- `/auth/register` is now the sign-up-method chooser.
- “Continue with email” navigates to `/auth/register/account-details`, which hosts the existing `CreateAccountForm`.
- Existing catch-all legacy form-step URLs under `/auth/register/*` redirect to `/auth/register/account-details`; the plain `/auth/register` route is the new chooser entry.
- The register layout selects its header label from the path: “Sign up” for the chooser and “Account details” for the form.

### Design assumptions and gaps

- [E] Button radius uses new `--radius-button: 16px`; social and chooser primary buttons use 64px height as the nearest existing scale to the estimated 66px.
- [E] Icon-to-heading spacing is 24px, heading-to-subtitle is 8px, chooser social button gap is 16px, and the OR divider has 24px vertical padding.
- [I] BagMark is 36px wide below 768px and 56px from 768px, using one responsive component.
- [I] Account-details form retains email-or-phone validation and normalization in the email-labelled field to preserve the earlier behavior. Backend registration accepts email only; phone registration is unsupported by the inspected backend.
- [I] Setup error/loading states reuse the current inline-error and “Creating account…” patterns.
- Provider logo order differs as requested: chooser label then logo; Login logo then label.
- The “Sign up” and logged-out “Account details” header labels differ by step; “Account details” still reads like a logged-in label.
- The default eye examples conflict. Both fields use the consistent behavior: crossed eye when hidden, open eye when visible.
- Login and Reset password have no BagMark; confirm whether that is intentional across auth screens.
- No mobile chooser frame was supplied; mobile uses the shared card and accessible minimum type/tap targets.
- No designs were supplied for code entry, new password, check-your-email, verification success/failure, or account-created confirmation. Existing screens/routes remain; successful registration currently goes to the existing check-your-email route.
- No terms/policy routes were found, so those words remain plain text.

### Google/Apple readiness (updated)

- Provider buttons appear on Login and the chooser. Login uses logo then label; chooser uses label then logo.
- Both sets are visibly rendered, `aria-disabled`, have no handler, and make no API calls. Provider marks are shared from `SocialProviderMarks.tsx`; chooser buttons have `TODO(google-auth)` and `TODO(apple-auth)` comments.
- To enable each provider, supply its OAuth start handler/redirect, callback route, backend account-link/session behavior, and loading/error/cancel handling; remove `aria-disabled` only after testing the full flow.

### Extension verification

- BagMark component tests cover SVG rendering, decorative ARIA, sizing classes, and titled image semantics.
- Web Vitest: 77 tests pass; web typecheck, frontend ESLint, and production build pass after building shared workspace packages.
- CSS/source contract tests cover declared card geometry, typography, chooser copy/provider order, account form placeholders, rule color logic, disabled-submit wiring, and card-width bounds at 320/390/768/1024/1440.
- UNVERIFIED: no browser/Playwright executable is available, so these are source/CSS assertions rather than computed browser styles. No screenshots or real-browser horizontal-overflow checks were possible.

## Root landing sign-up chooser replacement (2026-10-19)

- Replaced the inline marketing card on `/` with the existing `SignupMethodChooser` component; `/auth/register` continues to render that same component. No duplicate chooser/card was introduced and no obsolete component file needed deletion.
- Preserved the root `AuthPage` shell and its “Learn more” header link, while `/auth/register` retains its route-specific “Sign up” header from the register layout. Root continues to inherit the app-level metadata; no page metadata override was added.
- Previously, “Get Started” linked to `/auth/register`, which now directly displays the chooser. “Continue with email” proceeds to the existing `/auth/register/account-details` form; footer “Log in” goes to `/auth/login`. Google and Apple remain visible and `aria-disabled` with no API/provider handlers.
- Inspection found no root auth redirect, guard, analytics, middleware, or proxy behavior to preserve. No backend files, contracts, or auth features/routes were changed or removed. Changed files: `apps/web/src/app/page.tsx`, `apps/web/src/lib/auth/authPresentation.test.ts`, `apps/web/src/components/reuseable/PrimaryButton.tsx` (stale comment wording), and this audit.
- Added source-contract assertions that both routes use the shared chooser, landing header label remains “Learn more,” and old landing marketing copy is absent. Existing geometry assertions cover the card width at 320, 390, 768, 1024, and 1440 CSS pixels.
- UNVERIFIED: no browser-based runtime layout/overflow measurement or screenshots were performed; width assertions verify declared/source geometry only. No deletion occurred.

## Post-registration success and role selection (2026-10-21)

### Flow and routes

- Registration continues to `/auth/verify-email` (check-email). The verification link lands at `/auth/verify-email/confirm`; after the existing verify-and-login endpoint establishes its session, a newly verified user is sent with `router.replace` to `/auth/welcome`.
- `/auth/welcome` is a standalone, session-guarded success screen and can be used by future Google sign-up without requiring email-verification state. Its CTA navigates to `/auth/role-selection`.
- `/auth/role-selection` is also session-guarded. The native radio group remembers only its selected role ID through the existing session-storage flow helper. Continue calls the local role API, receives a recommendation and navigates to its `nextRoute`; Back is a link to `/auth/welcome`, not browser history.
- All current local recommendation tracks route to the existing `/account` destination. There are no role-specific frontend onboarding routes yet, so role-specific onboarding screens are recorded as missing routes/designs.
- The already-verified/different-session callback preflight remains unchanged: returning verified users retain the existing home/account destination; the success screen is not made their default destination. The new screen itself has no timed redirect.

### Backend contract inventory and readiness

- Inspected API route registrations and `docs/openapi.yaml` read-only. No role-selection or onboarding-preference endpoint exists. Existing backend `UserRole` values (OWNER, ADMIN, STAFF, SUPPLIER, RETAILER) are authorization/business roles, not the new onboarding-intent choices; the frontend does not map or submit the new choices as backend permissions.
- `roleApi` defaults to `localRoleApi`; it performs no network request and uses one role-to-track/route lookup. `httpRoleApi` is a typed, non-networking TODO skeleton. When a backend contract is agreed, the one-line implementation switch is the exported `roleApi` assignment in `apps/web/src/lib/onboarding/roleApi.ts`.
- Persisted role ID is sufficient to re-derive the local recommendation lookup for later screens; no labels, business data, or speculative recommendation payload are stored.
- **PROPOSED backend request (not implemented or called):** define an authenticated `POST /api/v1/me/onboarding/role` accepting `{ "role": "entrepreneur" | "retailer" | "supplier" }` and returning a stable recommendation (`role`, `track`, `nextRoute`); define a matching authenticated `GET` to read the current role/recommendation so returning users can skip role selection. Specify validation, idempotency, versioning, and authorization before adoption. These paths are proposals only, not existing endpoints.
- Google/Apple provider buttons remain inert and make no provider/API calls. The standalone `/auth/welcome` route is ready as a success destination for a future Google flow, but provider callbacks/session creation are still unimplemented.

### Design assumptions and gaps

- [I] Role IDs (`entrepreneur`, `retailer`, `supplier`) and one-to-one recommendation tracks are inferred from the descriptions; they are onboarding preferences, not backend permission roles. The full descriptive radio copy is inferred UI wording for these intents and needs product/design confirmation.
- [I] With no dedicated onboarding entry for any track, local recommendations use `/account` as the existing next step. The recommendation-result screen is not invented; role-specific onboarding screens/routes remain missing.
- [I] Selection is persisted as a single role ID in session storage. A recommendation is re-derived from that ID and the local lookup rather than storing duplicate recommendation fields.
- [I] The save-in-progress label is “Saving…” and uses the shared darker loading-button state. Save failure retains the role and shows the specified inline error.
- [I] Success icon is 64px on mobile and 96px from `md`; body text uses the existing type scale and a 360px maximum width. No status artwork is supplied, so `SuccessCheckIcon` uses the existing success token and line icon conventions.
- [C] The success header's right label is “Account details”; this appears odd on a success screen and is retained as specified.
- [C] The design's “sucessfully” typo is corrected to “successfully”. The party-popper emoji is decorative (`aria-hidden`) so the accessible heading is “Account successfully created”.
- [C] The role screen has no BagMark, unlike the other account cards; implemented as specified.
- [C] The design's 624px role-card width and 48px side padding differ from the shared AuthCard's 632px cap and 36px desktop sides. The shared responsive AuthCard wins; card widths/padding are not hardcoded.
- [E] Role subtitle max width, option-card padding/radius/gaps, radio sizing, and body typography snap to existing responsive/type tokens; option labels remain 16px minimum and controls meet the 44px tap-target floor.
- [I] The success title focus moves on mount using a programmatically focusable heading. Unauthenticated guard checks use the existing `/auth/me` session endpoint; HTTP 401 redirects to Login, while network/server errors remain recoverable and do not bounce the user to Login.
- No mobile frames, exact role-specific onboarding designs, recommendation-result design, Google OAuth callback, or current-role backend read/write contract were supplied. Browser viewport measurements remain to be verified in a real layout engine.

## Post-signup persistence and authenticated destination gates (2026-10-21)

### Refresh diagnosis and recovery behavior

- **Root cause:** `VerifyEmailPage` used `useSyncExternalStore` with a server snapshot that is always `null`, then immediately redirected when that temporary null appeared. That mistaken guard sent users to `/auth/register`, whose page renders the account-creation chooser. The pending email was stored only in tab-scoped `sessionStorage`; a normal reload generally preserves it, but that scope is brittle and the hydration guard could discard the page before reading it.
- Pending verification now stores only `{ email, expiresAt }` in browser `localStorage` for 24 hours. Passwords and other signup fields are never stored. Expired/malformed records are removed; successful verification and successful login clear the record (and any legacy session-storage value). Browser storage is origin/browser-local and does not share sessions or email state between Safari and Brave.
- A missing/expired record no longer redirects. The check-your-email page stays visible with an editable email field, resend action, “I’ve verified my email” action to `/auth/login?email=...`, and a separate Log in link. The email query is encoded and remains subject to the login page’s existing email validation.
- The verified-email action is a navigation aid for cross-browser verification, not a status check: the user must sign in in the browser where they want to continue. No verification-status polling or status endpoint was found.

### Login and post-auth destination inventory

- Read-only inspection of backend `publicUserSelect`, `AuthUser`, `/auth/login`, `/auth/me`, and OpenAPI confirms the returned user includes identity/contact/status/verification timestamps, but **no onboarding role/status**. Existing backend `UserRole`/business membership roles are authorization values, not the product onboarding preferences. The interim source of truth is `readOnboardingRole()` in the existing flow persistence (sessionStorage); a fresh browser/tab without that value goes to role selection until the user chooses there.
- `getPostAuthDestination()` sends users with no locally stored role to `/auth/role-selection`; with a stored role it reads `roleApi.getRecommendation(role).nextRoute`. There is no existing `next`/return URL support in the repo (only the validated `?email=` login prefill), so no next/return parameter was added.
- Changed direct default-to-`/account` redirects:
  1. `LoginForm` success now clears pending email and routes through `getPostAuthDestination()`.
  2. `VerifyEmailConfirm`’s already-verified session branch now clears pending email and routes through the same gate. Fresh verification still shows the existing standalone `/auth/welcome` success screen; that guarded route forwards a role-selected user to the recommendation instead of trapping them there.
  3. `CodeForm`’s verify-account success now routes through the shared post-auth gate.
- Added an authenticated visitor gate for `/` and ordinary `/auth/*` entry/form routes. `/auth/welcome`, `/auth/role-selection`, and `/auth/verify-email/confirm` retain their specialized guards/verification-account mismatch logic. The role route’s session guard forwards a user with a saved role to its recommendation, preventing a redirect loop. Protected routes retry a 401 once after a short delay before sending the user to Login; generic public-route checks simply leave the public page available if session lookup fails.
- The existing `/account` route/card was **kept**. No route file was removed. `/account` remains the current local recommendation for all three roles because no role-specific frontend onboarding routes exist; it is no longer the login, generic auth-entry, root, or verification default.

### Backend requests and limits

- Backend request: return the chosen role/onboarding status on the user object so any browser can skip role selection. Specifically, include the value in authenticated login and `/auth/me` responses. Until then, another browser has no role record and correctly starts at role selection.
- Add an authenticated or privacy-preserving verification-status lookup so the check-email page can learn that a link was opened in a different browser and offer sign-in. No such endpoint was found; the client does not poll.
- Add a supported email-verification resend contract. The current frontend `resendVerification` intentionally rejects locally because no email-resend endpoint exists in the inspected backend; the screen shows the recovery action and a polite failure if it is attempted. No speculative API URL is called.

## Supplier dashboard and session-flash update (2026-10-26)

### Routes and role destinations

- Updated the existing `lib/onboarding/roleApi` lookup as the single destination source: supplier → `/dashboard/overview`; entrepreneur and retailer → `/dashboard/coming-soon`. Login, onboarding, authenticated-entry redirects, and dashboard role corrections now use the shared post-auth route logic; `/account` is retained as a route but is no longer the default destination.
- The shared dashboard route guard sends an unauthenticated user to Login, an authenticated user without a stored onboarding role to role selection, and a user with a mismatched role to that role's configured destination. Entrepreneur/retailer receive the auth-shell “Your dashboard is coming soon” page; supplier receives the overview. Other dashboard navigation destinations use the shared “This section is coming soon” panel.
- Logout is not offered on coming-soon pages because no existing logout action/endpoint is available. No backend code or `BagMark` was modified.

### Dashboard API/data behavior

- Dashboard data is typed behind a single adapter chooser. The active local adapter returns structurally empty collections and zero numeric values; a typed future HTTP adapter is an unused, non-calling skeleton. No speculative URLs or backend requests were added. `useSupplierDashboard(range)` provides loading, error, retry, and range-specific results.
- UI presents only actual authenticated user fields (e.g. name/contact where available); dashboard metrics/currency default to zero, and chart, stock alerts, and orders render proper empty states. Populated data is supported through the typed adapter contract/test mocks only; no sample/design names, amounts, products, SKUs, or order IDs are supplied as defaults.
- The supplier workspace contains responsive setup progress, header/sidebar/mobile drawer, typed navigation, welcome/date presets, zero-safe summaries, an SVG sales chart with keyboard-usable tooltip and empty state, stock alerts, and responsive order table/cards. Profile setup remains a disabled progress-card link with a TODO; no profile form or backend wiring was added.

### Session-flash diagnosis and cache safety

- Root cause: guarded UI previously rendered a visible “Checking your session” message/wrapper during the asynchronous cookie-backed session check. Several screens also maintained their own session lookups, which could introduce inconsistent loading and account flashes.
- The shared session provider now owns the cookie-backed `GET /api/v1/auth/me` confirmation; server layout performs an initial check when the HTTP-only cookie is available, and client guard rendering uses non-text skeletons while the authoritative state is unresolved. Duplicate account-page session loading was removed. No guarded content is rendered until the session is server-confirmed.
- A small `sessionStorage` hint may paint a cached display name only. It is explicitly not an authorization source and cannot expose protected data; a failed/expired authoritative check clears it. A 401 receives one short retry for hydration/cookie timing, while transient failures remain retryable and do not become a logged-out redirect. Role stores in guards are read as an initial routing snapshot rather than subscribed to mid-interaction, so selecting a role does not prematurely redirect before Continue is pressed.
- Exact visible “Checking your session” copy is absent from `apps/web/src`. Account details use the shared provider; no backend/session contract changed.

### Backend contract and limitations

- Read-only inspection of backend routes, handlers, OpenAPI, and user response source found no implemented supplier analytics endpoint matching the documented supplier analytics parameters (including required `businessId`). No dashboard API was called or inferred. The local empty adapter remains active pending a confirmed contract and user/business identity fields.
- Auth user response confirms identity/contact/status/timestamps but not business name, business membership, profile-completion state, or onboarding role. The stored onboarding choice remains browser/session scoped as in the pre-existing flow. Cross-browser durable role routing and persisted analytics await backend support.

### Tests, validation, and UNVERIFIED items

- Added/updated coverage for local and mocked populated dashboard data, zero/empty states and forbidden sample strings, formatting/date presets, setup progress, role routes and session gates, navigation/placeholders, mobile drawer focus/escape/overlay/scroll-lock/focus return, range-based API hook states, stale-hint expiration, and chart tooltip keyboard focus.
- `npx vitest run` (from `apps/web`): **22 files passed, 162 tests passed**. `npx eslint apps/web/src --max-warnings 0` passed; `npm run typecheck` passed after workspace packages were built. These frontend-scoped checks avoid the existing root Prisma-generation network blocker and pre-existing API lint diagnostics described above.
- UNVERIFIED: browser viewport/runtime overflow and real-device drawer behavior; no browser viewport checks were run. No screenshots or design assets were available/required. The live dashboard API remains unverified/unimplemented by design.
