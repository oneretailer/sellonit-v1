# Sellonit API Contract

Canonical OpenAPI 3.1 contract for the Sellonit MVP scope v1.0.3.

## Source of truth

`docs/openapi.yaml` is the API contract. Backend and frontend implementations must conform to it.

## Domain rules

1. `SupplierProduct` is the physical master product.
2. `RetailerProductListing` references `SupplierProduct`; it is not a duplicate master product.
3. Supplier inventory is the source of truth.
4. Customer `Order`, internal `Fulfillment`, and physical `Shipment` are separate resources.
5. One order may contain products from multiple suppliers.
6. Payment success is established by verified provider webhook, never frontend state.
7. Mutating operations that can be retried use `Idempotency-Key`.
8. Tenant-owned resources must be authorization scoped to the authenticated business/store.
9. Money is represented in minor units; NGN values therefore use kobo.
10. API errors use a stable machine-readable error code and request ID.

## MVP aggregation rules

- Early batch window: 2–3 days.
- Early volume trigger: 50 units for a supplier before the window closes.
- Demand is grouped by `SupplierProduct_ID`.
- A released batch creates a consolidated Bulk Supply Request.
- Supplier sends pre-labeled individual customer packages to an external 3PL cross-dock hub.
- External 3PL hands packages to the last-mile carrier; SELLONIT does not operate a warehouse.
- Failed shipments become `FAILED` and packages return to the supplier. No in-hub holding.

## Commercial completion — final financial gate

`PAYMENT → ESCROW → FULFILLMENT → SHIPMENT → SETTLEMENT → ORDER COMPLETED`

- Payment: `PENDING → CONFIRMED` (or `FAILED`), through a trusted provider webhook only.
- Confirmed payment reserves shared supplier inventory atomically and creates `HELD`
  escrow, `LOCKED` settlement records and `PENDING_BATCH` fulfillments.
- Fulfillment: `PENDING_BATCH → IN_BULK_REQUEST → AT_3PL_HUB → COMPLETED`.
- Shipment: `PENDING → IN_TRANSIT → DELIVERED` (or `FAILED`).
- Settlement: `LOCKED → PENDING` only after **all its shipments** are delivered;
  `PENDING → SETTLED` only through trusted financial reconciliation.
- Settled settlement releases its associated escrow. Each supplier fulfillment has
  its own settlement and escrow portion, not duplicate copies of the total payment.
- Order: `NEW → PAID → COMPLETED`. `COMPLETED` is a final commercial state and
  requires **all required settlements SETTLED and escrow RELEASED**. Empty or
  incomplete association sets cannot satisfy this gate.
- Shipment `DELIVERED`, fulfillment `COMPLETED`, and escrow `HELD` alone do **not**
  complete an order. A second supplier's `PENDING` settlement keeps it `PAID`.
- Pre-fulfillment cancellation must refund held escrow and undo stock reservations
  idempotently; it must not race batching or settlement.

Payment methods are `BANK_TRANSFER` and `USSD` (NGN). Provider integration remains
adapter-based. Native signed webhook payloads are verified before normalization;
retries must not duplicate inventory, escrow, settlements or external transfers.

Supplier, Enterprise, Retailer and Customer are the four MVP participant types.
Customer is an identity, not a business type; Enterprise extends supplier capabilities
with a public B2C store. Central discovery is directory-only. `/checkout` remains
single-store checkout, never a unified central cart.

## CI contract gate

Use the existing pinned dependencies and generation workflow:

```sh
npm ci
npm run validate:api
npm run generate:api
npm run check:api-types
```

Commit the contract and generated types together. Both the dedicated contract
workflow and main CI run read-only stale-artifact checks. Main CI includes this
check so deployment cannot pass via CI while the separate contract job fails.
No CI job commits generated files.

## Important implementation note

This contract intentionally defines the external API boundary. Internal Express module boundaries, Prisma models, queue payloads, and 3PL provider adapters may differ internally as long as the API contract remains stable.

The repository remains a skeleton with pure lifecycle guards, not an implemented
commerce API. See [the alignment audit](v1.0.3-alignment.md) for verified coverage
and the remaining persistence, authorization and provider integration work.
