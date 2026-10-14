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

const registeredWithPhone: RegisterFlowState = {
  ...collected,
  password: null,
  phone: '8072994315',
  registered: { email: 'ada@example.com', phone: '8072994315' },
};

const registeredWithoutPhone: RegisterFlowState = {
  ...collected,
  password: null,
  phone: null,
  registered: { email: 'ada@example.com', phone: null },
};

describe('REGISTER_STEPS', () => {
  it('runs in the backend order, with phone verification before the email step', () => {
    expect(REGISTER_STEPS.map((step) => step.id)).toEqual([
      'name',
      'email',
      'password',
      'phone',
      'verify-phone',
      'check-email',
    ]);
  });

  it('gives every step a unique URL', () => {
    const paths = REGISTER_STEPS.map((step) => step.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe('nextRegisterStep', () => {
  it('goes from phone to the phone code step when a number was given', () => {
    expect(nextRegisterStep('phone', registeredWithPhone)?.id).toBe('verify-phone');
  });

  it('skips the phone code step when the phone step was skipped', () => {
    expect(nextRegisterStep('phone', registeredWithoutPhone)?.id).toBe('check-email');
  });

  it('skips the phone code step when the phone is null even if the account exists', () => {
    expect(nextRegisterStep('phone', { ...registeredWithoutPhone, phone: null })?.id).toBe(
      'check-email',
    );
  });

  it('returns null after the last step', () => {
    expect(nextRegisterStep('check-email', registeredWithPhone)).toBeNull();
  });

  it('walks the simple steps in order', () => {
    expect(nextRegisterStep('name', collected)?.id).toBe('email');
    expect(nextRegisterStep('email', collected)?.id).toBe('password');
    expect(nextRegisterStep('password', collected)?.id).toBe('phone');
  });
});

describe('canEnter guards', () => {
  const byId = (id: string) => REGISTER_STEPS.find((step) => step.id === id);

  it('blocks the phone step until the name, email and password are collected', () => {
    expect(byId('phone')?.canEnter(initialRegisterFlowState)).toBe(false);
    expect(byId('phone')?.canEnter(collected)).toBe(true);
  });

  it('keeps the phone step enterable after the password is cleared on registration', () => {
    expect(byId('phone')?.canEnter(registeredWithPhone)).toBe(true);
  });

  it('blocks the phone code and check-email steps until the account exists', () => {
    expect(byId('verify-phone')?.canEnter(collected)).toBe(false);
    expect(byId('check-email')?.canEnter(collected)).toBe(false);
    expect(byId('check-email')?.canEnter(registeredWithoutPhone)).toBe(true);
  });
});
