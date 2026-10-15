import { describe, expect, it } from 'vitest';
import { validatePasswordStep } from './validation';

describe('validatePasswordStep', () => {
  it('passes when both fields match and meet the rules', () => {
    expect(validatePasswordStep('correct-horse-1', 'correct-horse-1')).toEqual({});
  });

  it('reports a mismatch on the confirmation field', () => {
    expect(validatePasswordStep('correct-horse-1', 'correct-horse-2')).toEqual({
      confirm: 'Passwords do not match.',
    });
  });

  it('asks for confirmation when the confirmation is empty', () => {
    expect(validatePasswordStep('correct-horse-1', '')).toEqual({
      confirm: 'Re-enter your password to confirm it.',
    });
  });

  it('keeps the backend length rules (8 to 128 characters)', () => {
    expect(validatePasswordStep('short', 'short').password).toContain('8 and 128');
    expect(validatePasswordStep('x'.repeat(129), 'x'.repeat(129)).password).toContain('8 and 128');
    expect(validatePasswordStep('12345678', '12345678').password).toBeUndefined();
  });

  it('compares exactly (case-sensitive)', () => {
    expect(validatePasswordStep('Correct-Horse-1', 'correct-horse-1').confirm).toBe(
      'Passwords do not match.',
    );
  });
});
