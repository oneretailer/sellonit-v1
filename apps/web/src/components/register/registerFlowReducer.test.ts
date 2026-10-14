import { describe, expect, it } from 'vitest';
import { initialRegisterFlowState, registerFlowReducer } from './registerFlowReducer';

const named = registerFlowReducer(initialRegisterFlowState, {
  type: 'nameSaved',
  firstName: 'Ada',
  lastName: 'Eze',
});

describe('registerFlowReducer', () => {
  it('starts empty, with nothing registered', () => {
    expect(initialRegisterFlowState.registered).toBeNull();
    expect(initialRegisterFlowState.firstName).toBeNull();
  });

  it('stores the name and keeps it across later steps', () => {
    const withEmail = registerFlowReducer(named, {
      type: 'emailSaved',
      email: 'ada@example.com',
    });
    expect(withEmail).toMatchObject({
      firstName: 'Ada',
      lastName: 'Eze',
      email: 'ada@example.com',
    });
  });

  it('clears the password and stores the account once registered', () => {
    const withPassword = registerFlowReducer(named, {
      type: 'passwordSaved',
      password: 'correct-horse-1',
    });
    const registered = registerFlowReducer(withPassword, {
      type: 'registered',
      account: { email: 'ada@example.com', phone: '8072994315' },
    });
    expect(registered.password).toBeNull();
    expect(registered.phone).toBe('8072994315');
    expect(registered.registered).toEqual({ email: 'ada@example.com', phone: '8072994315' });
  });

  it('marks the phone verified without touching the number', () => {
    const saved = registerFlowReducer(named, { type: 'phoneSaved', phone: '8072994315' });
    const verified = registerFlowReducer(saved, { type: 'phoneVerified' });
    expect(verified).toMatchObject({ phone: '8072994315', phoneVerified: true });
  });

  it('clears verification when a different number is saved', () => {
    const verified = { ...named, phone: '8072994315', phoneVerified: true };
    expect(
      registerFlowReducer(verified, { type: 'phoneSaved', phone: '9012345678' }),
    ).toMatchObject({
      phone: '9012345678',
      phoneVerified: false,
    });
  });

  it('keeps verification when the same number is saved again', () => {
    const verified = { ...named, phone: '8072994315', phoneVerified: true };
    expect(registerFlowReducer(verified, { type: 'phoneSaved', phone: '8072994315' })).toBe(
      verified,
    );
  });
});
