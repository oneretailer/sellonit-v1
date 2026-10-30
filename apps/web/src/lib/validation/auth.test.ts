import { describe, expect, it } from 'vitest';
import {
  confirmError,
  emailError,
  FORM_ERRORS,
  fullNameError,
  isConfirmMatching,
  isPasswordValid,
  isRegisterFormValid,
  isTermsAccepted,
  isValidEmail,
  normalizeEmail,
  PASSWORD_RULES,
  passwordRuleMet,
  splitFullName,
  type RegisterFormValues,
} from './auth';

describe('fullNameError', () => {
  it('accepts single and multi-part names', () => {
    expect(fullNameError('Ada Example')).toBeNull();
    expect(fullNameError('Mary-Jane')).toBeNull();
    expect(fullNameError("O'Connor")).toBeNull();
    expect(fullNameError('Ada')).toBeNull(); // one word is allowed
    expect(fullNameError('  Ada  ')).toBeNull();
    expect(fullNameError('Zoë')).toBeNull();
  });

  it('requires the name', () => {
    expect(fullNameError('')).toBe(FORM_ERRORS.fullNameRequired);
    expect(fullNameError('   ')).toBe(FORM_ERRORS.fullNameRequired);
  });

  it('enforces 2-80 characters', () => {
    expect(fullNameError('A')).toBe(FORM_ERRORS.fullNameLength);
    expect(fullNameError('a'.repeat(81))).toBe(FORM_ERRORS.fullNameLength);
  });

  it('rejects numbers, symbols and markup, and names not starting with a letter', () => {
    expect(fullNameError('Ada123')).toBe(FORM_ERRORS.fullNameInvalid);
    expect(fullNameError('<script>alert(1)</script>')).toBe(FORM_ERRORS.fullNameInvalid);
    expect(fullNameError('"><img src=x onerror=alert(1)>')).toBe(FORM_ERRORS.fullNameInvalid);
    expect(fullNameError('-Ada')).toBe(FORM_ERRORS.fullNameInvalid);
  });
});

describe('email validation', () => {
  it('normalises before sending', () => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  it('accepts plain addresses', () => {
    expect(isValidEmail('you@example.com')).toBe(true);
    expect(emailError('you@example.com')).toBeNull();
  });

  it('rejects bad local parts and domains', () => {
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('you@example')).toBe(false);
    expect(isValidEmail('.you@example.com')).toBe(false);
    expect(isValidEmail('you.@example.com')).toBe(false);
    expect(isValidEmail('you..name@example.com')).toBe(false);
    expect(isValidEmail('you@localhost')).toBe(false);
    expect(isValidEmail('you@example.c')).toBe(false); // 1-letter TLD
    expect(isValidEmail(`${'a'.repeat(250)}@example.com`)).toBe(false); // > 254
  });

  it('rejects phone numbers for signup, which the API accepts as email only', () => {
    expect(emailError('nope')).toBe('Enter a valid email address.');
    expect(emailError('08012345678')).toBe('Enter a valid email address.');
    expect(emailError('+2348012345678')).toBe('Enter a valid email address.');
  });
});

describe('PASSWORD_RULES checklist', () => {
  it('exposes the three Figma rules in order', () => {
    expect(PASSWORD_RULES.map((rule) => rule.label)).toEqual([
      'At least 8 characters',
      'At least 1 letter',
      'At least 1 number',
    ]);
  });

  it('matches the Figma typing state: "pass" → red, green, red', () => {
    expect(passwordRuleMet('length', 'pass')).toBe(false);
    expect(passwordRuleMet('letter', 'pass')).toBe(true);
    expect(passwordRuleMet('number', 'pass')).toBe(false);
    expect(isPasswordValid('pass')).toBe(false);
  });

  it('accepts 8+ chars with a letter and a number, including symbols and spaces', () => {
    expect(isPasswordValid('passw0rd')).toBe(true);
    expect(isPasswordValid('a1b2c3d4')).toBe(true);
    expect(isPasswordValid('  pw 1234  ')).toBe(true);
  });

  it('rejects missing letters or numbers', () => {
    expect(isPasswordValid('12345678')).toBe(false);
    expect(isPasswordValid('abcdefgh')).toBe(false);
    expect(isPasswordValid('abc123')).toBe(false);
  });
});

describe('confirmError / isConfirmMatching', () => {
  it('shows "Password mismatch" while confirm is non-empty and differs', () => {
    expect(confirmError('passw0rd', 'pass')).toBe(FORM_ERRORS.passwordMismatch);
  });

  it('is hidden while confirm is empty and when the values match', () => {
    expect(confirmError('passw0rd', '')).toBeNull();
    expect(confirmError('passw0rd', 'passw0rd')).toBeNull();
  });

  it('requires non-empty confirm for a match', () => {
    expect(isConfirmMatching('', '')).toBe(false);
    expect(isConfirmMatching('passw0rd', 'passw0rd')).toBe(true);
  });
});

describe('isRegisterFormValid', () => {
  const validValues: RegisterFormValues = {
    fullName: 'Ada Example',
    email: 'you@example.com',
    password: 'passw0rd',
    confirm: 'passw0rd',
    termsAccepted: true,
  };

  it('passes only when every rule passes', () => {
    expect(isRegisterFormValid(validValues)).toBe(true);
  });

  it('fails when any single rule fails', () => {
    expect(isRegisterFormValid({ ...validValues, fullName: '' })).toBe(false);
    expect(isRegisterFormValid({ ...validValues, email: 'nope' })).toBe(false);
    expect(isRegisterFormValid({ ...validValues, password: 'pass' })).toBe(false);
    expect(isRegisterFormValid({ ...validValues, confirm: 'other' })).toBe(false);
    expect(isRegisterFormValid({ ...validValues, termsAccepted: false })).toBe(false);
    expect(isTermsAccepted(true)).toBe(true);
  });
});

describe('splitFullName (legacy-backend compatibility)', () => {
  it('splits on the first space', () => {
    expect(splitFullName('Ada Example')).toEqual({
      firstName: 'Ada',
      lastName: 'Example',
    });
    expect(splitFullName('Mary Jane Smith')).toEqual({
      firstName: 'Mary',
      lastName: 'Jane Smith',
    });
  });

  it('duplicates a single-word name (legacy backend requires lastName)', () => {
    expect(splitFullName('Ada')).toEqual({ firstName: 'Ada', lastName: 'Ada' });
  });
});
