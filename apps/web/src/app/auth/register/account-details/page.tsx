import type { Metadata } from 'next';
import Image from 'next/image';
import { CreateAccountForm } from '@/components/auth/CreateAccountForm';
import { AuthCardHeader } from '@/components/auth/StepHeader';
import { BagMark } from '@/components/brand/BagMark';
import { AuthCard } from '@/components/reuseable/AuthCard';
import { Navbar } from '@/components/reuseable/Navbar';

export const metadata: Metadata = {
  title: 'Set up your account',
  description: 'Tell us a little about yourself.',
};

/* ── Marketing panel icons (inline: lucide-react is not installed) ─────── */

const panelIconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function UserPlusIcon() {
  return (
    <svg {...panelIconProps} className="size-6">
      <path d="M15 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="8.5" cy="7" r="3.5" />
      <path d="M19 8v6M22 11h-6" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg {...panelIconProps} className="size-5">
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.6-7 8.5-4.1-.9-7-4.3-7-8.5V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg {...panelIconProps} className="size-5">
      <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg {...panelIconProps} className="size-5">
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: <ShieldCheckIcon />,
    title: 'Secure & reliable',
    description: 'Your data is always protected.',
  },
  {
    icon: <BoltIcon />,
    title: 'Quick setup',
    description: 'Get started in just a few minutes.',
  },
  {
    icon: <BarChartIcon />,
    title: 'Grow your business',
    description: 'Access tools to manage and scale.',
  },
];

/**
 * Left "welcome" panel of the sign-up card. Decorative only: it is hidden
 * below `md`, where the account-details card keeps its original single-column
 * layout (bag mark + "Set up your account" heading).
 */
function SignupWelcomePanel() {
  return (
    <aside className="hidden md:flex md:w-[47%] md:shrink-0 md:flex-col md:justify-between md:gap-8 md:border-r md:border-line md:bg-primary/5 md:p-8 md:text-left lg:p-10 xl:p-12">
      <div className="flex flex-col gap-6 lg:gap-8">
        <Image
          src="/wordmark.svg"
          alt="Sellonit"
          width={160}
          height={36}
          priority
          className="h-8 w-auto"
        />
        <div className="flex flex-col items-start gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
            <UserPlusIcon />
          </span>
          <h2 className="font-heading text-2xl font-semibold text-ink lg:text-[28px] xl:text-3xl">
            Set up your account
          </h2>
          <p className="text-sm text-subtle lg:text-base">Tell us a little about yourself.</p>
        </div>
      </div>

      {/* Center illustration. */}
      <div className="flex flex-col items-center justify-center py-4 lg:py-8">
        {/*
          PLACEHOLDER: the "orange cat on a floating dashboard card" artwork
          does not exist in the repo (public/ only has the wordmark and the
          shopping bag). Drop the asset in and replace this block — the panel
          is sized for a ~340px wide illustration.
        */}
        <div
          role="img"
          aria-label="Illustration of an orange cat resting on a floating shop dashboard card"
          className="flex aspect-[340/300] w-[340px] max-w-full flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-primary/40 bg-white/60 px-6 text-center"
        >
          <span className="text-sm font-medium text-subtle">Illustration placeholder</span>
          <span className="text-xs text-subtle">340 × 300 · cat on a dashboard card</span>
        </div>
      </div>

      <ul className="flex flex-col gap-5">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {feature.icon}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold text-ink lg:text-base">{feature.title}</span>
              <span className="text-xs text-subtle lg:text-sm">{feature.description}</span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default function AccountDetailsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Below md the page keeps the original shell; from md up the logo lives
          inside the card's left panel, so the top navbar is not rendered. */}
      <div className="md:hidden">
        <Navbar rightLink={{ label: 'Account details', variant: 'text' }} />
      </div>

      <main className="flex flex-1 items-start justify-center px-0 pt-8 pb-12 sm:px-6 sm:pt-16 md:items-center md:px-6 md:py-10">
        <div className="flex w-full items-center justify-center pt-15 md:pt-0">
          <AuthCard
            gapClassName="gap-6 md:gap-12"
            className="md:w-full! md:max-w-[1392px]! md:flex-row md:items-stretch md:gap-0! md:overflow-hidden md:rounded-card! md:border! md:p-0!"
          >
            {/* Mobile/tablet header (unchanged): bag mark + original heading. */}
            <div className="md:hidden">
              <AuthCardHeader icon={<BagMark />} title="Set up your account">
                Tell us a little about yourself
              </AuthCardHeader>
            </div>

            <SignupWelcomePanel />

            <div className="flex w-full flex-col gap-6 md:w-[53%] md:min-w-[260px] md:gap-9 md:p-9">
              <div className="hidden md:flex md:flex-col md:gap-2 md:text-left">
                <h1 className="text-2xl font-semibold text-ink">Account details</h1>
                <p className="text-sm text-subtle">Create your sellonit account to get started</p>
              </div>
              <CreateAccountForm />
            </div>
          </AuthCard>
        </div>
      </main>
    </div>
  );
}
