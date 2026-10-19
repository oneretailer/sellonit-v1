import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
const card = readFileSync(
  new URL('../../components/reuseable/AuthCard.tsx', import.meta.url),
  'utf8',
);
const button = readFileSync(
  new URL('../../components/reuseable/PrimaryButton.tsx', import.meta.url),
  'utf8',
);
const login = readFileSync(
  new URL('../../components/login/LoginForm.tsx', import.meta.url),
  'utf8',
);
const signup = readFileSync(
  new URL('../../components/auth/CreateAccountForm.tsx', import.meta.url),
  'utf8',
);
const validation = readFileSync(new URL('../../lib/validation/auth.ts', import.meta.url), 'utf8');

describe('auth presentation contract', () => {
  it('declares the exact desktop/mobile card and heading geometry', () => {
    expect(css).toContain('width: min(316px, calc(100% - 48px))');
    expect(css).toContain('width: 632px');
    expect(css).toContain('border-radius: 18px');
    expect(css).toContain('border-radius: 36px');
    expect(css).toContain('font-size: 36px');
    expect(css).toContain('line-height: 44px');
    expect(css).toContain('letter-spacing: -0.72px');
    expect(css).toContain('--color-line: #e5e7eb');
    expect(card).toContain('px-[18px]');
    expect(card).toContain('sm:px-9 sm:py-12');
  });

  it('has pill primary buttons, loading copy, errors and password rules', () => {
    expect(button).toContain('rounded-full');
    expect(button).toContain('min-h-11 h-16');
    expect(login).toContain('Logging in…');
    expect(login).toContain('Log in with Google');
    expect(login).toContain('Log in with Apple');
    expect(validation).toContain("passwordMismatch: 'Password mismatch'");
    expect(validation).toContain("label: 'At least 8 characters'");
    expect(validation).toContain("label: 'At least 1 letter'");
    expect(validation).toContain("label: 'At least 1 number'");
    expect(signup).toContain('Creating account…');
  });
});
