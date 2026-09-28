import type { components } from '@sellonit/shared';

type Schema = components['schemas'];

/** A complete, transactionally loaded aggregate, never a client payload or tenant-filtered subset. */
export interface CommercialOrder {
  order: Pick<Schema['Order'], 'id' | 'status'>;
  payment: Pick<Schema['Payment'], 'id' | 'orderId' | 'status'>;
  /** Authoritative fulfillment plan, persisted when the paid order is split by supplier. */
  fulfillmentIds: string[];
  shipments: Pick<Schema['Shipment'], 'id' | 'orderId' | 'fulfillmentId' | 'status'>[];
  settlements: Pick<
    Schema['Settlement'],
    'id' | 'orderId' | 'fulfillmentId' | 'escrowId' | 'shipmentIds' | 'status'
  >[];
  escrows: Pick<Schema['Escrow'], 'id' | 'orderId' | 'paymentId' | 'settlementId' | 'status'>[];
}

export class LifecycleConflict extends Error {
  constructor(
    public readonly code:
      | 'INVALID_STATE_TRANSITION'
      | 'PAYMENT_CONFIRMATION_CONFLICT'
      | 'SETTLEMENT_NOT_ELIGIBLE'
      | 'ORDER_NOT_ELIGIBLE_FOR_COMPLETION',
  ) {
    super(code);
    this.name = 'LifecycleConflict';
  }
}

function unique(ids: string[]): boolean {
  return new Set(ids).size === ids.length;
}

function heldEscrow(a: CommercialOrder, s: CommercialOrder['settlements'][number]) {
  return a.escrows.find(
    (e) =>
      e.id === s.escrowId &&
      e.settlementId === s.id &&
      e.orderId === a.order.id &&
      e.paymentId === a.payment.id,
  );
}

function delivered(a: CommercialOrder, s: CommercialOrder['settlements'][number]): boolean {
  const shipments = a.shipments.filter((shipment) => shipment.fulfillmentId === s.fulfillmentId);
  return (
    s.orderId === a.order.id &&
    a.fulfillmentIds.includes(s.fulfillmentId) &&
    s.shipmentIds.length > 0 &&
    unique(s.shipmentIds) &&
    unique(shipments.map((shipment) => shipment.id)) &&
    shipments.length === s.shipmentIds.length &&
    shipments.every(
      (shipment) =>
        s.shipmentIds.includes(shipment.id) &&
        shipment.orderId === a.order.id &&
        shipment.status === 'DELIVERED',
    )
  );
}

/** Only call after signature/amount/reference verification and atomic stock reservation. */
export function paidState(payment: Schema['PaymentState']): Schema['OrderState'] {
  if (payment !== 'CONFIRMED') throw new LifecycleConflict('PAYMENT_CONFIRMATION_CONFLICT');
  return 'PAID';
}

export function initialEscrowState(payment: Schema['PaymentState']): Schema['EscrowState'] {
  paidState(payment);
  return 'HELD';
}

export function paymentTransition(
  current: Schema['PaymentState'],
  next: Schema['PaymentState'],
): Schema['PaymentState'] {
  if (current === next) return current;
  if (current !== 'PENDING' || next === 'PENDING') {
    throw new LifecycleConflict('INVALID_STATE_TRANSITION');
  }
  return next;
}

/** Pure eligibility evaluation: delivery never settles funds or completes the order. */
export function evaluateSettlementEligibility(a: CommercialOrder): CommercialOrder {
  if (
    a.order.status !== 'PAID' ||
    a.payment.status !== 'CONFIRMED' ||
    a.payment.orderId !== a.order.id
  ) {
    throw new LifecycleConflict('SETTLEMENT_NOT_ELIGIBLE');
  }
  return {
    ...a,
    settlements: a.settlements.map((s) =>
      s.status === 'LOCKED' && heldEscrow(a, s)?.status === 'HELD' && delivered(a, s)
        ? { ...s, status: 'PENDING' }
        : s,
    ),
  };
}

export function canCompleteOrder(a: CommercialOrder): boolean {
  return (
    a.order.status === 'PAID' &&
    a.payment.status === 'CONFIRMED' &&
    a.payment.orderId === a.order.id &&
    a.fulfillmentIds.length > 0 &&
    unique(a.fulfillmentIds) &&
    unique(a.settlements.map((s) => s.id)) &&
    unique(a.escrows.map((e) => e.id)) &&
    a.escrows.length === a.settlements.length &&
    a.settlements.length === a.fulfillmentIds.length &&
    a.fulfillmentIds.every(
      (id) => a.settlements.filter((s) => s.fulfillmentId === id).length === 1,
    ) &&
    a.shipments.every((s) => a.fulfillmentIds.includes(s.fulfillmentId)) &&
    a.settlements.every(
      (s) => s.status === 'SETTLED' && heldEscrow(a, s)?.status === 'RELEASED' && delivered(a, s),
    )
  );
}

/** Persist the returned states together, only after trusted settlement reconciliation.
 * This function does not send money. External release needs a durable idempotency key.
 */
export function reconcileSettled(a: CommercialOrder, settlementId: string): CommercialOrder {
  const s = a.settlements.find((candidate) => candidate.id === settlementId);
  const escrow = s && heldEscrow(a, s);
  if (
    !s ||
    !escrow ||
    a.payment.status !== 'CONFIRMED' ||
    a.payment.orderId !== a.order.id ||
    !['PAID', 'COMPLETED'].includes(a.order.status) ||
    !delivered(a, s)
  ) {
    throw new LifecycleConflict('SETTLEMENT_NOT_ELIGIBLE');
  }
  if (s.status === 'SETTLED' && escrow.status === 'RELEASED') return completeIfEligible(a);
  if (a.order.status !== 'PAID' || s.status !== 'PENDING' || escrow.status !== 'HELD') {
    throw new LifecycleConflict('SETTLEMENT_NOT_ELIGIBLE');
  }
  return completeIfEligible({
    ...a,
    settlements: a.settlements.map((row) =>
      row.id === s.id ? { ...row, status: 'SETTLED' } : row,
    ),
    escrows: a.escrows.map((row) => (row.id === escrow.id ? { ...row, status: 'RELEASED' } : row)),
  });
}

function completeIfEligible(a: CommercialOrder): CommercialOrder {
  return canCompleteOrder(a) ? { ...a, order: { ...a.order, status: 'COMPLETED' } } : a;
}

export function completeOrder(a: CommercialOrder): CommercialOrder {
  if (!canCompleteOrder(a)) throw new LifecycleConflict('ORDER_NOT_ELIGIBLE_FOR_COMPLETION');
  return completeIfEligible(a);
}

export function fulfillmentTransition(
  current: Schema['FulfillmentState'],
  next: Schema['FulfillmentState'],
): Schema['FulfillmentState'] {
  if (current === next) return current;
  if (
    (current === 'PENDING_BATCH' && next === 'IN_BULK_REQUEST') ||
    (current === 'IN_BULK_REQUEST' && next === 'AT_3PL_HUB') ||
    (current === 'AT_3PL_HUB' && next === 'COMPLETED')
  )
    return next;
  throw new LifecycleConflict('INVALID_STATE_TRANSITION');
}

export function shipmentTransition(
  current: Schema['ShipmentState'],
  next: Schema['ShipmentState'],
): Schema['ShipmentState'] {
  if (current === next) return current;
  if (
    (current === 'PENDING' && (next === 'IN_TRANSIT' || next === 'FAILED')) ||
    (current === 'IN_TRANSIT' && (next === 'DELIVERED' || next === 'FAILED'))
  )
    return next;
  throw new LifecycleConflict('INVALID_STATE_TRANSITION');
}
