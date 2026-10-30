import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { AuthCardHeader } from '@/components/auth/StepHeader';
import { BagMark } from '@/components/brand/BagMark';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const chooser = source('../../components/auth/SignupMethodChooser.tsx');
const signup = source('../../components/auth/CreateAccountForm.tsx');
const setup = source('../../app/auth/register/account-details/page.tsx');
const landing = source('../../app/page.tsx');
const registerPage = source('../../app/auth/register/page.tsx');
const layout = source('../../app/auth/register/layout.tsx');
const validation = source('../../lib/validation/auth.ts');

describe('auth presentation contract', () => {
  it('renders the decorative header mark before its title and supporting copy', () => {
    const markup = renderToStaticMarkup(
      createElement(
        AuthCardHeader,
        { title: 'Account title', icon: createElement(BagMark) },
        'Supporting copy',
      ),
    );
    const bagIndex = markup.indexOf('src="/shopping-bag.svg"');
    expect(bagIndex).toBeGreaterThanOrEqual(0);
    const imageStart = markup.lastIndexOf('<img', bagIndex);
    const imageEnd = markup.indexOf('>', bagIndex);
    expect(markup.slice(imageStart, imageEnd)).toContain('aria-hidden="true"');
    expect(imageStart).toBeLessThan(markup.indexOf('<h1'));
    expect(markup.indexOf('<h1')).toBeLessThan(markup.indexOf('Supporting copy'));
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
    expect(setup).toContain('BagMark');
    expect(layout).toContain("'Sign up'");
    expect(layout).toContain("'Account details'");
    expect(signup).toContain('placeholder="Enter your first name"');
    expect(signup).toContain('placeholder="Enter your last name"');
    expect(signup).toContain('placeholder="you@example.com"');
    expect(signup).toContain('placeholder="Create password"');
    expect(signup).toContain('placeholder="Confirm password"');
    expect(signup).toContain('disabled={!valid || isSubmitting}');
    expect(validation).toContain("passwordMismatch: 'Password mismatch'");
  });

  it('renders one shared chooser on the landing and registration routes', () => {
    expect(landing).toContain('<SignupMethodChooser />');
    expect(registerPage).toContain('<SignupMethodChooser />');
    expect(landing).toContain("label: 'Learn more'");
    expect(landing).not.toContain("label: 'Sign up'");
    expect(landing).not.toContain('Get Started');
    expect(landing).not.toContain('Build your business on sellonit');
    expect(landing).not.toContain('href="/auth/register"');
    expect(landing).not.toContain('metadata');
  });
});
