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

export function isName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 1 && trimmed.length <= NAME_MAX_LENGTH;
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
