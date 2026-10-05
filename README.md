# order-status-guard

A tiny, synthetic order service that demonstrates one idea: a written rule for
AI coding agents ("never write a status directly") is not enough on its own. It
needs an automatic check behind it.

The service has one user-facing flow: an order is placed, paid, batched into a
courier run, and delivered.

Everything here is synthetic. There is no real customer data and no code from
any employer.

## Run it

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm measure baseline   # writes docs/results/baseline.md
pnpm dev                # http://localhost:3000
```

## Seeded defects

The baseline deliberately contains three quality problems. Each one is marked
in the code with a `SEEDED DEFECT` comment.

| Id | Problem | Where |
|---|---|---|
| A1 | Cancelling a courier run writes `READY` to every order in it, including delivered ones | `src/services/delivery-run.service.ts` |
| A2 | The payment callback writes `PAID` whatever the order's current status | `src/services/payment.service.ts` |
| A3 | The carrier webhook writes the mapped status with no check | `src/services/carrier.service.ts` |
| B | The "can this order be cancelled?" rule exists in three copies that disagree | `order.service.ts`, `order-query.service.ts` |
| C | The admin order list runs one extra query per order | `src/services/order-query.service.ts` |

The written rule against A already exists in `AGENTS.md` (rule 1). The baseline
shows what a written rule alone is worth.

## Layout

```
src/domain/status.ts     the status graph: the only place that knows legal moves
src/store.ts             in-memory database that counts queries
src/services/            one file per caller (customer, billing, carrier, admin)
src/app.ts               HTTP routes
tests/                   the tests that pass on the baseline
scripts/measure.ts       measures the three problems; writes docs/results/
```
