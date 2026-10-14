import type { Route } from 'next';
import type { ComponentType } from 'react';
import { PhoneStep } from './PhoneStep';
import type { RegisterFlowState } from './registerFlowReducer';
import { VerifyOtpStep } from './VerifyOtpStep';

export type RegisterStepDefinition<Id extends string = string> = {
  id: Id;
  /** URL of the step, e.g. `/auth/register/phone`. */
  path: Route;
  /** Page title for the step. */
  title: string;
  /** Whether the step may be shown given the data collected so far. */
  canEnter: (state: RegisterFlowState) => boolean;
  Component: ComponentType;
};

/**
 * The registration steps, in order.
 *
 * Adding a step: write its component in its own file, then add one entry here.
 * The URL, the back/next navigation, the skip-ahead guard and the static params
 * all come from this list.
 */
export const REGISTER_STEPS = [
  {
    id: 'phone',
    path: '/auth/register/phone',
    title: 'Create your account',
    canEnter: () => true,
    Component: PhoneStep,
  },
  {
    id: 'verify',
    path: '/auth/register/verify',
    title: 'Verify your phone number',
    // A verification code can only be requested after a phone number exists.
    canEnter: (state) => state.phone !== null,
    Component: VerifyOtpStep,
  },
] as const satisfies readonly RegisterStepDefinition[];

export type RegisterStepId = (typeof REGISTER_STEPS)[number]['id'];

export function isRegisterStepId(value: string): value is RegisterStepId {
  return REGISTER_STEPS.some((step) => step.id === value);
}
