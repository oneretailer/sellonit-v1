/**
 * Pure validation rules for the Create account form (and the API layer that
 * reuses the same normalisation). No React, no network, no side effects —
 * the form, the tests and `lib/auth/api.ts` all import from this one module.
 *
 * Figma source of truth: the four Create account frames. Copy that is not in
 * those frames is listed in the deliverables under "Assumptions and additions".
 *
 * NOTE: everything here is UX-level validation. The API must enforce the same
 * rules server-side, and the two should be kept in sync.
 */

/* ── Full name ─────────────────────────────────────────────────────────── */

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;

/**
 * Canonical form of a name: Unicode NFC (so "é" typed as one character or as
 * "e" + accent is stored identically), every run of whitespace (tabs,
 * newlines, non-breaking spaces, double spaces) collapsed to one ASCII space,
 * and the ends trimmed. Validate AND submit this value, never the raw input.
 */
export function normalizeFullName(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Expects an already-normalised name (see `normalizeFullName`).
 *
 * Shape: one or more words made of letters (each optionally followed by up to
 * four combining marks), joined by exactly ONE separator: a space, hyphen,
 * apostrophe, or a period (optionally followed by a space, for initials like
 * "J. R. R."). A single trailing period is allowed ("Jr."). This rejects
 * leading/trailing/repeated separators ("Ada--", "'Ada", "A.....") and
 * combining-mark stacking ("zalgo" text). Joiners U+200C/U+200D are allowed
 * after a letter because Persian and several Indic scripts need them.
 * The pattern is unambiguous (no overlapping quantifiers), so it runs in
 * linear time.
 */
export const NAME_REGEX =
  /^(?:\p{L}\p{M}{0,4})+(?:(?:\. ?|[ '’-])(?:\p{L}[\p{M}\u200C\u200D]{0,4})+)*\.?$/u;

/* ── Email ─────────────────────────────────────────────────────────────── */

/**
 * Local part: one or more dot-separated atoms of [A-Za-z0-9_%+-], so no
 * leading, trailing or consecutive dots. Domain: dotted labels ending in a
 * 2+ letter TLD. Unicode/IDN addresses are out of scope by design.
 */
export const EMAIL_REGEX =
  /^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export const EMAIL_MAX_LENGTH = 254;
/** RFC 5321 limit for the part before the "@". */
export const EMAIL_LOCAL_MAX_LENGTH = 64;

/** Trimmed and lowercased — the only form that leaves the browser. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > EMAIL_MAX_LENGTH) return false;
  if (!EMAIL_REGEX.test(trimmed)) return false;
  return trimmed.indexOf('@') <= EMAIL_LOCAL_MAX_LENGTH;
}

/* ── Password ──────────────────────────────────────────────────────────── */

export type PasswordRuleId = 'length' | 'letter' | 'number';

export type PasswordRule = {
  id: PasswordRuleId;
  label: string;
  test: (password: string) => boolean;
};

/**
 * The checklist next to the password field renders from this array, so the
 * UI and the validity check can never disagree. Passwords are never trimmed:
 * spaces are allowed anywhere (passphrases are good passwords) and are part of
 * the secret, so login must not trim either.
 *
 * - Length counts characters (code points), not UTF-16 units, so an emoji is 1.
 * - "letter" accepts any script (`\p{L}`), not just A-Z, so passwords such as
 *   "пароль12345" or "密码password1" are not wrongly rejected.
 */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (password) => [...password].length >= 8 },
  { id: 'letter', label: 'At least 1 letter', test: (password) => /\p{L}/u.test(password) },
  { id: 'number', label: 'At least 1 number', test: (password) => /\d/.test(password) },
];

/**
 * Not a checklist rule: the existing backend caps passwords at 128
 * characters (auth.handlers.ts). Enforced as an input `maxLength` only.
 */
export const PASSWORD_MAX_LENGTH = 128;

export function passwordRuleMet(id: PasswordRuleId, password: string): boolean {
  const rule = PASSWORD_RULES.find((candidate) => candidate.id === id);
  return rule ? rule.test(password) : false;
}

/** All three checklist rules pass. */
export function isPasswordValid(password: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(password));
}

/**
 * True when the password starts or ends with whitespace. Allowed, but almost
 * always an accident (paste or autocorrect) that later looks like "my password
 * doesn't work". Use it to show a soft warning, or to block submit if the
 * product prefers.
 */
export function hasEdgeWhitespace(password: string): boolean {
  return password.length > 0 && password.trim() !== password;
}

/** Strictly equal and non-empty (Figma: "Autodetect password confirmation"). */
export function isConfirmMatching(password: string, confirm: string): boolean {
  return confirm.length > 0 && confirm === password;
}

/* ── Terms ─────────────────────────────────────────────────────────────── */

/** The checkbox must be ticked to submit. */
export function isTermsAccepted(checked: boolean): boolean {
  return checked;
}

/* ── Error copy ────────────────────────────────────────────────────────── */

/**
 * Only "Password mismatch" is visible in the Figma frames. Everything else
 * here is the minimal functional copy listed under "Assumptions and additions".
 */
export const FORM_ERRORS = {
  fullNameRequired: 'Enter your full name.',
  fullNameInvalid:
    'Use letters, with single spaces, hyphens, apostrophes, or periods between them.',
  fullNameLength: `Full name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.`,
  emailInvalid: 'Enter a valid email address.',
  passwordMismatch: 'Password mismatch',
  passwordEdgeWhitespace: 'Your password starts or ends with a space.',
  termsRequired: 'Please agree to the terms and policy.',
  emailTaken: 'An account with this email already exists.',
  rateLimited: 'Too many attempts. Please try again later.',
  validation: 'Please check the details you entered and try again.',
  generic: 'Something went wrong. Please try again.',
} as const;

/* ── Per-field validators (message or null) ────────────────────────────── */

export function fullNameError(value: string): string | null {
  const normalized = normalizeFullName(value);
  if (normalized.length === 0) {
    return FORM_ERRORS.fullNameRequired;
  }
  if (normalized.length < NAME_MIN_LENGTH || normalized.length > NAME_MAX_LENGTH) {
    return FORM_ERRORS.fullNameLength;
  }
  if (!NAME_REGEX.test(normalized)) {
    return FORM_ERRORS.fullNameInvalid;
  }
  return null;
}

/**
 * Signup is email-only: the backend validates `email` as an address and sends
 * the verification link there (there is no phone signup). Login and password
 * reset still accept a phone in the UI, but the API rejects it too.
 */
export function emailError(value: string): string | null {
  return isValidEmail(value) ? null : FORM_ERRORS.emailInvalid;
}

/** Live confirm-password error: shown whenever confirm is non-empty and differs. */
export function confirmError(password: string, confirm: string): string | null {
  return confirm.length > 0 && confirm !== password ? FORM_ERRORS.passwordMismatch : null;
}

/* ── Whole-form validity (drives the button style) ─────────────────────── */

export type RegisterFormValues = {
  fullName: string;
  email: string;
  password: string;
  confirm: string;
  termsAccepted: boolean;
};

/** True only when every rule passes — the enabled-button condition. */
export function isRegisterFormValid(values: RegisterFormValues): boolean {
  return (
    fullNameError(values.fullName) === null &&
    emailError(values.email) === null &&
    isPasswordValid(values.password) &&
    isConfirmMatching(values.password, values.confirm) &&
    isTermsAccepted(values.termsAccepted)
  );
}

/* ── Legacy-backend name split (compatibility shim) ────────────────────── */

/**
 * The pre-contract backend stores `firstName`/`lastName` and requires both.
 * `registerUser` derives them from `fullName` with this exact rule so the
 * legacy backend and the contract backend produce the same rows:
 * the first space-separated token is `firstName`, the remainder is
 * `lastName`; a single-token name puts the same word in both fields.
 * The name is normalised first, so the remainder never contains tabs,
 * newlines, or repeated spaces.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const normalized = normalizeFullName(fullName);
  const firstSpace = normalized.indexOf(' ');
  if (firstSpace === -1) {
    return { firstName: normalized, lastName: normalized };
  }
  return {
    firstName: normalized.slice(0, firstSpace),
    lastName: normalized.slice(firstSpace + 1),
  };
}