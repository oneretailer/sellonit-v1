# Auth registration & email verification — backend contract

Target implementation for the new Create account flow
(`Welcome → Create account → Verify email → link → Dashboard`). The frontend
(`apps/web`) is already wired to this contract. Where the current backend
(`apps/api`) differs, the difference is called out under **Current backend** —
implement the contract body/behavior and the frontend needs no further change.

All routes are mounted under **`/api/v1`** (the web app calls same-origin
`/api/v1/*`, proxied to the API). All request and response bodies are JSON.
All error responses share one envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the details you entered and try again.",
    "fields": { "email": "Enter a valid email address." },
    "requestId": "3fa4b1c2-…"
  }
}
```

- `fields` is **optional** and only present on `422`. Keys: `fullName`, `email`,
  `password`. Values are user-facing English, safe to display as-is.
- `message` is user-facing English, safe to display. No stack traces.
- `requestId` is present on every error (as today).

---

## 1. Register

### `POST /api/v1/auth/register`

Creates the account and sends the verification email.

**Request body**

```json
{
  "fullName": "Chukwudi Okechukwu",
  "email": "you@example.com",
  "password": "passw0rd"
}
```

| Field      | Rules                                                                                                                                                                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fullName` | Required. Trimmed. 2–80 chars. Must match `/^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u` (Unicode letters, spaces, apostrophes, hyphens, periods; must start with a letter). Single-word names are valid.                                                                                                                  |
| `email`    | Required. Trimmed and **lowercased**. Max 254 chars. Must match `/^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/` (no leading/trailing/consecutive dots in the local part; dotted domain with 2+ letter TLD). Unicode/IDN addresses are out of scope. |
| `password` | Required. **Never trimmed.** Min 8 chars, max 128 chars. Any characters allowed (letters, numbers, symbols, spaces). Must be hashed with bcrypt (cost 12, as today). Never logged.                                                                                                                                 |

**Name storage split (exact):** derive `firstName` = the first
whitespace-separated token of `fullName`; `lastName` = the trimmed remainder;
if `fullName` has no whitespace, store the same word in both fields. This
matches the frontend compatibility shim exactly.

**Note (transitional):** the current frontend also sends derived
`firstName`/`lastName` fields for the pre-contract backend. The contract
implementation may ignore them; it must read `fullName`.

**Success — `201`**

```json
{
  "data": {
    "id": "…",
    "email": "you@example.com",
    "firstName": "Chukwudi",
    "lastName": "Okechukwu",
    "phone": null,
    "status": "PENDING_VERIFICATION",
    "emailVerifiedAt": null,
    "phoneVerifiedAt": null,
    "createdAt": "…",
    "updatedAt": "…"
  }
}
```

The frontend does not rely on the body beyond the 201. Do NOT return the raw
verification token in the response (the current backend does this in
development — keep that dev-only behavior or drop it; the new flow does not
use it).

**Errors**

| Status | `code`                 | When                                        | `fields` |
| ------ | ---------------------- | ------------------------------------------- | -------- |
| `400`  | `VALIDATION_ERROR`     | Malformed body (missing/ill-typed fields)   | —        |
| `422`  | `VALIDATION_ERROR`     | Field rules failed (name/email/password)    | yes      |
| `409`  | `EMAIL_ALREADY_EXISTS` | Email already registered (case-insensitive) | —        |
| `500`  | `INTERNAL_ERROR`       | Server failure                              | —        |

**Current backend:** `POST /api/v1/auth/register` exists
(`apps/api/src/modules/auth/auth.service.ts` → `register()`,
`apps/api/src/http/routes/auth.routes.ts`). It takes `firstName`/`lastName`
(1–80 chars each) instead of `fullName`, optional `phone`, hashes with bcrypt
12, returns `409 EMAIL_ALREADY_EXISTS`, and answers field-rule failures with
`400` (no `fields`). Gaps: `fullName` shape, `422` + `fields`, `PENDING_VERIFICATION`
status on create.

---

## 2. Email verification link & template

Sent on successful register and on resend (§4).

**Link format (exact):**

```
${VERIFICATION_BASE_URL}/auth/verify-email/confirm?token=<token>
```

- `VERIFICATION_BASE_URL` is the web origin, no trailing slash (e.g.
  `http://localhost:3000`). **Change the path from the current
  `/verify-email?token=` to `/auth/verify-email/confirm?token=`.** (The web app
  redirects the old path during transition, but new emails must use the new one.)
- `token`: cryptographically random, ≥ 32 bytes, hex or base64url, URL-safe.
  The current implementation uses `randomBytes(32).toString('hex')` (64 hex
  chars) — keep it.

**Token storage & expiry (exact):**

- Store only a SHA-256 hash of the token (as today). The raw token exists only
  in the email link.
- **Expiry: 24 hours** from issue. Expired, unknown, and already-consumed
  tokens all fail identically (§3).
- **Single use:** consumed atomically (transaction) on successful verification.
- Issuing a new token (resend) invalidates nothing already issued is fine, but
  the newest link must always verify (recommend: revoke prior outstanding
  EMAIL tokens for the user on issue).

**Email (Resend) requirements:**

- From: `RESEND_FROM_EMAIL` (must be a verified sending domain).
- Subject: `Verify your Sellonit email address` (keep).
- Both HTML and plain-text bodies. The verification URL must be the only CTA
  and appear verbatim in the text body. HTML must escape user-provided names
  (the current template does — keep `escapeHtml`).
- Copy requirements: greet by first name (`firstName`), state that the link
  expires in 24 hours, and say the account was just created. Never include the
  password or any other secret.

**Current backend:** token generation, hashing, 24h expiry and the email exist
(`auth.service.ts` → `sendEmail()`,
`apps/api/src/modules/auth/templates/email-verification.template.ts`).
**Gap:** the link path is `/verify-email?token=` (root route), not
`/auth/verify-email/confirm?token=`.

---

## 3. Verify email

### `POST /api/v1/auth/verify-email`

**Request body**

```json
{ "token": "b3a1…64-hex…c0" }
```

**Success — `200`**

```json
{ "data": { "verified": true } }
```

AND — **new in this contract** — the success response **establishes the
session** exactly like `POST /api/v1/auth/login` does:

- Cookie name `sellonit_access_token`, value = the session token (opaque,
  random ≥ 32 bytes; store only its SHA-256 hash).
- Attributes: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`
  (30 days).
- So the user lands on the dashboard **logged in**.

**Errors**

| Status | `code`                       | When                                                                            |
| ------ | ---------------------------- | ------------------------------------------------------------------------------- |
| `400`  | `VALIDATION_ERROR`           | Missing/ill-typed `token`                                                       |
| `400`  | `INVALID_VERIFICATION_TOKEN` | Unknown, expired, or already-used token (same answer for all three — no oracle) |
| `500`  | `INTERNAL_ERROR`             | Server failure                                                                  |

**Current backend:** `POST /api/v1/auth/verify-email` (and convenience
`GET /api/v1/auth/verify-email/:token`) exists, consumes the token and sets
`emailVerifiedAt`. **Gaps:** does NOT establish a session on success; the GET
variant is undocumented in `docs/openapi.yaml`.

---

## 4. Resend verification email

### `POST /api/v1/auth/resend-verification`

**Request body**

```json
{ "email": "you@example.com" }
```

(Trimmed and lowercased by the client before sending.)

**Success — `202`** — returned **even when the email has no account**
(anti-enumeration; do not leak existence):

```json
{ "data": { "sent": true } }
```

**Errors**

| Status | `code`             | When                      |
| ------ | ------------------ | ------------------------- |
| `400`  | `VALIDATION_ERROR` | Missing/ill-typed `email` |
| `429`  | `RATE_LIMITED`     | Rate limit hit            |
| `500`  | `INTERNAL_ERROR`   | Server failure            |

**Rate limiting (exact):** max **3 requests per email per hour** and **10 per
client IP per hour**. Respond `429` with `Retry-After` (seconds). When
allowed and the account exists and is unverified: issue a fresh token (§2) and
send the email. If the account exists and is already verified: still return
`202`, send nothing.

**Current backend:** NOT implemented. **Gap: entire endpoint + rate limiting.**

---

## 5. Login (unchanged behavior, recorded for the flow)

### `POST /api/v1/auth/login`

Body `{ "email": "…", "password": "…" }`. Success `200` sets the
`sellonit_access_token` cookie (same attributes as §3) and returns
`{ "user": { … }, "expiresInSeconds": 2592000 }` (keep the current shape).

**Unverified users are blocked:** `403` with `code: "EMAIL_NOT_VERIFIED"` —
the frontend shows "Verify your email before logging in."
(`apps/api/src/modules/auth/auth.service.ts` → `login()` already does this.)
Duplicate email on register remains `409 EMAIL_ALREADY_EXISTS`.

**Current backend:** implemented; no gap for this flow.

---

## 6. Phone / OTP (status)

The pre-existing registration also optionally collected a Nigerian phone
number and sent a 6-digit SMS code (Twilio) to
`POST /api/v1/auth/verify-phone` (`{ "token": "123456" }`), with
`VerificationToken` rows of `type: 'PHONE'` (10-minute expiry). The new
Create account flow is **email + password only** — no phone field, no OTP
screen.

**Recommendation:** keep `POST /api/v1/auth/verify-phone` and the PHONE token
machinery dormant (do not remove) so a future account-settings flow can reuse
them; nothing in the new signup path calls them. The frontend removed its
phone/OTP registration UI.

---

## Summary of required backend changes

1. `POST /api/v1/auth/register`: accept `fullName` (+ keep deriving/storing
   `firstName`/`lastName` per the split rule), return `422` + `fields` for
   field-rule failures.
2. Verification email link → `${VERIFICATION_BASE_URL}/auth/verify-email/confirm?token=…`.
3. `POST /api/v1/auth/verify-email`: on success, also create the session and
   set `sellonit_access_token` (login-equivalent).
4. Add `POST /api/v1/auth/resend-verification` with the rate limits above.

Frontend reference implementation: `apps/web/src/lib/auth/api.ts` (payload
assembly + error mapping), `apps/web/src/lib/validation/auth.ts` (identical
client-side rules), `apps/web/src/lib/auth/auth.mock.ts` (dev mock of this
contract behind `NEXT_PUBLIC_MOCK_AUTH=true`).
