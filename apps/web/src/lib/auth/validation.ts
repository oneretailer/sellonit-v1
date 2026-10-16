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
