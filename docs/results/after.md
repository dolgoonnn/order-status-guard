# Measurements: after

Measured on the synthetic in-memory service, one machine. No production data.

## A. Status moves that break the graph

- Attempts: 49 (7 writers × 7 starting statuses)
- **Illegal moves accepted: 0**
- Direct status writes found in `src/services`: 0

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
