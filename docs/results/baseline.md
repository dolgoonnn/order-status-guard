# Measurements: baseline

Measured on the synthetic in-memory service, one machine. No production data.

## A. Status moves that break the graph

- Attempts: 49 (7 writers × 7 starting statuses)
- **Illegal moves accepted: 20**
- Direct status writes found in `src/services`: 3

| Writer | From | To | HTTP |
|---|---|---|---|
| billing: invoice paid | READY | PAID | 200 |
| billing: invoice paid | DISPATCHED | PAID | 200 |
| billing: invoice paid | IN_TRANSIT | PAID | 200 |
| billing: invoice paid | DELIVERED | PAID | 200 |
| billing: invoice paid | CANCELLED | PAID | 200 |
| carrier: PICKED_UP | PENDING | IN_TRANSIT | 200 |
| carrier: PICKED_UP | PAID | IN_TRANSIT | 200 |
| carrier: PICKED_UP | READY | IN_TRANSIT | 200 |
| carrier: PICKED_UP | DELIVERED | IN_TRANSIT | 200 |
| carrier: DELIVERED | PENDING | DELIVERED | 200 |
| carrier: DELIVERED | PAID | DELIVERED | 200 |
| carrier: DELIVERED | READY | DELIVERED | 200 |
| carrier: DELIVERED | DISPATCHED | DELIVERED | 200 |
| carrier: RETURNED_TO_DEPOT | PENDING | READY | 200 |
| carrier: RETURNED_TO_DEPOT | IN_TRANSIT | READY | 200 |
| carrier: RETURNED_TO_DEPOT | DELIVERED | READY | 200 |
| admin: cancel run | PENDING | READY | 200 |
| admin: cancel run | IN_TRANSIT | READY | 200 |
| admin: cancel run | DELIVERED | READY | 200 |
| admin: cancel run | CANCELLED | READY | 200 |

| File | Line | Code |
|---|---|---|
| carrier.service.ts | 43 | `db.updateOrder(order.id, { status });` |
| delivery-run.service.ts | 37 | `db.updateOrders(run.orderIds, { status: "READY", runId: null });` |
| payment.service.ts | 13 | `db.updateOrder(order.id, { status: "PAID" });` |

## B. Cancel rule copies

- **Statuses where the copies disagree: 1 of 7**

| Status | Graph allows | Storefront shows button | Customer cancel works | Admin cancel works |
|---|---|---|---|---|
| PENDING | yes | yes | yes | yes |
| PAID | yes | no | yes | yes |
| READY | yes | no | no | yes |
| DISPATCHED | no | no | no | no |
| IN_TRANSIT | no | no | no | no |
| DELIVERED | no | no | no | no |
| CANCELLED | no | no | no | no |

## C. Queries for the admin order list

- **Queries to list 20 orders: 21**
