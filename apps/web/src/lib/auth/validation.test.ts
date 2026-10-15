import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api-client';
import { authErrorMessage } from './errors';
import {
  formatLocalPhoneSpaced,
  formatPhoneDisplay,
  isEmail,
  isName,
  isNigerianPhoneDigits,
  isPassword,
  isVerificationCode,
  NAME_INVALID_CHARACTERS_MESSAGE,
  NAME_MAX_LENGTH,
  normalizePhoneInput,
  onlyDigits,
  sanitizeNameInput,
  toLocalPhone,
  validateNameStep,
} from './validation';

describe('isNigerianPhoneDigits', () => {
  it('accepts 10-digit numbers starting with 7, 8 or 9', () => {
    expect(isNigerianPhoneDigits('7031234567')).toBe(true);
    expect(isNigerianPhoneDigits('8031234567')).toBe(true);
    expect(isNigerianPhoneDigits('9031234567')).toBe(true);
  });

  it('rejects wrong lengths and impossible prefixes', () => {
    expect(isNigerianPhoneDigits('')).toBe(false);
    expect(isNigerianPhoneDigits('803123456')).toBe(false);
    expect(isNigerianPhoneDigits('08031234567')).toBe(false);
    expect(isNigerianPhoneDigits('80312345678')).toBe(false);
    expect(isNigerianPhoneDigits('6031234567')).toBe(false);
    expect(isNigerianPhoneDigits('0031234567')).toBe(false);
    expect(isNigerianPhoneDigits('80312345 67')).toBe(false);
  });
});

describe('toLocalPhone', () => {
  it('converts entered digits to the local form the API accepts', () => {
    expect(toLocalPhone('8031234567')).toBe('08031234567');
  });
});

describe('formatPhoneDisplay', () => {
  it('formats the local form', () => {
    expect(formatPhoneDisplay('08031234567')).toBe('+234 803 123 4567');
  });

  it('formats the international form', () => {
    expect(formatPhoneDisplay('+2348031234567')).toBe('+234 803 123 4567');
    expect(formatPhoneDisplay('2348031234567')).toBe('+234 803 123 4567');
  });

  it('returns unrecognised values unchanged', () => {
    expect(formatPhoneDisplay('not-a-number')).toBe('not-a-number');
  });
});

describe('isEmail', () => {
  it('accepts plain email addresses', () => {
    expect(isEmail('ada@example.com')).toBe(true);
    expect(isEmail('  ada@example.com  ')).toBe(true);
  });

  it('rejects invalid addresses', () => {
    expect(isEmail('')).toBe(false);
    expect(isEmail('ada')).toBe(false);
    expect(isEmail('ada@example')).toBe(false);
    expect(isEmail('ada @example.com')).toBe(false);
  });
});

describe('isPassword', () => {
  it('enforces 8-128 characters', () => {
    expect(isPassword('password')).toBe(true);
    expect(isPassword('12345678')).toBe(true);
    expect(isPassword('1234567')).toBe(false);
    expect(isPassword('x'.repeat(129))).toBe(false);
  });
});

describe('isName', () => {
  it('requires 1-80 non-whitespace characters', () => {
    expect(isName('Ada')).toBe(true);
    expect(isName('  Ada  ')).toBe(true);
    expect(isName('')).toBe(false);
    expect(isName('   ')).toBe(false);
    expect(isName('x'.repeat(81))).toBe(false);
  });

  it('accepts letters with spaces, hyphens and apostrophes between parts', () => {
    expect(isName('Mary Jane')).toBe(true);
    expect(isName('Anne-Marie')).toBe(true);
    expect(isName("O'Connor")).toBe(true);
    expect(isName('Chinwe Ọláyínka')).toBe(true);
  });

  it('rejects numbers, symbols and markup characters', () => {
    expect(isName('Ada123')).toBe(false);
    expect(isName('Ada!')).toBe(false);
    expect(isName('<script>')).toBe(false);
    expect(isName('"><img src=x onerror=alert(1)>')).toBe(false);
    expect(isName('Ada; DROP TABLE users')).toBe(false);
  });
});

describe('sanitizeNameInput', () => {
  it('capitalizes the first letter of each name part', () => {
    expect(sanitizeNameInput('ada')).toEqual({ value: 'Ada', removedInvalidCharacters: false });
    expect(sanitizeNameInput('mary jane')).toEqual({
      value: 'Mary Jane',
      removedInvalidCharacters: false,
    });
    expect(sanitizeNameInput('anne-marie')).toEqual({
      value: 'Anne-Marie',
      removedInvalidCharacters: false,
    });
    expect(sanitizeNameInput("o'connor")).toEqual({
      value: "O'Connor",
      removedInvalidCharacters: false,
    });
  });

  it('strips numbers and special characters and flags the removal', () => {
    expect(sanitizeNameInput('Ada123')).toEqual({
      value: 'Ada',
      removedInvalidCharacters: true,
    });
    expect(sanitizeNameInput('<script>alert(1)</script>')).toEqual({
      value: 'Scriptalertscript',
      removedInvalidCharacters: true,
    });
    expect(sanitizeNameInput('John@Doe.com')).toEqual({
      value: 'JohnDoecom',
      removedInvalidCharacters: true,
    });
  });

  it('collapses whitespace and separator runs', () => {
    expect(sanitizeNameInput('Mary    Jane').value).toBe('Mary Jane');
    expect(sanitizeNameInput('Mary  Jane').value).toBe('Mary Jane');
    expect(sanitizeNameInput('O--Connor').value).toBe('O-Connor');
  });

  it('keeps a single trailing separator while typing', () => {
    expect(sanitizeNameInput('Mary ').value).toBe('Mary ');
    expect(sanitizeNameInput('Anne-').value).toBe('Anne-');
  });

  it('caps the value at the name length limit', () => {
    const long = 'a'.repeat(NAME_MAX_LENGTH + 10);
    expect(sanitizeNameInput(long).value).toHaveLength(NAME_MAX_LENGTH);
  });
});

describe('validateNameStep', () => {
  it('accepts valid first and last names', () => {
    expect(validateNameStep('Ada', 'Lovelace')).toEqual({});
  });

  it('asks for the missing name', () => {
    expect(validateNameStep('', 'Lovelace')).toEqual({ firstName: 'Enter your first name.' });
    expect(validateNameStep('Ada', '   ')).toEqual({ lastName: 'Enter your last name.' });
  });

  it('explains which characters a name may contain', () => {
    expect(validateNameStep('Ada123', 'Lovelace')).toEqual({
      firstName: NAME_INVALID_CHARACTERS_MESSAGE,
    });
    expect(validateNameStep('Ada', '<script>')).toEqual({
      lastName: NAME_INVALID_CHARACTERS_MESSAGE,
    });
  });

  it('flags names over the length limit', () => {
    expect(validateNameStep('a'.repeat(NAME_MAX_LENGTH + 1), 'Lovelace')).toEqual({
      firstName: `Keep your first name to ${NAME_MAX_LENGTH} characters or fewer.`,
    });
  });
});

describe('isVerificationCode', () => {
  it('requires exactly 6 digits', () => {
    expect(isVerificationCode('123456')).toBe(true);
    expect(isVerificationCode('12345')).toBe(false);
    expect(isVerificationCode('1234567')).toBe(false);
    expect(isVerificationCode('12345a')).toBe(false);
  });
});

describe('onlyDigits', () => {
  it('strips non-digits and caps the length', () => {
    expect(onlyDigits('a1 2 3!4 5 6 7', 6)).toBe('123456');
    expect(onlyDigits('1234567890', 10)).toBe('1234567890');
  });
});

describe('authErrorMessage', () => {
  it('maps known backend codes to user-facing messages', () => {
    expect(
      authErrorMessage(
        new ApiError(409, 'EMAIL_ALREADY_EXISTS', 'An account with this email already exists'),
      ),
    ).toBe('An account with this email already exists. You can log in instead.');
    expect(authErrorMessage(new ApiError(400, 'INVALID_VERIFICATION_TOKEN', 'x'))).toBe(
      'That verification code or link is invalid or has expired.',
    );
    expect(authErrorMessage(new ApiError(401, 'INVALID_CREDENTIALS', 'x'))).toBe(
      'Email or password is incorrect.',
    );
    expect(authErrorMessage(new ApiError(403, 'EMAIL_NOT_VERIFIED', 'x'))).toContain(
      'Verify your email before logging in',
    );
  });

  it('falls back to the backend message for unknown codes', () => {
    expect(authErrorMessage(new ApiError(400, 'SOME_FUTURE_CODE', 'Future message'))).toBe(
      'Future message',
    );
  });

  it('uses a network message for unreachable APIs', () => {
    expect(authErrorMessage(new NetworkError())).toBe(
      'We could not reach Sellonit. Check your connection and try again.',
    );
  });

  it('never surfaces unknown thrown values', () => {
    expect(authErrorMessage(new Error('internal detail'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(authErrorMessage('boom')).toBe('Something went wrong. Please try again.');
  });
});

describe('normalizePhoneInput', () => {
  it('keeps the 10 national digits and drops formatting', () => {
    expect(normalizePhoneInput('8072994315')).toBe('8072994315');
    expect(normalizePhoneInput('807 299 4315')).toBe('8072994315');
  });

  it('drops a pasted leading 0 or country code', () => {
    expect(normalizePhoneInput('08072994315')).toBe('8072994315');
    expect(normalizePhoneInput('+2348072994315')).toBe('8072994315');
  });

  it('caps the length at 10 digits', () => {
    expect(normalizePhoneInput('80729943159999')).toBe('8072994315');
  });
});

describe('formatLocalPhoneSpaced', () => {
  it('formats national digits as the verification copy shows them', () => {
    expect(formatLocalPhoneSpaced('8072994315')).toBe('080 72994315');
  });
});
