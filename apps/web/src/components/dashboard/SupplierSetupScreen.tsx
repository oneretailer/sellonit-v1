'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/reuseable/Navbar';
import { PrimaryButton } from '@/components/reuseable/PrimaryButton';
import { ArrowLeftIcon } from '@/components/reuseable/icons';
import { useSupplierSetupProgress } from '@/lib/onboarding/supplierSetup';

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-3.5"
    >
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-6"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

/**
 * Supplier Setup (verification) screen. Reached from the dashboard progress
 * widget and directly via /dashboard/supplier-setup (survives refresh).
 *
 * The checklist and the "Complete setup" button read the SAME progress source
 * as the dashboard widget (useSupplierSetupProgress). "Complete setup" jumps to
 * the next incomplete step; clicking any row opens that step directly; when
 * everything is done it shows a success state.
 */
export function SupplierSetupScreen({
  completedStepIds = [],
}: {
  completedStepIds?: readonly string[];
}) {
  const router = useRouter();
  const { steps, nextStep } = useSupplierSetupProgress(completedStepIds);
  const allComplete = nextStep === null;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <Navbar rightLink={{ label: 'Supplier Set up', variant: 'text' }} />
      <main className="flex flex-1 items-start justify-center px-4 py-8 md:items-center-safe md:px-6 md:py-12">
        <div className="flex w-full max-w-[1140px] flex-col items-center gap-4 md:flex-row md:items-start md:justify-center md:gap-6">
          <section className="flex w-full max-w-[480px] flex-col gap-5 rounded-card border border-line bg-surface p-6 text-left shadow-ws-card md:p-8">
            <div className="flex flex-col gap-2">
              <h1 className="font-heading text-xl font-bold tracking-tight text-ink md:text-2xl">
                Set up your supplier business
              </h1>
              <p className="text-sm text-subtle">
                You&apos;ll be able to add products, manage stock, set wholesale prices, and supply
                retailers through Sellonit.
              </p>
            </div>

            <p className="text-sm font-semibold text-ink">Your supplier setup</p>

            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {steps.map((step) => (
                <li key={step.id}>
                  <Link
                    href={step.href}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                        step.complete
                          ? 'bg-primary text-on-primary'
                          : 'border-2 border-line bg-surface'
                      }`}
                    >
                      {step.complete ? <CheckIcon /> : null}
                    </span>
                    <span className="min-w-0 flex-1 text-sm text-ink">{step.label}</span>
                    <span className="sr-only">{step.complete ? 'completed' : 'not completed'}</span>
                  </Link>
                </li>
              ))}
            </ul>

            {allComplete ? (
              <div
                role="status"
                className="flex items-center gap-3 rounded-2xl border border-status-published-fg/30 bg-status-published-bg px-4 py-3 text-status-published-fg"
              >
                <SuccessIcon />
                <p className="text-sm font-semibold text-ink">
                  You&apos;re all set — your supplier business is ready.
                </p>
              </div>
            ) : null}

            <PrimaryButton
              shape="rounded"
              className="md:h-14 md:font-bold"
              onClick={() => {
                if (nextStep) router.push(nextStep.href);
                else router.push('/dashboard/overview');
              }}
            >
              {allComplete ? 'Go to dashboard' : 'Complete setup'}
            </PrimaryButton>

            <Link
              href="/dashboard/overview"
              className="inline-flex min-h-11 items-center justify-center gap-2 self-center px-4 text-base font-medium text-ink hover:text-subtle"
            >
              <ArrowLeftIcon />
              Back
            </Link>
          </section>

          <Link
            href="/dashboard/overview"
            className="order-first self-end rounded-ws-pill bg-status-draft-bg px-5 py-2 text-sm font-medium text-subtle transition-colors hover:text-ink md:order-none md:self-start"
          >
            skip
          </Link>
        </div>
      </main>
    </div>
  );
}
