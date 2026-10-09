# Handoff exercise: add a RETURNED status

For an engineer who has never seen this repo. Time box: 30 minutes. You may use
an AI coding agent; `AGENTS.md` is written for it.

## The task

The business has decided that a parcel the carrier brings back is a return. Add
a terminal `RETURNED` status.

- The carrier's `RETURNED_TO_DEPOT` event moves an order from `IN_TRANSIT` to
  `RETURNED`. From any other status it stays "not applied".
- A returned order cannot be cancelled, dispatched or delivered afterwards.
- Add tests for the new move and for the statuses it is not allowed from.

## What "done" looks like

- `pnpm typecheck` and `pnpm test` pass. (`pnpm` is the canonical runner. If
  you don't have it, `npx tsc --noEmit`, `npx vitest run` and
  `npx tsx scripts/measure.ts after` run the same things.)
- `pnpm measure after` reports 0 illegal moves accepted. The number of attempts
  rises from 49 to 56 (one more starting status). It will also report the
  cancel-rule copies disagreeing on "1 of 8" statuses instead of "1 of 7";
  that is the seeded defect B, not your change.
- You changed `src/domain/status.ts` and `src/services/carrier.service.ts`,
  and you updated two tests that currently pin the old behaviour:
  `tests/every-caller.test.ts` (the carrier caller is registered with
  `transition: null` and asserts "changes nothing" from every status) and
  `tests/status-callbacks.test.ts`. Add new tests for the terminal state.
- You did not change `src/store.ts`, `tests/status-writes.guard.test.ts` or
  `scripts/measure.ts`. Adding a status and a move is the whole job; the
  single writer needs no change.
- `pnpm measure after` rewrites the tracked file `docs/results/after.md`.
  Commit the new numbers with your change.
- Run `pnpm sql` and commit `db/order_status_guard.sql`; the graph is exported
  as a Postgres trigger and `tests/status-sql.test.ts` fails until the file
  matches. (Added 2026-10-09, after run 1, which did not have this step.)
- Update `docs/decisions/0001-single-status-writer.md`: it currently says the
  "returned to depot" event is never applied and that the graph has seven
  states. Both change with this task.

## Status codes you will meet

- An illegal move by a human caller returns 409 (`IllegalTransitionError`).
- The cancel routes check their own eligibility list first and return 400
  (`NotAllowedError`) before reaching the graph. That is the seeded defect B.
  Your tests for "a RETURNED order cannot be cancelled" will see 400 from the
  cancel routes, not 409.

## Where to look, in order

1. `AGENTS.md`: rule 1 names the only function that writes a status.
2. `src/domain/status.ts`: statuses, edges and named transitions. This is
   where the new status and the new move go.
3. `src/services/carrier.service.ts`: how a carrier event becomes a transition,
   and the comment explaining why `RETURNED_TO_DEPOT` is currently never
   applied.
4. `tests/status-callbacks.test.ts`: the pattern for a callback test.
5. `docs/decisions/0001-single-status-writer.md`: why it is built this way.

## What we expect to learn from your run

- How many files you had to touch (expected: four, plus new tests, plus the
  regenerated `db/order_status_guard.sql`).
- Whether any check got in your way for the wrong reason.
- Anything in the docs that was missing or wrong. Say so in your report.

## Record of runs

| Date | Who | Time taken | Files touched | Checks passed | Notes |
|---|---|---|---|---|---|
| 2026-10-06 | A fresh AI agent (Claude Sonnet) with no context beyond this repo, as a stand-in for another engineer | about 2 min of commands; reading and editing not timed | `status.ts`, `carrier.service.ts`, `every-caller.test.ts`, `status-callbacks.test.ts` (+ `after.md` regenerated) | typecheck, 111 tests, measure: 56 attempts, 0 illegal, 0 direct writes | Diff: `docs/results/handoff-run-1.patch`. Not merged: the decision to add returns is the business's to make. |

### What run 1 found wrong in this document, and what changed

The first version of this exercise had seven gaps. All are fixed above.

1. It named `pnpm` but the run notes used `npx`. Now both are stated, with
   `pnpm` as canonical.
2. It didn't say that `tests/every-caller.test.ts` pins the old behaviour and
   must be edited. Now it does.
3. It didn't say `measure after` rewrites a tracked file. Now it does.
4. It didn't say the decision record goes stale. Now it does.
5. It didn't explain the "1 of 8" change in the cancel-rule line. Now it does.
6. It didn't say the cancel routes answer 400, not 409. Now it does.
7. It didn't say that `src/store.ts` needs no change. Now it does.

The one check that "got in the way" (`every-caller.test.ts` going red) was
doing its job: it pinned the old behaviour, and the task changes that
behaviour on purpose.
