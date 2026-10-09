# Agent instructions

A small order service: customers place orders, billing confirms payment, the
warehouse batches orders into courier runs, and the carrier reports delivery.

## Commands

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
pnpm dev         # http://localhost:3000
pnpm sql         # regenerates db/order_status_guard.sql from the graph
```

## Rules

1. Order status changes MUST go through `Db.transition(id, name)` in
   `src/store.ts`, the only function that writes `Order.status` after
   creation. Services call it through `changeStatusForHuman` or
   `changeStatusForEvent` in `src/services/status-change.ts`. It checks the
   graph in `src/domain/status.ts` and compares-and-sets in one operation.
   Never write a `status` value any other way. Three checks enforce this:
   `pnpm typecheck` (store update methods reject `status`),
   `tests/status-writes.guard.test.ts` (no other file under `src/` writes a
   status) and `tests/every-caller.test.ts` (no caller makes an illegal move).
   The same graph is exported as a Postgres trigger in
   `db/order_status_guard.sql`. After editing `TRANSITIONS`, run `pnpm sql`
   and commit the file; `tests/status-sql.test.ts` fails on drift.
2. Keep services as plain functions that take `db` as their first argument.
3. No `any`. Narrow `unknown` input at the HTTP boundary in `src/app.ts`.
4. A request body never chooses a status. Routes pick the named fields they
   need; the graph decides the status. `tests/body-status.test.ts` pins this.
