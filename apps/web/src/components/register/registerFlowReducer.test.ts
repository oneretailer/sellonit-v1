import { describe, expect, it } from 'vitest';
import { initialRegisterFlowState, registerFlowReducer } from './registerFlowReducer';

describe('registerFlowReducer', () => {
  it('starts with no phone number and nothing verified', () => {
    expect(initialRegisterFlowState).toEqual({ phone: null, phoneVerified: false });
  });

  it('stores the phone number when it is saved', () => {
    const next = registerFlowReducer(initialRegisterFlowState, {
      type: 'phoneSaved',
      phone: '8072994315',
    });
    expect(next).toEqual({ phone: '8072994315', phoneVerified: false });
  });

  it('marks the phone verified without touching the number', () => {
    const saved = registerFlowReducer(initialRegisterFlowState, {
      type: 'phoneSaved',
      phone: '8072994315',
    });
    const verified = registerFlowReducer(saved, { type: 'phoneVerified' });
    expect(verified).toEqual({ phone: '8072994315', phoneVerified: true });
  });

  it('keeps verification when the same number is saved again', () => {
    const verified = { phone: '8072994315', phoneVerified: true };
    expect(registerFlowReducer(verified, { type: 'phoneSaved', phone: '8072994315' })).toBe(
      verified,
    );
  });

  it('clears verification when a different number is saved', () => {
    const verified = { phone: '8072994315', phoneVerified: true };
    expect(registerFlowReducer(verified, { type: 'phoneSaved', phone: '9012345678' })).toEqual({
      phone: '9012345678',
      phoneVerified: false,
    });
  });
});
