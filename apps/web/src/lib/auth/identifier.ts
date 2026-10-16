/**
 * Shared helpers for the "Email or phone number" identifier field.
 *
 * Used by login, forgot password, the verification code screen and the
 * unverified-account resend. Pure functions only: no React, no network.
 *
 * Rules (the only place they are defined):
 * - A value containing "@" is an email, anything else is a phone number.
 * - Email: trimmed and lowercased, then checked against the shared email rule.
 * - Phone: spaces, dashes and brackets are removed first, then the result must
 *   match /^0\d{10}$/ (a leading 0 plus 10 digits, 11 digits in total). +234,
 *   234 and a 10-digit number without the leading 0 are all invalid.
 * - The phone is sent in this 11-digit local format.
 */
import { normalizeEmail } from '@/lib/validation/auth';
import { isEmail } from './validation';

export type IdentifierType = 'email' | 'phone';

export type NormalizedIdentifier = {
  identifier: string;
  identifierType: IdentifierType;
};

/** Shown under the field for any value that is neither a valid email nor a valid phone. */
export const IDENTIFIER_ERROR = 'Enter a valid email or phone number';

const LOCAL_PHONE_PATTERN = /^0\d{10}$/;

/** Removes the formatting users type into phone numbers: spaces, dashes and brackets. */
export function cleanPhone(value: string): string {
  return value.replace(/[\s\-()[\]]/g, '');
}

export function detectIdentifierType(value: string): IdentifierType {
  return value.includes('@') ? 'email' : 'phone';
}

/** The cleaned 11-digit local phone number, or null when it is not valid. */
export function normalizePhone(value: string): string | null {
  const cleaned = cleanPhone(value.trim());
  return LOCAL_PHONE_PATTERN.test(cleaned) ? cleaned : null;
}

/**
 * Trims and normalizes an identifier for sending. Call `validateIdentifier`
 * first. For an invalid phone number this returns the cleaned value, which the
 * UI never sends because validation blocks it.
 */
export function normalizeIdentifier(value: string): NormalizedIdentifier {
  const trimmed = value.trim();
  if (detectIdentifierType(trimmed) === 'email') {
    return { identifier: normalizeEmail(trimmed), identifierType: 'email' };
  }
  return {
    identifier: normalizePhone(trimmed) ?? cleanPhone(trimmed),
    identifierType: 'phone',
  };
}

/** Error message for an invalid identifier, or null when it is a valid email or phone. */
export function validateIdentifier(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return IDENTIFIER_ERROR;
  }
  if (detectIdentifierType(trimmed) === 'email') {
    return isEmail(trimmed) ? null : IDENTIFIER_ERROR;
  }
  return normalizePhone(trimmed) !== null ? null : IDENTIFIER_ERROR;
}

/**
 * Display form for an identifier that is already normalized:
 * `j***@gmail.com` for email, `0811 234 5678` for phone (lightly formatted).
 */
export function maskIdentifier(identifier: string, identifierType: IdentifierType): string {
  if (identifierType === 'phone') {
    return `${identifier.slice(0, 4)} ${identifier.slice(4, 7)} ${identifier.slice(7)}`;
  }
  const at = identifier.indexOf('@');
  if (at <= 0) {
    return identifier;
  }
  return `${identifier.charAt(0)}***${identifier.slice(at)}`;
}
