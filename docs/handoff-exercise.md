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

- `pnpm typecheck` and `pnpm test` pass.
- `pnpm measure after` reports 0 illegal moves accepted. The number of attempts
  rises from 49 to 56 (one more starting status).
- You changed `src/domain/status.ts`, `src/services/carrier.service.ts` and
  tests. You did not change `src/store.ts`, the guard test or
  `scripts/measure.ts`.

## Where to look, in order

1. `AGENTS.md`: rule 1 names the only function that writes a status.
2. `src/domain/status.ts`: statuses, edges and named transitions.
3. `src/services/carrier.service.ts`: how a carrier event becomes a transition,
   and the comment explaining why `RETURNED_TO_DEPOT` is currently never
   applied.
4. `tests/status-callbacks.test.ts`: the pattern for a callback test.
5. `docs/decisions/0001-single-status-writer.md`: why it is built this way.

## What we expect to learn from your run

- How many files you had to touch (expected: three, plus tests).
- Whether any check got in your way for the wrong reason.
- Anything in the docs that was missing or wrong. Say so in your report.

## Record of runs

| Date | Who | Time taken | Files touched | Checks passed | Notes |
|---|---|---|---|---|---|
| | | | | | |
