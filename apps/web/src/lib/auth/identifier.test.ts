import { describe, expect, it } from 'vitest';
import {
  cleanPhone,
  detectIdentifierType,
  IDENTIFIER_ERROR,
  maskIdentifier,
  normalizeIdentifier,
  normalizePhone,
  validateIdentifier,
} from './identifier';

describe('detectIdentifierType', () => {
  it('treats anything with "@" as an email and everything else as a phone', () => {
    expect(detectIdentifierType('Jane@Example.com')).toBe('email');
    expect(detectIdentifierType('08112345678')).toBe('phone');
  });
});

describe('cleanPhone', () => {
  it('strips spaces, dashes and brackets', () => {
    expect(cleanPhone('081 1234 5678')).toBe('08112345678');
    expect(cleanPhone('(0811) 234-5678')).toBe('08112345678');
    expect(cleanPhone('[0811]234.5678')).toBe('0811234.5678');
  });
});

describe('normalizePhone (strict 11-digit local format)', () => {
  it('accepts a leading 0 followed by 10 digits', () => {
    expect(normalizePhone('08112345678')).toBe('08112345678');
  });

  it('accepts formatted input once separators are removed', () => {
    expect(normalizePhone('081 1234 5678')).toBe('08112345678');
    expect(normalizePhone('(0811) 234-5678')).toBe('08112345678');
  });

  it('rejects +234, 234 and a 10-digit number without the leading 0', () => {
    expect(normalizePhone('+2348112345678')).toBeNull();
    expect(normalizePhone('2348112345678')).toBeNull();
    expect(normalizePhone('8112345678')).toBeNull();
  });

  it('rejects other lengths, letters and stray punctuation', () => {
    expect(normalizePhone('0811234567')).toBeNull(); // 10 digits
    expect(normalizePhone('081123456789')).toBeNull(); // 12 digits
    expect(normalizePhone('0811234567a')).toBeNull();
    expect(normalizePhone('0811.234.5678')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});

describe('normalizeIdentifier', () => {
  it('trims and lowercases emails', () => {
    expect(normalizeIdentifier('  Jane.Doe@Example.COM ')).toEqual({
      identifier: 'jane.doe@example.com',
      identifierType: 'email',
    });
  });

  it('sends phone numbers as the cleaned 11-digit local form', () => {
    expect(normalizeIdentifier('081 1234 5678')).toEqual({
      identifier: '08112345678',
      identifierType: 'phone',
    });
  });
});

describe('validateIdentifier', () => {
  it('accepts a valid email or 11-digit phone', () => {
    expect(validateIdentifier('jane@example.com')).toBeNull();
    expect(validateIdentifier('(0811) 234-5678')).toBeNull();
  });

  it('returns the shared message for empty or invalid values', () => {
    expect(validateIdentifier('')).toBe(IDENTIFIER_ERROR);
    expect(validateIdentifier('   ')).toBe(IDENTIFIER_ERROR);
    expect(validateIdentifier('jane@')).toBe(IDENTIFIER_ERROR);
    expect(validateIdentifier('+2348112345678')).toBe(IDENTIFIER_ERROR);
    expect(validateIdentifier('8112345678')).toBe(IDENTIFIER_ERROR);
    expect(validateIdentifier('12345')).toBe(IDENTIFIER_ERROR);
  });
});

describe('maskIdentifier', () => {
  it('masks the local part of an email', () => {
    expect(maskIdentifier('jane@gmail.com', 'email')).toBe('j***@gmail.com');
  });

  it('lightly formats a phone number', () => {
    expect(maskIdentifier('08112345678', 'phone')).toBe('0811 234 5678');
  });
});
