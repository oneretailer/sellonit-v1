/**
 * Lightweight input checks for the login flow and account display.
 *
 * The Create account form has its own rule set in `lib/validation/auth.ts`
 * (form, tests and API layer share that one module).
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
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

/**
 * A Nigerian mobile number as entered after the leading 0 (ten digits starting
 * with 7, 8 or 9), e.g. `8031234567`.
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
 * Keeps only the ten subscriber digits: strips non-digits, the `234` country
 * code, and a leading trunk `0`.
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
