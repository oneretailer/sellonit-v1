/**
 * Pure validation rules for the Create account form (and the API layer that
 * reuses the same normalisation). No React, no network, no side effects —
 * the form, the tests and `lib/auth/api.ts` all import from this one module.
 *
 * Figma source of truth: the four Create account frames. Copy that is not in
 * those frames is listed in the deliverables under "Assumptions and additions".
 */

/* ── Full name ─────────────────────────────────────────────────────────── */

/**
 * Unicode letters and marks, then letters, marks, spaces, apostrophes,
 * hyphens and periods (Figma placeholder "Ada Example"). The first
 * character must be a letter (or mark), so names cannot start with a
 * separator or symbol. Two words are NOT required (single-word names pass).
 */
export const NAME_REGEX = /^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]*$/u;

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 80;

/* ── Email ─────────────────────────────────────────────────────────────── */

/**
 * Local part: one or more dot-separated atoms of [A-Za-z0-9_%+-], so no
 * leading, trailing or consecutive dots. Domain: dotted labels ending in a
 * 2+ letter TLD. Unicode/IDN addresses are out of scope by design.
 */
export const EMAIL_REGEX =
  /^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export const EMAIL_MAX_LENGTH = 254;

/** Trimmed and lowercased — the only form that leaves the browser. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= EMAIL_MAX_LENGTH && EMAIL_REGEX.test(trimmed);
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
 * UI and the validity check can never disagree. Passwords are never trimmed.
 */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  { id: 'length', label: 'At least 8 characters', test: (password) => password.length >= 8 },
  { id: 'letter', label: 'At least 1 letter', test: (password) => /[A-Za-z]/.test(password) },
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
  fullNameInvalid: 'Use letters, spaces, apostrophes, hyphens, or periods only.',
  fullNameLength: `Full name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.`,
  emailInvalid: 'Enter a valid email address.',
  passwordMismatch: 'Password mismatch',
  termsRequired: 'Please agree to the terms and policy.',
  emailTaken: 'An account with this email already exists.',
  rateLimited: 'Too many attempts. Please try again later.',
  validation: 'Please check the details you entered and try again.',
  generic: 'Something went wrong. Please try again.',
} as const;

/* ── Per-field validators (message or null) ────────────────────────────── */

export function fullNameError(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return FORM_ERRORS.fullNameRequired;
  }
  if (trimmed.length < NAME_MIN_LENGTH || trimmed.length > NAME_MAX_LENGTH) {
    return FORM_ERRORS.fullNameLength;
  }
  if (!NAME_REGEX.test(trimmed)) {
    return FORM_ERRORS.fullNameInvalid;
  }
  return null;
}

export function emailError(value: string): string | null {
  // Signup's combined identifier accepts email or Nigerian phone, matching login/reset.
  if (value.includes('@'))
    return isValidEmail(value) ? null : 'Enter a valid email or phone number';
  const phone = value.trim().replace(/[\s\-()[\]]/g, '');
  return /^(?:0\d{10}|\+?234\d{10})$/.test(phone) ? null : 'Enter a valid email or phone number';
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
 * the first whitespace-separated token is `firstName`, the trimmed remainder
 * is `lastName`; a single-token name puts the same word in both fields.
 */
export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const firstSpace = trimmed.search(/\s/);
  if (firstSpace === -1) {
    return { firstName: trimmed, lastName: trimmed };
  }
  return {
    firstName: trimmed.slice(0, firstSpace),
    lastName: trimmed.slice(firstSpace + 1).trim(),
  };
}
