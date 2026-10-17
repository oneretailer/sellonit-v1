import { describe, expect, it } from 'vitest';
import { initialRegisterFlowState, type RegisterFlowState } from './registerFlowReducer';
import { nextRegisterStep, REGISTER_STEPS } from './registerSteps';

const collected: RegisterFlowState = {
  ...initialRegisterFlowState,
  firstName: 'Ada',
  lastName: 'Eze',
  email: 'ada@example.com',
  password: 'correct-horse-1',
};

const registered: RegisterFlowState = {
  ...collected,
  password: null,
  phone: null,
  registered: { email: 'ada@example.com', phone: null },
};

describe('REGISTER_STEPS', () => {
  it('runs without collecting a phone number during registration', () => {
    expect(REGISTER_STEPS.map((step) => step.id)).toEqual([
      'name',
      'email',
      'password',
      'check-email',
    ]);
  });

  it('gives every step a unique URL', () => {
    const paths = REGISTER_STEPS.map((step) => step.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('nextRegisterStep', () => {
  it('returns null after the last step', () => {
    expect(nextRegisterStep('check-email', registered)).toBeNull();
  });

  it('walks the simple steps in order', () => {
    expect(nextRegisterStep('name', collected)?.id).toBe('email');
    expect(nextRegisterStep('email', collected)?.id).toBe('password');
    expect(nextRegisterStep('password', collected)?.id).toBe('check-email');
  });
});

describe('canEnter guards', () => {
  const byId = (id: string) => REGISTER_STEPS.find((step) => step.id === id);

  it('blocks the email confirmation step until the account exists', () => {
    expect(byId('check-email')?.canEnter(collected)).toBe(false);
    expect(byId('check-email')?.canEnter(registered)).toBe(true);
  });
});
