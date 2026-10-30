'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { InlineError } from '@/components/reuseable/InlineError';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { Spinner } from '@/components/reuseable/Spinner';
import { ArrowLeftIcon } from '@/components/reuseable/icons';
import { ApiError } from '@/lib/api-client';
import { useAuthSession } from '@/lib/auth/AuthSessionProvider';
import { AUTH_ROUTE } from '@/lib/auth/authDestination';
import { roleApi } from '@/lib/onboarding/roleApi';
import {
  roleRecommendationContent,
  type AccountRole,
  type RoleBulletIcon,
} from '@/lib/onboarding/roles';

/* ── Thin outline icons for the "what you can do" list (aria-hidden) ────── */

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  className: 'size-5',
};

function CubeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M4 7.5 12 12l8-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg {...iconProps}>
      <path d="M20 12.5 12.5 20a2 2 0 0 1-2.8 0L4 14.3V4h10.3l5.7 5.7a2 2 0 0 1 0 2.8Z" />
      <circle cx="8.5" cy="8.5" r="1.25" />
    </svg>
  );
}

function StorefrontIcon() {
  return (
    <svg {...iconProps}>
      <path d="M4 9.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9.5" />
      <path d="M3 9.5 5 4h14l2 5.5" />
      <path d="M3 9.5c0 1.4 1.1 2.5 2.5 2.5S8 10.9 8 9.5c0 1.4 1.1 2.5 2.5 2.5S13 10.9 13 9.5c0 1.4 1.1 2.5 2.5 2.5S18 10.9 18 9.5c0 1.4 1.1 2.5 2.5 2.5" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  );
}

function BagIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </svg>
  );
}

function CircleCheckIcon() {
  return (
    <svg {...iconProps} className="size-4">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

const BULLET_ICONS: Record<RoleBulletIcon, () => React.JSX.Element> = {
  box: CubeIcon,
  tag: TagIcon,
  storefront: StorefrontIcon,
  bag: BagIcon,
};

/**
 * Recommendation view rendered inside the role-selection page's AuthCard.
 *
 * Nothing is saved on render: "Continue as X" persists the choice with
 * PUT /auth/business-intent, updates the shared session with the returned user
 * (so the dashboard guard already sees fresh server data) and only then
 * navigates. "Go Back" returns to the selection view without saving.
 */
export function RoleRecommendation({ role, onBack }: { role: AccountRole; onBack: () => void }) {
  const router = useRouter();
  const { acceptAuthenticatedUser } = useAuthSession();
  const content = roleRecommendationContent(role);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, [role]);

  async function handleContinue(): Promise<void> {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError(null);
    try {
      const saved = await roleApi.saveRole(role);
      // Refresh the in-memory session BEFORE navigating: the dashboard guard
      // reads the server user, so it must already show onboardingIntent.
      acceptAuthenticatedUser(saved.user);
      router.replace(AUTH_ROUTE.dashboard);
    } catch (caught: unknown) {
      inFlight.current = false;
      setSaving(false);
      setError(
        caught instanceof ApiError && caught.status === 401
          ? 'Your session has expired. Log in again to continue.'
          : "We couldn't save your selection. Please try again.",
      );
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="text-[26px] font-bold leading-8 text-ink outline-none sm:text-[32px] sm:leading-10"
        >
          Your Recommended Role
        </h1>
        <p className="mx-auto block max-w-[430px] text-base leading-6 text-subtle sm:text-lg sm:leading-7">
          {content.subtitle}
        </p>
      </div>

      {/* Role detail card */}
      <div className="flex w-full flex-col gap-5 rounded-[16px] border border-line bg-white p-6 text-left">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-bold text-ink sm:text-2xl">{content.name}</p>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[13px] font-semibold text-primary">
            <CircleCheckIcon />
            Recommended
          </span>
        </div>
        <h2 className="text-base font-semibold text-ink">{content.heading}</h2>
        <ul className="flex flex-col gap-4">
          {content.bullets.map((bullet) => {
            const Icon = BULLET_ICONS[bullet.icon];
            return (
              <li key={bullet.text} className="flex items-center gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-ink">
                  <Icon />
                </span>
                <span className="min-w-0 text-base leading-6 text-ink">{bullet.text}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex w-full flex-col items-center gap-4">
        <PrimaryButton
          shape="rounded"
          onClick={() => void handleContinue()}
          loading={saving}
          disabled={saving}
        >
          {saving ? (
            <>
              <Spinner />
              Saving…
            </>
          ) : (
            `Continue as a ${content.name}`
          )}
        </PrimaryButton>
        <p className="max-w-[430px] text-sm leading-5 text-subtle">{content.dashboard}</p>
        {error ? <InlineError>{error}</InlineError> : null}
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 px-4 text-base font-medium text-ink disabled:opacity-60"
        >
          <ArrowLeftIcon />
          Go Back
        </button>
      </div>
    </>
  );
}
