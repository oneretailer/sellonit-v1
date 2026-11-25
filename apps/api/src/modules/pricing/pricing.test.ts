import { describe, expect, it } from 'vitest';
import { validateRetailPrice, type PricingRule } from './pricing.js';

const cappedRule: PricingRule = {
  ruleType: 'FLOOR_CEILING',
  config: { maxMarkupKobo: 100n },
};

describe('validateRetailPrice', () => {
  it.each([
    [499n, { ok: false, reason: 'BELOW_FLOOR' }],
    [500n, { ok: true, reason: null }],
    [600n, { ok: true, reason: null }],
    [601n, { ok: false, reason: 'ABOVE_CEILING' }],
  ])('evaluates a capped rule at %s kobo', (priceKobo, expected) => {
    expect(validateRetailPrice(500n, cappedRule, priceKobo)).toEqual(expected);
  });

  it('allows any price at or above the floor when uncapped', () => {
    expect(validateRetailPrice(500n, null, 5000n)).toEqual({ ok: true, reason: null });
    expect(validateRetailPrice(500n, null, 499n)).toEqual({ ok: false, reason: 'BELOW_FLOOR' });
  });

  it('treats zero markup as a fixed base price', () => {
    expect(
      validateRetailPrice(500n, { ...cappedRule, config: { maxMarkupKobo: 0n } }, 500n),
    ).toEqual({ ok: true, reason: null });
    expect(
      validateRetailPrice(500n, { ...cappedRule, config: { maxMarkupKobo: 0n } }, 501n),
    ).toEqual({ ok: false, reason: 'ABOVE_CEILING' });
  });

  it('moves the ceiling with the base price', () => {
    expect(validateRetailPrice(550n, cappedRule, 650n)).toEqual({ ok: true, reason: null });
    expect(validateRetailPrice(550n, cappedRule, 651n)).toEqual({
      ok: false,
      reason: 'ABOVE_CEILING',
    });
  });

  it.each([
    [0n, cappedRule],
    [500n, { ...cappedRule, config: { maxMarkupKobo: -1n } }],
  ])('rejects invalid pricing configuration', (baseKobo, rule) => {
    expect(() => validateRetailPrice(baseKobo, rule, 500n)).toThrow(RangeError);
  });
});
