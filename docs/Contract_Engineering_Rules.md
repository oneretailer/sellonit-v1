# Sellonit Contract Engineering Rules

## Versioning
- Base path is `/v1`.
- Breaking API changes require a new API version. The v1.0.3 MVP alignment is an explicit pre-release correction of the unimplemented skeleton contract, retaining `/v1`; old lifecycle enum values, Entrepreneur and holdingUntil are removed. No deployed compatibility is implied.
- Additive optional response fields are normally non-breaking.
- Removing/renaming fields, changing meanings, or tightening validation is breaking.

## HTTP semantics
- `GET` is read-only.
- `POST` creates/actions.
- `PATCH` partially updates.
- `PUT` replaces a singleton resource such as a role-specific profile or pricing rule.
- `DELETE` removes/unpublishes an owned relationship when allowed.
- `204` contains no response body.

## Concurrency
Inventory changes must run inside a database transaction. Checkout must validate price and stock against authoritative database state. Idempotency keys prevent duplicate payment/order actions.

## Authorization
Authorization is based on the authenticated user plus business membership and resource ownership. A valid JWT alone is never sufficient to access arbitrary business resources.

## Payment
The browser may initiate payment but cannot mark an order paid. Provider webhook verification is authoritative.

## Fulfillment
Order creation does not mean supplier stock has physically arrived at the 3PL. Fulfillment and shipment states track the operational pipeline separately.


## Commercial lifecycle (MVP v1.0.3)
Order COMPLETED requires all associated settlements SETTLED and escrow RELEASED.
Payment confirmation, shipment delivery, fulfillment completion and held escrow
are not substitutes for settlement. Validate a complete authoritative relationship
set, not a paginated or tenant-filtered subset. Settlement eligibility requires
held escrow and every associated shipment delivered. Financial transitions must
run in database transactions with durable deduplication and an outbox; external
transfers require stable provider idempotency keys and reconciliation on retry.
State types come from OpenAPI, not a second hand-maintained domain enum system.
