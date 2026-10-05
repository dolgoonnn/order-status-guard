# Agent instructions

A small order service: customers place orders, billing confirms payment, the
warehouse batches orders into courier runs, and the carrier reports delivery.

## Commands

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
pnpm dev         # http://localhost:3000
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
2. Keep services as plain functions that take `db` as their first argument.
3. No `any`. Narrow `unknown` input at the HTTP boundary in `src/app.ts`.
