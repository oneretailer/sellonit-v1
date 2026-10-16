import type { Metadata } from 'next';
import { CreateAccountForm } from '@/components/auth/CreateAccountForm';

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
    <div
      className="
        flex w-full max-w-[632px] flex-col items-center
        gap-8 rounded-3xl border border-[#E5E7EB] bg-white
        px-5 py-8 shadow-[0_4px_16px_rgba(0,0,0,0.08)]
        sm:gap-10 sm:rounded-[30px] sm:px-8 sm:py-10
        lg:gap-12 lg:rounded-[36px] lg:px-[36px] lg:py-12
      "
    >
      {/* heading and subtext: centered */}
      <div className="flex w-full flex-col items-center gap-3 text-center lg:gap-4">
        <h1 className="text-[19px] leading-8 font-bold text-ink sm:text-[26px] sm:leading-[34px] lg:text-[30px] lg:leading-9">
          Set up your account
        </h1>
        <p className="text-base leading-6 font-normal text-[#6B7280] sm:text-lg sm:leading-7 lg:text-[20px] lg:leading-[30px]">
          Tell us a little about yourself
        </p>
      </div>
      {/* fields and buttons */}
      <CreateAccountForm />
    </div>
  );
}
