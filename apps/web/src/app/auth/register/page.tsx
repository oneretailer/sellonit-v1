import type { Metadata } from 'next';
import { CreateAccountForm } from '@/components/auth/CreateAccountForm';
import { AuthCard } from '@/components/reuseable/AuthCard';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Set up your Sellonit account.',
};

/**
 * Create account (Figma "account details" frame): one card, 632px fixed at
 * lg, height hugging its content — the page scrolls naturally. Built inline
 * (same pattern as the Welcome card) because the values differ from
 * AuthCard's defaults; shadow matches the Welcome card by design.
 */
export default function CreateAccountPage() {
  return (
    // cards: vertical, 632 fixed, hug, radius 36, padding 48/36, gap 48
    <AuthCard gapClassName="gap-8 sm:gap-12">
      {/* heading and subtext: centered */}
      <div className="flex w-full flex-col items-center gap-3 text-center lg:gap-4">
        <h1 className="auth-heading">Set up your account</h1>
        <p className="text-base leading-6 font-normal text-[#6B7280] sm:text-lg sm:leading-7 lg:text-[20px] lg:leading-[30px]">
          Tell us a little about yourself
        </p>
      </div>
      {/* fields and buttons */}
      <CreateAccountForm />
    </AuthCard>
  );
}
