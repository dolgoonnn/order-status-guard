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
pnpm sql                # regenerates db/order_status_guard.sql from the graph
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
src/domain/status-sql.ts the same graph rendered as a Postgres trigger
db/                      the generated trigger, and a script that checks it against Postgres
src/store.ts             in-memory database that counts queries
src/services/            one file per caller (customer, billing, carrier, admin)
src/app.ts               HTTP routes
tests/                   the tests that pass on the baseline
scripts/measure.ts       measures the three problems; writes docs/results/
```

## Three questions, three enforcers

"Can't an agent still write a query that sets the status?" Three different
questions hide in that one, and each has its own enforcer:

| Question | Enforcer |
|---|---|
| Is the value valid? | The type (in a Prisma app, the enum). Free, and only stops typos. |
| Is the move legal? | The graph, through one writer function, with a type, a scan test and a behaviour test behind it. What this repo is about. |
| Who may write it? | Only the database: `db/order_status_guard.sql`, generated from the graph, checked against Postgres in `docs/results/db-trigger.md`. |

Request bodies never choose a status either (`tests/body-status.test.ts`).
The decision record (`docs/decisions/0001-single-status-writer.md`) has the
reasoning.
