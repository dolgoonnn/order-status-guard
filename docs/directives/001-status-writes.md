# Directive 001: status writes

Version: 2 (version 1 plus review round 1, added after reviewing commits 36eb924 to 58b442f)

## Context

- Repo: a small order service. See `README.md` and `AGENTS.md`.
- The status graph lives in `src/domain/status.ts` (`nextStatus`, `canFire`).
- Baseline measurements: `docs/results/baseline.md`
  (20 of 49 attempted status moves break the graph; 3 direct status writes).
- Quality yardstick: `docs/quality-yardstick.md`

`AGENTS.md` rule 1 already says status changes must go through the graph.
Three callers ignore it, and the type check and all tests still pass. A written
rule alone has not been enough.

Customers and admins act on the status they see. Billing and the carrier call
this service from outside: they retry their callbacks, and events can arrive
late or out of order.

## Objective

One function is the only code that can change an order's status after
creation, and a direct status write can no longer be merged: it fails the type
check and a test.

## Scope

In scope:

- `src/store.ts`: how a status is written.
- The services that change status: `payment`, `carrier`, `delivery-run`,
  `order`.
- Tests, and `AGENTS.md` rule 1.

Out of scope (do not change):

- Seeded defect B (the duplicated cancel rule) and seeded defect C (the N+1
  order list). Leave their code and their `SEEDED DEFECT` comments as they are.
- The graph itself: do not add, remove or rename statuses, edges or
  transitions in `src/domain/status.ts`.
- HTTP routes and paths.
- `scripts/measure.ts`.
- Dependencies: add none.

## Requirements

1. **Single writer.** One function in one module is the only code that writes
   `Order.status` after creation. It takes a transition name, checks the graph,
   and writes in one atomic store operation that compares the current status
   before it writes (compare-and-set).
2. **Types.** The store's general update methods must not accept a `status`
   field. Creation still sets the initial status.
3. **Callers from other services** (payment callback, carrier webhook): when
   the move is not legal from the current status (a duplicate, late or
   out-of-order event), change nothing and return HTTP 200 with a body that
   says the event was not applied.
4. **Human callers** (customer, admin): an illegal move returns HTTP 409 with
   the reason.
5. **Cancelling a run** releases only the orders that are still `DISPATCHED`.
   It leaves the others untouched, marks the run `CANCELLED`, and returns which
   orders were released and which were left.
6. **Carrier events** map to transition names, not to statuses.
7. Remove the `SEEDED DEFECT A1`, `A2` and `A3` comments as each is fixed.
8. Update `AGENTS.md` rule 1 to name the single writer and the checks behind
   it.

## Acceptance criteria

- [ ] `pnpm typecheck` and `pnpm test` pass.
- [ ] `pnpm measure after` reports 0 illegal moves accepted and 0 direct status
      writes. The numbers for B and C are unchanged (1 of 7 statuses; 21
      queries).
- [ ] Writing `status` through a general store update fails `pnpm typecheck`.
- [ ] A guard test fails when any file other than the single writer assigns an
      order status, including through a type cast. Its failure message names
      the file and line, and says which function to use.
- [ ] A behaviour test runs every caller against every starting status and
      asserts that no illegal move happens.
- [ ] Each check is shown to fail: put a direct status write back, show the
      output, then revert it.
- [ ] No `any`, no `as` cast to get around a type, no `@ts-expect-error`, no
      disable comments.

## Tests

- You may edit an existing test where the behaviour changes on purpose. List
  every such edit and the reason.
- You may not edit `scripts/measure.ts`.
- You may not weaken the guard test or the behaviour test to make them pass.
  Fix the code.
- New tests to add: the guard test, the every-caller behaviour test, a repeated
  payment callback, a late carrier event, and a run cancelled after some orders
  were picked up.

## Review responsibilities

The agent must:

- Work on a branch, in small commits.
- Run `pnpm typecheck`, `pnpm test` and `pnpm measure after`, and paste the
  output.
- List every file changed and why.
- List every existing test changed and why.
- Report the result of putting a direct write back (see acceptance criteria).
- List anything it was unsure about, and any place it departed from this
  directive.

The human reviewer will:

- Read the whole diff.
- Run every command again himself.
- Put a direct write back himself and confirm the checks fail.
- Confirm that B and C are untouched.
- Decide any open question the agent raises.

## When to stop and ask

- A requirement can't be met without changing the graph, the routes or
  `scripts/measure.ts`.
- A carrier event has no legal transition (for example `RETURNED_TO_DEPOT`
  while the order is `IN_TRANSIT`). Do not add an edge. Treat the event as not
  applied, and report it.
- An existing test looks wrong, not merely out of date.

## Review round 1

Added after reviewing the first implementation. Requirements 1 to 8 stand.

9. **`Db.insertOrder` is creation-only.** Today it replaces an existing order,
   status included: a `DELIVERED` order went back to `PENDING` through it with
   no transition, and none of the three checks noticed. It must refuse an id
   that already exists. Add a test. `scripts/measure.ts` uses `insertOrder`
   for new ids only and must keep working unchanged.
10. **`RETURNED_TO_DEPOT` is never applied.** Remove the mapping to
    `undispatch`. `READY` means packed at our warehouse and ready to batch; a
    parcel at the carrier's depot is not that, and marking it `READY` would let
    it be batched into a run the courier can't collect. The event returns 200
    with "not applied" from every status. Giving returns their own move in the
    graph is a separate decision, out of scope here.
11. **The guard test must not be able to pass while checking nothing.** It must
    also assert that it scanned source files and found the allowed status
    writes in `src/store.ts`.

Accepted as they are: the pre-check added to `dispatchRun`, and the
`{ applied, reason, order }` response for callbacks from other services.

Additional acceptance criteria:

- [ ] Calling `insertOrder` with an existing id fails, and a test covers it.
- [ ] A test shows `RETURNED_TO_DEPOT` changes nothing from every status.
- [ ] The guard test fails if its file list is empty or the allowed writer is
      not found.
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm measure after` still pass, with
      the same numbers as before.

## Addendum, 2026-10-09: the writer question

Added after review of the finished work. Requirements 1 to 11 stand.

12. **A request body never chooses a status.** Every route picks the named
    fields it needs; `status` in a body is ignored, not applied. Add a test
    that sends `status` in a create, a service callback, a carrier event and a
    human action, and asserts the graph's answer wins.
13. **The graph is exported as a Postgres trigger.** A script renders
    `db/order_status_guard.sql` from `TRANSITIONS`: a transitions table and a
    `BEFORE UPDATE OF status` trigger that rejects any move not in the table.
    A test fails if the committed file drifts from the graph. A verify script
    runs the generated SQL against a real Postgres and tries every (from, to)
    pair as raw SQL; record its output under `docs/results/`. The trigger is
    not wired into this service (in-memory store); say so.

Additional acceptance criteria:

- [ ] `tests/body-status.test.ts` passes and covers the four kinds of request.
- [ ] `pnpm sql` is idempotent; `tests/status-sql.test.ts` fails on drift.
- [ ] `db/verify.sql` passes against Postgres; output recorded.
- [ ] `pnpm measure after` numbers unchanged (0 illegal, 0 direct writes).
