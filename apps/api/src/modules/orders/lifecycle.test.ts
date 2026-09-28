import type { components } from '@sellonit/shared';
import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  canCompleteOrder,
  fulfillmentTransition,
  shipmentTransition,
  completeOrder,
  evaluateSettlementEligibility,
  initialEscrowState,
  paidState,
  paymentTransition,
  reconcileSettled,
  type CommercialOrder,
} from './lifecycle.js';

function order(suppliers = 1): CommercialOrder {
  const ids = Array.from({ length: suppliers }, (_, i) => String(i));
  return {
    order: { id: 'order', status: 'PAID' },
    payment: { id: 'payment', orderId: 'order', status: 'CONFIRMED' },
    fulfillmentIds: ids,
    shipments: ids.map((id) => ({ id, orderId: 'order', fulfillmentId: id, status: 'DELIVERED' })),
    settlements: ids.map((id) => ({
      id,
      orderId: 'order',
      fulfillmentId: id,
      escrowId: id,
      shipmentIds: [id],
      status: 'LOCKED',
    })),
    escrows: ids.map((id) => ({
      id,
      orderId: 'order',
      paymentId: 'payment',
      settlementId: id,
      status: 'HELD',
    })),
  };
}

describe('v1.0.3 commercial lifecycle guards (not persistence or provider integration)', () => {
  it('1: pending payment cannot produce a PAID order', () => {
    expect(() => paidState('PENDING')).toThrow('PAYMENT_CONFIRMATION_CONFLICT');
    expect(() => paidState('FAILED')).toThrow('PAYMENT_CONFIRMATION_CONFLICT');
  });
  it('2: confirmed payment permits PAID', () => expect(paidState('CONFIRMED')).toBe('PAID'));
  it('3: only confirmed payment permits HELD escrow', () => {
    expect(initialEscrowState('CONFIRMED')).toBe('HELD');
    expect(() => initialEscrowState('PENDING')).toThrow();
  });
  it('4: all associated shipments delivered permits PENDING settlement', () => {
    expect(evaluateSettlementEligibility(order()).settlements[0]?.status).toBe('PENDING');
  });
  it('5–6: delivery, held escrow and pending settlement never complete the order', () => {
    const a = evaluateSettlementEligibility(order());
    expect(a.order.status).toBe('PAID');
    expect(canCompleteOrder(a)).toBe(false);
    expect(() => completeOrder(a)).toThrow('ORDER_NOT_ELIGIBLE_FOR_COMPLETION');
  });
  it('7–8: settled reconciliation releases escrow then completes the order', () => {
    const a = reconcileSettled(evaluateSettlementEligibility(order()), '0');
    expect(a.settlements[0]?.status).toBe('SETTLED');
    expect(a.escrows[0]?.status).toBe('RELEASED');
    expect(a.order.status).toBe('COMPLETED');
  });
  it('9: all suppliers must settle, not just the first', () => {
    const a = reconcileSettled(evaluateSettlementEligibility(order(2)), '0');
    expect(a.order.status).toBe('PAID');
    expect(a.settlements[1]?.status).toBe('PENDING');
    expect(reconcileSettled(a, '1').order.status).toBe('COMPLETED');
  });
  it('10: repeated eligibility/reconciliation evaluation does not repeat state changes', () => {
    const a = evaluateSettlementEligibility(order());
    expect(evaluateSettlementEligibility(a)).toEqual(a);
    const settled = reconcileSettled(a, '0');
    expect(reconcileSettled(settled, '0')).toEqual(settled);
    expect(a.escrows[0]?.status).toBe('HELD'); // input not mutated
  });
  it('rejects skipped and reversed payment transitions', () => {
    expect(paymentTransition('PENDING', 'CONFIRMED')).toBe('CONFIRMED');
    expect(paymentTransition('PENDING', 'FAILED')).toBe('FAILED');
    expect(paymentTransition('CONFIRMED', 'CONFIRMED')).toBe('CONFIRMED');
    expect(() => paymentTransition('FAILED', 'CONFIRMED')).toThrow();
    expect(() => paymentTransition('CONFIRMED', 'PENDING')).toThrow();
  });
  it('does not settle LOCKED records', () => {
    expect(() => reconcileSettled(order(), '0')).toThrow('SETTLEMENT_NOT_ELIGIBLE');
  });
  it.each(['PENDING', 'IN_TRANSIT', 'FAILED'] as const)(
    'blocks settlement for %s shipment',
    (status) => {
      const a = order();
      a.shipments = a.shipments.map((s) => ({ ...s, status }));
      expect(evaluateSettlementEligibility(a).settlements[0]?.status).toBe('LOCKED');
    },
  );
  it('requires every shipment in a fulfillment', () => {
    const a = order();
    a.shipments.push({ id: 'second', orderId: 'order', fulfillmentId: '0', status: 'IN_TRANSIT' });
    expect(evaluateSettlementEligibility(a).settlements[0]?.status).toBe('LOCKED');
  });
  it('rejects missing or empty financial associations, rather than vacuous every()', () => {
    const a = reconcileSettled(evaluateSettlementEligibility(order()), '0');
    a.order.status = 'PAID';
    expect(canCompleteOrder(a)).toBe(true);
    expect(canCompleteOrder({ ...a, settlements: [] })).toBe(false);
    expect(canCompleteOrder({ ...a, fulfillmentIds: [] })).toBe(false);
    expect(canCompleteOrder({ ...a, fulfillmentIds: ['0', 'missing'] })).toBe(false);
    expect(canCompleteOrder({ ...a, shipments: [] })).toBe(false);
    expect(canCompleteOrder({ ...a, escrows: [] })).toBe(false);
    expect(canCompleteOrder({ ...a, settlements: [...a.settlements, ...a.settlements] })).toBe(
      false,
    );
  });
  it('rejects mismatched order/payment/escrow relationships', () => {
    const a = order();
    a.escrows = a.escrows.map((e) => ({ ...e, orderId: 'other-order' }));
    expect(evaluateSettlementEligibility(a).settlements[0]?.status).toBe('LOCKED');
    expect(() => reconcileSettled(a, '0')).toThrow();
  });
});

it('uses the exact canonical v1.0.3 generated state unions', () => {
  expectTypeOf<components['schemas']['OrderState']>().toEqualTypeOf<
    'NEW' | 'PAID' | 'COMPLETED' | 'CANCELLED'
  >();
  expectTypeOf<components['schemas']['PaymentState']>().toEqualTypeOf<
    'PENDING' | 'CONFIRMED' | 'FAILED'
  >();
  expectTypeOf<components['schemas']['EscrowState']>().toEqualTypeOf<
    'HELD' | 'RELEASED' | 'REFUNDED'
  >();
  expectTypeOf<components['schemas']['FulfillmentState']>().toEqualTypeOf<
    'PENDING_BATCH' | 'IN_BULK_REQUEST' | 'AT_3PL_HUB' | 'COMPLETED'
  >();
  expectTypeOf<components['schemas']['ShipmentState']>().toEqualTypeOf<
    'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'FAILED'
  >();
  expectTypeOf<components['schemas']['SettlementState']>().toEqualTypeOf<
    'LOCKED' | 'PENDING' | 'SETTLED'
  >();
});

it('enforces fulfillment progression without changing commercial order state', () => {
  expect(fulfillmentTransition('PENDING_BATCH', 'IN_BULK_REQUEST')).toBe('IN_BULK_REQUEST');
  expect(fulfillmentTransition('IN_BULK_REQUEST', 'AT_3PL_HUB')).toBe('AT_3PL_HUB');
  expect(fulfillmentTransition('AT_3PL_HUB', 'COMPLETED')).toBe('COMPLETED');
  expect(() => fulfillmentTransition('PENDING_BATCH', 'COMPLETED')).toThrow();
  expect(canCompleteOrder(order())).toBe(false);
});

it('enforces shipment progression and terminal failure', () => {
  expect(shipmentTransition('PENDING', 'IN_TRANSIT')).toBe('IN_TRANSIT');
  expect(shipmentTransition('IN_TRANSIT', 'DELIVERED')).toBe('DELIVERED');
  expect(shipmentTransition('IN_TRANSIT', 'FAILED')).toBe('FAILED');
  expect(() => shipmentTransition('FAILED', 'DELIVERED')).toThrow();
  expect(() => shipmentTransition('PENDING', 'DELIVERED')).toThrow();
});
