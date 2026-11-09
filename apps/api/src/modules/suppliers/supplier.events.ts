import { EventEmitter } from 'node:events';

export type SupplierEvent =
  | { type: 'supplier.submitted'; businessId: string; actorUserId: string }
  | { type: 'supplier.approved'; businessId: string; actorUserId: string }
  | { type: 'supplier.rejected'; businessId: string; actorUserId: string }
  | { type: 'supplier.suspended'; businessId: string; actorUserId: string }
  | { type: 'supplier.reinstated'; businessId: string; actorUserId: string };

const supplierEvents = new EventEmitter();

export function publishSupplierEvent(event: SupplierEvent): void {
  supplierEvents.emit(event.type, event);
}

export function onSupplierEvent(
  eventType: SupplierEvent['type'],
  listener: (event: SupplierEvent) => void,
): void {
  supplierEvents.on(eventType, listener);
}
