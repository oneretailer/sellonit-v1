/**
 * Email-exists check for the registration email step.
 *
 * The API has NO endpoint that says whether an email is registered (checked:
 * apps/api/src/http/routes/auth.routes.ts and docs/openapi.yaml). So the email
 * step does not check, and it passes the user on. A registered email is caught
 * at the phone step instead, when POST /auth/register returns 409
 * EMAIL_ALREADY_EXISTS (see existingAccount.ts).
 *
 * When the backend adds the endpoint:
 *   1. implement `checkEmailExists` below,
 *   2. set `EMAIL_CHECK_ENABLED = true`.
 * No component changes are needed.
 */
import { ApiError, NetworkError } from '@/lib/api-client';

/** Switch to true only after `checkEmailExists` is implemented against a real endpoint. */
export const EMAIL_CHECK_ENABLED = false;

export type EmailExistsResponse = { exists: boolean };

/**
 * Asks the API whether an account already exists for `email` (already trimmed and lowercased).
 *
 * TODO(backend): email-exists check. Not implemented in apps/api. Needed:
 *   GET /api/v1/auth/email-exists?email=<normalised email>
 *   200 -> { "data": { "exists": boolean } }
 *   429 -> rate limited (per IP and per email), 5xx -> server error.
 *
 * Until the endpoint exists this throws, and the email step is not enabled.
 */
export function checkEmailExists(email: string): Promise<EmailExistsResponse> {
  void email;
  return Promise.reject(new Error('Backend endpoint not available yet'));
}

/** Same normalisation as the API: trim, then lowercase. */
export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Friendly inline message for a failed check. Raw errors are never shown. */
export function emailCheckErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return "We couldn't check this email. Check your connection and try again.";
  }
  if (error instanceof ApiError && error.status === 429) {
    return 'Too many attempts. Wait a moment and try again.';
  }
  return "We couldn't check this email right now. Try again in a moment.";
}

export type EmailStepResolution =
  | { kind: 'continue'; email: string }
  | { kind: 'exists'; email: string }
  | { kind: 'error'; message: string };

/**
 * Decides what the email step does next. When the check is disabled it
 * continues without calling `check`. When it is enabled and fails, it returns
 * an error, so the step never continues silently.
 */
export async function resolveEmailStep(
  rawEmail: string,
  options: {
    enabled?: boolean;
    check?: (email: string) => Promise<EmailExistsResponse>;
  } = {},
): Promise<EmailStepResolution> {
  const email = normaliseEmail(rawEmail);
  const enabled = options.enabled ?? EMAIL_CHECK_ENABLED;
  const check = options.check ?? checkEmailExists;
  if (!enabled) {
    return { kind: 'continue', email };
  }
  try {
    const { exists } = await check(email);
    return exists ? { kind: 'exists', email } : { kind: 'continue', email };
  } catch (error) {
    return { kind: 'error', message: emailCheckErrorMessage(error) };
  }
}
