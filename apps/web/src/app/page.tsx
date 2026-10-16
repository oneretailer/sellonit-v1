import Link from 'next/link';
import { AuthPage } from '@/components/reuseable/AuthPage';

export default function WelcomePage() {
  return (
    <AuthPage rightLink={{ label: 'Learn more', href: '/learn-more', variant: 'pill' }}>
      {/* card: fluid up to 632px; fixed 480px tall only on lg+ */}
      <div
        className="
          flex w-full max-w-[632px] flex-col items-center justify-center
          gap-8 rounded-3xl border border-[#E5E7EB] bg-white
          px-5 py-8 shadow-[0_4px_16px_rgba(0,0,0,0.08)]
          sm:gap-10 sm:rounded-[30px] sm:px-8 sm:py-10
          lg:h-[480px] lg:gap-12 lg:rounded-[36px] lg:px-[36px] lg:py-12
        "
      >
        {/* heading and subtext */}
        <div className="flex w-full flex-col items-center gap-3 text-center lg:gap-[16px]">
          <h1 className="text-[19px] font-bold leading-8 text-ink sm:text-[26px] sm:leading-[34px] lg:text-[30px] lg:leading-9">
            Build your business on sellonit
          </h1>
          <p className="w-full text-md font-medium leading-6 text-[#6B7280] sm:text-lg sm:leading-7 lg:text-[20px] lg:leading-[30px]">
            Create your account and set up the business you want to run on your platform
          </p>
        </div>

        {/* buttons */}
        <div className="flex w-full flex-col px-3 items-center gap-3 lg:gap-4">
          <Link
            href="/auth/register/name"
            className="
              flex h-14 w-full items-center justify-center rounded-full
              bg-[#FF8B00] px-6 py-3 text-xl font-semibold leading-7 text-ink
              transition-colors hover:bg-[#E67D00] active:bg-[#CC6F00]
              sm:h-16 sm:text-2xl sm:leading-8
              lg:h-[68px] lg:py-4 lg:text-[25px] lg:leading-9
            "
          >
            Get Started
          </Link>

          <Link
            href="/auth/login"
            className="
              flex items-center justify-center px-6 py-2 text-lg font-normal
              leading-7 text-[#6B7280] transition-colors hover:text-ink
              sm:text-2xl sm:leading-8
              lg:text-[25px] lg:leading-9
            "
          >
            Log in
          </Link>
        </div>
      </div>
    </AuthPage>
  );
}