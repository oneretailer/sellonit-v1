# API contract review — `docs/openapi.yaml`

Historical findings from bootstrapping. The v1.0.3 alignment now supersedes
items 3 (payment payload/signature contract only), 4 (grouping and no holding),
10 (typed status filters) and 14 (documented domain error codes). Runtime
implementation remains absent. See [the current audit](v1.0.3-alignment.md).
The remaining findings below are retained as a historical backlog, not a claim
that the corrected contract still supports holding or the old payment header.

## Changes already applied (approved)

| Commit                                                           | Change                                                                                                                               | Why                                                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `docs(contract): make OpenAPI 3.1-valid and rebrand to Sellonit` | 26 × `nullable: true` → `type: [<type>, 'null']`                                                                                     | `nullable` is not an OpenAPI 3.1 keyword; `redocly lint` failed with 26 errors. Generated TypeScript is byte-identical |
| same                                                             | Title, description, health example and server URLs → Sellonit (`https://api.sellonit.app/v1`, `https://staging-api.sellonit.app/v1`) | Product rename                                                                                                         |

Under the Versioning rules in `docs/Contract_Engineering_Rules.md`, the
`nullable` conversion is **non-breaking**: no field was removed, renamed or
tightened, and the generated types are unchanged.

`redocly lint` now reports **0 errors, 179 warnings** — breakdown in item 17.

## Historical findings (see superseded items above)

### Security and access

1. **Guest checkout vs. protected reads.** `POST /checkout` and
   `POST /payments/initialize` are public (guest checkout), but
   `GET /orders/{orderId}` and `GET /payments/{paymentId}` require a bearer
   token. A guest cannot see the order or payment they just created. Decide on a
   guest access mechanism (e.g. order access token, signed link) or require login.
   (Rules: authorization is by user + membership + ownership; a guest has none.)
2. **Public cart ownership.** `PATCH /carts/{cartId}` is public and accepts a
   `customerId`; anyone holding a cart ID can attach it to any customer. Needs
   a cart secret/token or server-side customer resolution. (Contract README domain
   rule 8: tenant-owned resources must be authorization scoped.)
3. **Webhook contracts don't match real providers.**
   - `X-Payment-Signature` is not the header any real provider sends (Paystack uses
     `x-paystack-signature`, Flutterwave `verif-hash`); request bodies are also
     provider-specific.
   - `ThreePLWebhookEvent` requires _our_ `shipmentId`; 3PLs send their own tracking reference.
   - No signature scheme is specified (e.g. Paystack signs the raw body with
     HMAC-SHA512). Recommendation: per-provider webhook paths and provider
     references in the contract.

### Domain model

4. **Demand aggregation grouping.** The contract README's MVP rules give a
   2–3 day window, a 50-unit early trigger "for a supplier", grouping "by
   supplier/product", and an `IN_HUB_HOLDING` "defined holding period".
   The contract models the window and trigger (`DemandBatch.closesAt`,
   `thresholdUnits`) and the holding state (`Shipment.holdingUntil`). Open:
   - `DemandBatch` has `supplierBusinessId` but no product, so it cannot
     represent supplier/product grouping.
   - The README itself is ambiguous: is the 50-unit trigger counted per
     supplier or per supplier/product group?
   - "2–3 days" is a range: fixed value, per-supplier setting, or configuration?
   - The holding period's length is not defined anywhere.
5. **`Hub` resource missing.** `hubId` / `destinationHubId` are referenced but no
   `Hub` schema or endpoints exist.
6. **Identifier naming.** `supplierId` and `supplierBusinessId` are used for what
   appears to be the same concept.
7. **`UserRole` mixes concerns.** It combines business-membership roles
   (owner/admin/staff) with business types (supplier/retailer).
8. **`ApiResponsePublicStore` exposes the internal `Store` schema** on the public
   storefront endpoint (risk of leaking internal fields later).
9. **`POST /demand-batches/{batchId}`** performs an action on the resource path;
   an explicit action sub-resource (e.g. `/demand-batches/{id}/confirm`) would be clearer.

### Validation and behaviour gaps

10. Generic `status` query parameters have no enum.
11. `GET /supplier-products` scopes to the "current business" — ambiguous for
    users belonging to several businesses (no `businessId` parameter or header).
12. `Address.city` / `Address.state` have no `minLength` (empty strings valid).
13. Undefined behaviour: `FLEXIBLE` pricing rules, negative retailer margin,
    delivery-fee calculation.
14. Error `code` values are free-form strings; the allowed set should be
    documented in the contract.
15. Paginated responses don't mark `data` / `meta` as `required`, so generated
    types make them optional.

### Hygiene

16. `/me` is tagged _Auth_ but is a user-profile resource.
17. 179 `redocly lint` warnings (recommended ruleset):

    | Rule                     | Count | Note                                                                                |
    | ------------------------ | ----- | ----------------------------------------------------------------------------------- |
    | `operation-operationId`  | 82    | No operation has an `operationId`; adding them improves generated client/type names |
    | `operation-4xx-response` | 71    | Operations without any documented 4xx response                                      |
    | `tag-description`        | 21    |                                                                                     |
    | `no-unused-components`   | 2     |                                                                                     |
    | `info-license`           | 1     |                                                                                     |
    | `no-server-example.com`  | 1     | The local-development server entry points to localhost (intentional)                |
    | `operation-2xx-response` | 1     | `POST /orders/{orderId}` documents only `405` (intentional per contract)            |
