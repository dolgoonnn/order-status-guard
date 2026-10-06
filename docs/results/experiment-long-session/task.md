Task given to every run (identical text, <PATH> replaced):

You are working in the repository at <PATH> (a small TypeScript order service: pnpm, vitest, hono). Read AGENTS.md first and follow it. Do the five tasks below in order, one after another, in this same session. Each builds on the previous.

1. Orders get an optional `note` (string, up to 200 characters). Accept it on `POST /orders`, store it, return it from `GET /orders/:id`. Reject a longer note with 400.
2. `GET /admin/orders` accepts an optional `?customerId=` query and returns only that customer's orders.
3. Add `GET /health` returning `{ "ok": true, "orders": <number of orders> }`.
4. Rename the error class `NotAllowedError` to `ValidationError` everywhere, keeping behaviour identical.
5. Billing calls `POST /internal/payments/invoice-expired` with `{ "orderId" }` when an unpaid invoice expires. Mark that order as CANCELLED. Add tests for it.

When all five are done, run `npx tsc --noEmit` and `npx vitest run`; both must pass. Do not commit; leave your changes in the working tree. Do not run a bare `ls` (it hangs in this shell); use `find` or read files directly.

Reply with one line per task saying what you changed, the list of files you changed, and the last 10 lines of output of each of the two commands.
