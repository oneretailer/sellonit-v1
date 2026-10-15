/**
 * Frontend input validation for the auth flows.
 *
 * These checks only catch obvious input errors early; the backend remains
 * authoritative (apps/api validates the same fields server-side).
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;
export const NAME_MAX_LENGTH = 80;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

export function isPassword(value: string): boolean {
  return value.length >= MIN_PASSWORD_LENGTH && value.length <= MAX_PASSWORD_LENGTH;
}

/**
 * A valid name is one or more letter-only parts separated by spaces, hyphens
 * or apostrophes (Anne-Marie, O'Connor, Mary Jane). `\p{L}` matches any
 * Unicode letter, so accented and non-Latin names work; numbers, symbols and
 * markup characters (`<`, `>`, quotes, backticks) never match, which also
 * keeps XSS payloads out of the field. Runs of separators are tolerated
 * (`Anne - Marie`); the value is tested after trimming.
 */
const NAME_PATTERN = /^[\p{L}]+(?:[ '-]+[\p{L}]+)*$/u;

/** Characters that may appear in a name: Unicode letters plus these separators. */
const NAME_ALLOWED_CHARS_PATTERN = /[^\p{L} '-]/gu;

/** Separator/whitespace runs inside a name, collapsed to a single character. */
const NAME_SEPARATOR_RUN_PATTERN = /[ '-]{2,}/gu;
const NAME_WHITESPACE_RUN_PATTERN = /\s+/gu;

/** Message shown when the user types a character a name cannot contain. */
export const NAME_INVALID_CHARACTERS_MESSAGE =
  'Names can only contain letters, spaces, hyphens, and apostrophes.';

export function isName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= NAME_MAX_LENGTH && NAME_PATTERN.test(trimmed);
}

export type SanitizedName = {
  /** The input with invalid characters removed and each name part capitalized. */
  value: string;
  /** True when at least one character was stripped (numbers, symbols, markup, ...). */
  removedInvalidCharacters: boolean;
};

/**
 * Cleans and formats raw name input as the user types:
 *
 *   1. strips every character that is not a letter, space, hyphen or apostrophe
 *      (so numbers, symbols and XSS payloads cannot stay in the field),
 *   2. collapses whitespace and separator runs to a single character,
 *   3. capitalizes the first letter of every name part (`mary-jane o'connor`
 *      → `Mary-Jane O'Connor`), leaving the rest of each part as typed,
 *   4. caps the value at {@link NAME_MAX_LENGTH} characters.
 */
export function sanitizeNameInput(raw: string): SanitizedName {
  const stripped = raw.replace(NAME_ALLOWED_CHARS_PATTERN, '');
  const collapsed = stripped
    .replace(NAME_WHITESPACE_RUN_PATTERN, ' ')
    .replace(NAME_SEPARATOR_RUN_PATTERN, (run) => run[0] ?? '');
  const capitalized = collapsed.replace(
    /(^|[\s'-])(\p{L})/gu,
    (_match, separator: string, letter: string) => separator + letter.toUpperCase(),
  );
  return {
    value: capitalized.slice(0, NAME_MAX_LENGTH),
    removedInvalidCharacters: stripped.length !== raw.length,
  };
}

export type NameStepErrors = { firstName?: string; lastName?: string };

/**
 * Checks the name step and returns a user-friendly message per field. The
 * messages say exactly what to change: empty, characters a name cannot
 * contain, or over the length limit.
 */
export function validateNameStep(firstName: string, lastName: string): NameStepErrors {
  const errors: NameStepErrors = {};
  for (const [key, value] of [
    ['firstName', firstName],
    ['lastName', lastName],
  ] as const) {
    const label = key === 'firstName' ? 'first name' : 'last name';
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      errors[key] = `Enter your ${label}.`;
    } else if (!NAME_PATTERN.test(trimmed)) {
      errors[key] = NAME_INVALID_CHARACTERS_MESSAGE;
    } else if (trimmed.length > NAME_MAX_LENGTH) {
      errors[key] = `Keep your ${label} to ${NAME_MAX_LENGTH} characters or fewer.`;
    }
  }
  return errors;
}

/**
 * The phone field shows a fixed "+234" prefix; the user types the 10-digit
 * number without the leading zero. Nigerian mobile numbers start with 7, 8 or
 * 9 (07xx/08xx/09xx in the local form).
 */
export function isNigerianPhoneDigits(value: string): boolean {
  return /^[789]\d{9}$/.test(value);
}

/**
 * Converts the entered digits (`8031234567`) to the local form the API
 * accepts (`08031234567`). The API normalises it to `+2348031234567`.
 */
export function toLocalPhone(digits: string): string {
  return `0${digits}`;
}

/**
 * Formats a phone number for display as `+234 803 123 4567`. Accepts the
 * local form (`0XXXXXXXXXX`) or the international form (`+234XXXXXXXXXX` /
 * `234XXXXXXXXXX`). Values it cannot recognise are returned unchanged.
 */
export function formatPhoneDisplay(value: string): string {
  const clean = value.replace(/\D/g, '');
  if (/^0\d{10}$/.test(clean)) {
    const d = clean.slice(1);
    return `+234 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  if (/^234\d{10}$/.test(clean)) {
    const d = clean.slice(3);
    return `+234 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  }
  return value;
}

/** The backend sends a 6-digit numeric phone verification code. */
export function isVerificationCode(value: string): boolean {
  return /^\d{6}$/.test(value);
}

/** Strips non-digits and caps the length (used for phone/code inputs). */
export function onlyDigits(value: string, maxLength = 6): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

/**
 * Normalises raw input from the phone field to the 10 national digits
 * (`8031234567`). Pasting or typing a leading `0` (`08031234567`) or the
 * country code (`2348031234567`) is accepted and the prefix is dropped.
 */
export function normalizePhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('234')) {
    digits = digits.slice(3);
  } else if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

/**
 * Display form used in the verification copy, matching the design example:
 * `8072994315` → `080 72994315` (leading 0, then a space after the first three
 * characters of the local number).
 */
export function formatLocalPhoneSpaced(digits: string): string {
  return `0${digits.slice(0, 2)} ${digits.slice(2)}`;
}

export type PasswordStepErrors = { password?: string; confirm?: string };

/**
 * Checks the password step. The rules match the backend (8 to 128 characters).
 * The confirmation is compared exactly. It is never stored in the flow state.
 */
export function validatePasswordStep(password: string, confirm: string): PasswordStepErrors {
  const errors: PasswordStepErrors = {};
  if (!isPassword(password)) {
    errors.password = `Use between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters for your password.`;
  }
  if (confirm.length === 0) {
    errors.confirm = 'Re-enter your password to confirm it.';
  } else if (confirm !== password) {
    errors.confirm = 'Passwords do not match.';
  }
  return errors;
}
