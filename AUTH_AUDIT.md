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
