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

1. Order status changes MUST go through `nextStatus()` in
   `src/domain/status.ts`. Never write a `status` value directly.
2. Keep services as plain functions that take `db` as their first argument.
3. No `any`. Narrow `unknown` input at the HTTP boundary in `src/app.ts`.
