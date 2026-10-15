import type { Route } from 'next';
import type { ComponentType } from 'react';
import { LoginEmailStep } from './LoginEmailStep';
import { LoginPasswordStep } from './LoginPasswordStep';

export type LoginFlowState = {
  /** Set by the email step. Null means the password step cannot be entered yet. */
  email: string | null;
};

export type LoginStepProps = {
  /** Email from the query string (e.g. after the "account already exists" redirect). */
  initialEmail?: string;
};

export type LoginStepDefinition<Id extends string = string> = {
  id: Id;
  path: Route;
  title: string;
  canEnter: (state: LoginFlowState) => boolean;
  Component: ComponentType<LoginStepProps>;
};

/**
 * Login steps: email, then password. Logging in (POST /auth/login) happens on
 * the password step. A successful login goes to /account.
 */
export const LOGIN_STEPS = [
  {
    id: 'email',
    path: '/auth/login/email',
    title: 'Log in',
    canEnter: () => true,
    Component: LoginEmailStep,
  },
  {
    id: 'password',
    path: '/auth/login/password',
    title: 'Enter your password',
    canEnter: (state) => state.email !== null,
    Component: LoginPasswordStep,
  },
] as const satisfies readonly LoginStepDefinition[];

export type LoginStepId = (typeof LOGIN_STEPS)[number]['id'];

export function isLoginStepId(value: string): value is LoginStepId {
  return LOGIN_STEPS.some((step) => step.id === value);
}
