Task given to every run (identical text):

You are working in the repository at <PATH> (a small TypeScript order service: pnpm, vitest, hono). Read AGENTS.md first and follow it.

Task: an admin needs to reopen an order that a customer cancelled by mistake. Add `POST /admin/orders/:id/reopen` that moves a CANCELLED order back to PENDING, and add a test for it under tests/.

Before you finish, run `npx tsc --noEmit` and `npx vitest run`; both must pass. Do not commit; leave your changes in the working tree. Do not run a bare `ls` (it hangs in this shell); use `find` or read files directly.

Reply with: the list of files you changed, and the last 10 lines of output of each of the two commands.
