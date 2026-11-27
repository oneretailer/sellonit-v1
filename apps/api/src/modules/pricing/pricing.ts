export const PRICING_RULE_TYPE = 'FLOOR_CEILING' as const;

export type PricingRuleType = typeof PRICING_RULE_TYPE;

export type PricingRule = {
  ruleType: PricingRuleType;
  config: {
    maxMarkupKobo: bigint | null;
  };
};

export type PricingRejectionReason = 'BELOW_FLOOR' | 'ABOVE_CEILING';

export type PricingValidationResult =
  { ok: true; reason: null } | { ok: false; reason: PricingRejectionReason };

function ok(): PricingValidationResult {
  return { ok: true, reason: null };
}

function fail(reason: PricingRejectionReason): PricingValidationResult {
  return { ok: false, reason };
}

function assertValidConfiguration(baseKobo: bigint, rule: PricingRule | null): void {
  if (baseKobo <= 0n) throw new RangeError('Base price must be greater than zero');
  if (rule && rule.config.maxMarkupKobo !== null && rule.config.maxMarkupKobo < 0n) {
    throw new RangeError('Maximum markup cannot be negative');
  }
}

export function validateRetailPrice(
  baseKobo: bigint,
  rule: PricingRule | null,
  priceKobo: bigint,
): PricingValidationResult {
  assertValidConfiguration(baseKobo, rule);

  if (priceKobo < baseKobo) return fail('BELOW_FLOOR');

  const maxMarkup = rule?.config.maxMarkupKobo ?? null;
  if (maxMarkup !== null && priceKobo > baseKobo + maxMarkup) return fail('ABOVE_CEILING');

  return ok();
}
