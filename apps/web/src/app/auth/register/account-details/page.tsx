import { existsSync } from 'node:fs';
import path from 'node:path';
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

/*
 * Export the cat + dashboard-card artwork from Figma (select it, Export, PNG @2x)
 * and save it as public/signup-illustration.png. Until that file exists, a
 * dashed placeholder is shown instead of a broken image.
 */
const ILLUSTRATION_SRC = '/createacc.png';
const HAS_ILLUSTRATION = existsSync(path.join(process.cwd(), 'public', ILLUSTRATION_SRC));

/*
 * NOTE: every Tailwind class below is written out in full on purpose.
 * Tailwind only generates classes it can read literally in the source, so
 * never build them with template strings or variables.
 *
 * Height rules used on small laptops:
 *   [@media(max-height:820px)]  -> tighter padding / gaps
 *   [@media(max-height:720px)]  -> also hide the illustration + descriptions
 */

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
    <svg {...panelIconProps} className="size-7 xl:size-9">
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
    icon: <BarChartIcon />,
    title: 'Grow your business',
    description: 'Access tools to manage and scale.',
  },
];

/**
 * Left "welcome" panel. Decorative only, hidden below `md`.
 * Matches the prototype: cool light-grey panel with a soft curved shape in the
 * top-right corner, big wordmark, a plain orange user-plus icon (no tile),
 * large navy heading, the illustration, then the three feature rows.
 */
function SignupWelcomePanel() {
  return (
    <aside className="relative hidden overflow-hidden md:flex md:w-[40%] md:shrink-0 md:flex-col md:justify-between md:gap-5 md:border-r md:border-line md:bg-[#F7F8FC] md:p-6 md:text-left lg:w-[45%] lg:p-8 xl:w-[47%] xl:p-12 [@media(max-height:820px)]:md:gap-4 [@media(max-height:820px)]:md:py-6 [@media(max-height:820px)]:xl:px-10">
      {/* Soft curved shape in the top-right corner (swap for the exact Figma SVG if you have it). */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-75 -right-50 size-72 rounded-full bg-[#EEF0F7] xl:size-96"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute 
        -top-60 -right-65 size-72 rounded-full bg-[#EEF0F7] xl:size-96"
      />

      <div className="relative flex flex-col items-start justify-start  gap-5 lg:gap-6">
        <Image
          src="/wordmark.svg"
          alt="Sellonit"
          width={160}
          height={36}
          priority
          className="h-7 w-auto  xl:h-10 [@media(max-height:820px)]:xl:h-8"
        />
        <div className="flex flex-col items-start gap-2 lg:gap-3">
          <span className="text-primary">
            <UserPlusIcon />
          </span>
          <h2
            className="font-heading text-2xl font-bold tracking-tight 
          text-[#18325C] lg:text-3xl xl:text-[48px] xl:leading-tight
           [@media(max-height:820px)]:xl:text-[48px]"
          >
            Set up your account
          </h2>
          <p className="text-sm text-subtle lg:text-base xl:text-lg">
            Tell us a little about yourself.
          </p>
        </div>
      </div>

      {/* Illustration: flexible so it can never push the card taller. Hidden at md and on very short screens. */}
      <div className="relative hidden min-h-0 flex-1 items-center justify-center lg:flex [@media(max-height:720px)]:lg:hidden">
        {HAS_ILLUSTRATION ? (
          <Image
            src={ILLUSTRATION_SRC}
            alt="Orange cat resting on a floating shop dashboard card"
            width={520}
            height={440}
            className="h-auto max-h-[38vh] w-full max-w-[480px] object-contain"
          />
        ) : (
          <div
            role="img"
            aria-label="Illustration placeholder"
            className="flex aspect-[480/400] max-h-[38vh] w-full max-w-[480px] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-primary/40 bg-white/60 px-6 text-center"
          >
            <span className="text-sm font-medium text-subtle">Illustration placeholder</span>
            <span className="text-xs text-subtle">
              Save the Figma export as public/signup-illustration.png
            </span>
          </div>
        )}
      </div>

      <ul className="relative flex flex-col gap-4 xl:gap-5 [@media(max-height:820px)]:gap-3">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [@media(max-height:820px)]:size-8">
              {feature.icon}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold text-ink lg:text-base">{feature.title}</span>
              <span className="text-xs text-subtle lg:text-sm [@media(max-height:720px)]:hidden">
                {feature.description}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export default function AccountDetailsPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      {/* Below md the page keeps the original shell; from md up the logo lives
          inside the card's left panel, so the top navbar is not rendered. */}
      <div className="md:hidden">
        <Navbar rightLink={{ label: 'Account details', variant: 'text' }} />
      </div>

      <main className="flex flex-1 items-start justify-center px-0 pt-8 pb-12 sm:px-6 sm:pt-16 md:items-center md:px-4 md:py-6 lg:px-6 lg:py-8 [@media(max-height:820px)]:md:py-4">
        <div className="flex w-full items-center justify-center pt-15 md:pt-0">
          <AuthCard
            gapClassName="gap-6 md:gap-12"
            className="md:w-full! md:max-w-[1392px]! md:flex-row md:items-stretch md:gap-0! md:overflow-hidden md:rounded-card! md:border! md:p-0! md:shadow-[0_12px_48px_rgba(16,24,40,0.08)]"
          >
            {/* Mobile/tablet header (unchanged): bag mark + original heading. */}
            <div className="md:hidden">
              <AuthCardHeader icon={<BagMark />} title="Set up your account">
                Tell us a little about yourself
              </AuthCardHeader>
            </div>

            <SignupWelcomePanel />

            {/* Form column. The [&_...] rules restyle the inputs to the prototype's
                pill shape and compact the form on short screens, scoped to this
                page only (no shared component is edited). */}
            <div className="flex w-full min-w-0 flex-col gap-6 md:w-auto md:flex-1 md:gap-6 md:bg-white md:p-6 lg:gap-7 lg:p-8 xl:gap-9 xl:p-12 md:[&_label]:font-medium md:[&_input:not([type=checkbox])]:h-11 md:[&_input:not([type=checkbox])]:rounded-full md:[&_input:not([type=checkbox])]:px-5 xl:[&_input:not([type=checkbox])]:h-14 [@media(max-height:820px)]:md:gap-4 [@media(max-height:820px)]:md:py-6 [@media(max-height:820px)]:[&_form]:gap-3 [@media(max-height:820px)]:xl:[&_input:not([type=checkbox])]:h-12">
              <div className="hidden md:flex md:flex-col md:gap-1.5 md:text-left xl:gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-ink lg:text-3xl xl:text-4xl">
                  Account details
                </h1>
                <p className="text-sm text-subtle lg:text-base xl:text-lg">
                  Create your sellonit account to get started
                </p>
              </div>
              <CreateAccountForm />
            </div>
          </AuthCard>
        </div>
      </main>
    </div>
  );
}
