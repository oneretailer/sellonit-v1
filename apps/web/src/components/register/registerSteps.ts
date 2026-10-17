import type { Route } from 'next';
import type { ComponentType } from 'react';
import { CheckEmailStep } from './CheckEmailStep';
import { EmailStep } from './EmailStep';
import { NameStep } from './NameStep';
import { PasswordStep } from './PasswordStep';
import type { RegisterFlowState } from './registerFlowReducer';

export type RegisterStepDefinition<Id extends string = string> = {
  id: Id;
  /** URL of the step, e.g. `/auth/register/email`. */
  path: Route;
  /** Page title for the step. */
  title: string;
  /** Whether the step may be shown given the data collected so far. */
  canEnter: (state: RegisterFlowState) => boolean;
  /** Whether the step is skipped when navigating forward (e.g. no phone number given). */
  isSkipped: (state: RegisterFlowState) => boolean;
  Component: ComponentType;
};

/**
 * The registration steps, in the order the backend supports:
 *
 *   name → email → password (POST /auth/register runs here)
 *     → check-email (verify the email link, then log in)
 *
 * Adding a step: write its component in its own file, then add one entry here.
 * The URL, forward navigation, the skip-ahead guard and the static params all
 * come from this list. Reordering is moving entries.
 */
export const REGISTER_STEPS = [
  {
    id: 'name',
    path: '/auth/register/name',
    title: 'Create your account',
    canEnter: () => true,
    isSkipped: (_state) => false,
    Component: NameStep,
  },
  {
    id: 'email',
    path: '/auth/register/email',
    title: 'Your email address',
    canEnter: (state) => state.firstName !== null && state.lastName !== null,
    isSkipped: (_state) => false,
    Component: EmailStep,
  },
  {
    id: 'password',
    path: '/auth/register/password',
    title: 'Create a password',
    canEnter: (state) => state.email !== null,
    isSkipped: (_state) => false,
    Component: PasswordStep,
  },
  {
    id: 'check-email',
    path: '/auth/register/check-email',
    title: 'Check your email',
    canEnter: (state) => state.registered !== null,
    isSkipped: (_state) => false,
    Component: CheckEmailStep,
  },
] as const satisfies readonly RegisterStepDefinition[];

export type RegisterStepId = (typeof REGISTER_STEPS)[number]['id'];

export function isRegisterStepId(value: string): value is RegisterStepId {
  return REGISTER_STEPS.some((step) => step.id === value);
}

/** The first step of the flow. Used for the index redirect and the skip-ahead guard. */
export const FIRST_REGISTER_STEP = REGISTER_STEPS[0];

/**
 * The step to go to after `id`, skipping any step that does not apply to
 * `state`. Returns null when `id` is the last applicable step.
 */
export function nextRegisterStep(
  id: RegisterStepId,
  state: RegisterFlowState,
): (typeof REGISTER_STEPS)[number] | null {
  const start = REGISTER_STEPS.findIndex((step) => step.id === id);
  for (let index = start + 1; index < REGISTER_STEPS.length; index += 1) {
    const candidate = REGISTER_STEPS[index];
    if (candidate && !candidate.isSkipped(state)) {
      return candidate;
    }
  }
  return null;
}
