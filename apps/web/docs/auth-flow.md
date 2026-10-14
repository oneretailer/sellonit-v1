# Real authentication flow

## Screen order

`/auth/register` (names, email, password) → `/auth/register/phone` (optional phone, submits registration) → `/auth/verify` (only if a phone was supplied; may skip) → `/verify-email` → `/auth/login` → `/account`.

The controller's `REGISTRATION_STEPS` array in `RegistrationFlow.tsx` controls the order. Phone verification is placed first because registration immediately starts its 10-minute expiry, not because email verification depends on it. Email and phone verification are independent. Login requires email verification only.

Draft details/password stay in memory, never local/session storage, and are discarded after successful registration. Refreshing a guarded registration step returns to the start. This client guard is navigation guidance, not authentication. Inbox links at `/verify-email?token=...` work without registration state, including in another browser. Login and `/account` still use real backend sessions.

## Backend contract inspected (read-only)

Base `/api/v1/auth`. All error envelopes are `{error:{code,message,requestId}}`.

| Method/path | Validation/input | Success and effects |
| --- | --- | --- |
| POST /register | `{email,password,firstName,lastName,phone?}`. Email regex requires non-whitespace local/domain and dot; password 8–128 chars; trimmed names 1–80 chars; optional phone string ≤30 chars, normalized from `0` +10 digits, `234` +10 digits, or `+234` +10 digits (service strips punctuation). | 201 `{data:user,emailVerificationToken?}`. Creates user with bcrypt password hash; creates SHA-256-hashed email token (24 hours), sends Resend link to `${VERIFICATION_BASE_URL}/verify-email?token=...`. If phone provided, creates hashed six-digit SMS token (10 minutes), sends via Twilio. Email token returned only when API NODE_ENV is development/test. No session. |
| POST /verify-phone | `{token}`; token must be a string. No session required, but an existing unexpired, unconsumed PHONE token is required. | 200 `{data:{verified:true}}`; consumes token, updates phone verification timestamp. No session. |
| POST /verify-email | `{token}`; query token also accepted. String required; valid EMAIL record required. | 200 `{data:{verified:true}}`; consumes token, updates email verification timestamp. No session. |
| GET /verify-email/:token | Same token checks; URL parameter takes precedence. | Same as POST. Web uses POST to avoid accidental link prefetch consumption. |
| POST /login | `{email,password}`; email regex, nonempty password string. Correct password, ACTIVE user, verified email required. Phone verification not required. | 200 `{user,expiresIn:2592000}`; creates database session containing token hash, sets opaque `sellonit_access_token` cookie, HttpOnly, Secure, SameSite=Lax, path `/`, 30 days. Raw session token not in response JSON. |
| GET /me | Valid cookie or Bearer token; cookie preferred. Session must exist, be unrevoked and unexpired. | 200 `{data:user}`. `/api/v1/me` is also mounted with the same auth check. Business routes use the same middleware. |

User shape: id, email, firstName, lastName, phone, status, emailVerifiedAt, phoneVerifiedAt, createdAt, updatedAt. No password hash returned.

### Backend errors (status / code / exact message)

- 400 VALIDATION_ERROR: `Invalid registration details`, `Email and password are required`, or `Token is required`.
- 400 INVALID_PHONE: `Enter a valid Nigerian phone number`.
- 409 EMAIL_ALREADY_EXISTS: `An account with this email already exists`.
- 400 INVALID_VERIFICATION_TOKEN: `Verification token is invalid or expired` (wrong, expired, and consumed tokens are not distinguished).
- 401 INVALID_CREDENTIALS: `Email or password is incorrect`.
- 403 ACCOUNT_UNAVAILABLE: `This account is not active`.
- 403 EMAIL_NOT_VERIFIED: `Verify your email before logging in`.
- 401 UNAUTHORIZED: `Authentication required`.
- 404 USER_NOT_FOUND: `User not found`.
- 500 INTERNAL_ERROR: `An unexpected error occurred` (including delivery/database failures).

## Design differences

1. Details precede phone/OTP; there is no phone-first account creation API.
2. Phone has a separate optional collection screen. Leaving it empty creates the account without SMS and skips OTP.
3. Phone OTP follows successful registration; it does not log the user in. A skip action is available because phone verification is not a login prerequisite.
4. Email verification is a separate screen and necessary before login. Inbox links prefill a token; an explicit action consumes it.
5. Login is email/password, then the existing `/account` screen, not automatic login after OTP.
6. No fake resend/countdown/attempt-limit states. Existing classes, Field, AuthShell, typography, styles, and layout tokens are reused; no CSS changed. There is no `components/reuseable/` directory in this checkout.

## Local setup and blockers

No env file was changed. No `apps/web/.env*` file was present during inspection. In `apps/web/.env.local`, use:

```dotenv
API_INTERNAL_URL=http://localhost:4000/api
```

This is server-only. Browser calls remain relative `/api/v1/*`. The proxy appends `/v1/...`; omitting `/api` produces the wrong backend route. The Next config's default already includes `/api`.

The API was not running on port 4000 during verification, so real registration, SMS/email delivery, login cookie, and account access could not be exercised. Start the API with its existing database/setup; then run the flow above. This task did not create API env files, database rows or infrastructure.

In API development/test, registration returns `emailVerificationToken`. `DevEmailVerification.tsx` (marked `// DEV-ONLY-REMOVE`) displays it and calls the real endpoint only when web NODE_ENV is not production. No mock tokens or OTP bypass are used. If the API is not in development/test, use the real inbox link instead. `VERIFICATION_BASE_URL` must point to the web origin. Missing/placeholder Resend credentials skip sending; the dev panel still works if the token was returned.

Missing/placeholder Twilio credentials skip SMS; no phone code is returned or logged by the API. Omit phone or skip phone verification to continue to email/login locally. Real but invalid delivery credentials can cause registration to return 500 after user creation; blindly retrying can then produce duplicate-email. Backend delivery is not transactional with registration.

Secure cookies should be tested on the HTTPS forwarded web origin. Direct cross-origin browser API calls are not used, so CORS is not needed for this proxy flow.

## Backend gaps to hand off

- No standalone phone send/resend endpoint; no resend cooldown or attempt limit.
- No email resend endpoint or expired-email recovery flow.
- Invalid/expired/consumed verification tokens share one error code; UI cannot distinguish them.
- Phone verification identifies a record by code alone, not phone/user; the client cannot bind verification to the displayed number.
- No phone-first registration or OTP login endpoint; current authentication is email/password.
- No phone update endpoint for existing users.
- No logout endpoint.
- Registration can partially succeed before delivery failure; make notification failure/retry recoverable.

No absent endpoint is called or simulated. No dev-otp/DEV-OTP-REMOVE code was found in apps/web.

## Verification

- Web typecheck: passed. Web tsconfig resolves committed shared source types, avoiding a build/write under packages for this web-only task.
- Root ESLint configuration scoped to apps/web: passed.
- Web unit tests: passed; cover input validation and error mapping, including wrong/expired/consumed-token equivalence and duplicate email.
- These tests do not constitute a live browser/API walkthrough. That remains blocked by the stopped API.
