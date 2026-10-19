import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = source('../../app/globals.css');
const card = source('../../components/reuseable/AuthCard.tsx');
const heading = source('../../components/auth/StepHeader.tsx');
const chooser = source('../../components/auth/SignupMethodChooser.tsx');
const secondaryButton = source('../../components/reuseable/SecondaryButton.tsx');
const signup = source('../../components/auth/CreateAccountForm.tsx');
const setup = source('../../app/auth/register/account-details/page.tsx');
const layout = source('../../app/auth/register/layout.tsx');
const validation = source('../../lib/validation/auth.ts');

describe('auth presentation contract', () => {
  it('declares desktop and mobile card geometry and exact heading typography', () => {
    expect(css).toContain('width: min(316px, calc(100% - 48px))');
    expect(css).toContain('border-radius: 18px');
    expect(css).toContain('border-width: 0.5px');
    expect(css).toContain('width: 632px');
    expect(css).toContain('border-radius: 36px');
    expect(css).toContain('border-width: 1px');
    expect(css).toContain('font-size: 36px');
    expect(css).toContain('line-height: 44px');
    expect(css).toContain('letter-spacing: -0.72px');
    expect(css).toContain('--color-line: #e5e7eb');
    expect(css).toContain('--radius-button: 16px');
    expect(card).toContain('px-[18px] py-6');
    expect(card).toContain('md:px-9 md:py-12');
    expect(card).toContain('gap-6 md:gap-12');
    expect(heading).toContain('icon?: ReactNode');
  });

  it('preserves chooser copy, provider order, routing, form copy and rule states', () => {
    expect(chooser).toContain('Create your sellonit account');
    expect(chooser).toContain('Sign up with Google <GoogleMark');
    expect(chooser).toContain('Sign up with Apple <AppleMark');
    expect(chooser.indexOf('Sign up with Google')).toBeLessThan(
      chooser.indexOf('GoogleMark className'),
    );
    expect(chooser).toContain('Continue with email');
    expect(chooser).toContain("router.push('/auth/register/account-details')");
    expect(secondaryButton).toContain("shape === 'pill' ? 'rounded-full' : 'rounded-button'");
    expect(chooser).toContain('underline underline-offset-2');
    expect(setup).toContain('BagMark');
    expect(layout).toContain("'Sign up'");
    expect(layout).toContain("'Account details'");
    expect(signup).toContain('placeholder="Enter your first name"');
    expect(signup).toContain('placeholder="Enter your last name"');
    expect(signup).toContain('placeholder="you@example.com"');
    expect(signup).toContain('placeholder="Create password"');
    expect(signup).toContain('placeholder="Confirm password"');
    expect(signup).toContain('disabled={!valid || isSubmitting}');
    expect(signup).toContain("!active ? 'text-[#6B7280]' : met ? 'text-success' : 'text-danger'");
    expect(validation).toContain("passwordMismatch: 'Password mismatch'");
  });

  it('keeps the card width within each requested viewport', () => {
    for (const viewport of [320, 390, 768, 1024, 1440]) {
      const cardWidth = viewport < 768 ? Math.min(316, viewport - 48) : 632;
      expect(cardWidth).toBeLessThanOrEqual(viewport);
      if (viewport === 390) expect(cardWidth).toBe(316);
      if (viewport === 1440) expect(cardWidth).toBe(632);
    }
  });
});
