# 0001: One function writes an order's status, with three checks behind it

- Status: accepted, 2026-10-06; amended 2026-10-09 (the database layer and request bodies)
- Deciders: Dolgoon Amartaivan (decisions), with Claude Code (drafting, implementation, verification runs)

In the context of an order service where four kinds of caller change an order's
status, facing a written rule that callers kept ignoring while every check
stayed green, we decided for a single writer function enforced by types, a
source-scan test and an every-caller behaviour test, to make an illegal status
move impossible to merge, accepting that one text-level check can be fooled by
unusual code and that the repo now has one more test to keep.

## Context and problem statement

An order's status is read by customers, admins and vendors, and written by
customers, admins, the billing service, the carrier and system jobs. The repo
had a status graph (`src/domain/status.ts`) and a rule in `AGENTS.md`: "status
changes MUST go through `nextStatus()`". Three callers wrote the status directly
anyway. The type check passed, all tests passed, and 20 of 49 attempted status
moves broke the graph (`docs/results/baseline.md`). A delivered order could go
back to READY, and a cancelled order could come back to life.

The same pattern exists in a production codebase I run: where the rule was only
written down, direct writes kept appearing, several of them in AI-co-authored
commits made after the rule existed; in the one folder with an automatic check,
there were none.

## Decision drivers

- User impact: an order must never show a status it didn't reach legally.
- Maintenance effort: adding a status or a caller should touch the graph and
  the caller, nothing else.
- Operating cost: billing and the carrier retry and deliver late; a repeat must
  not cause more retries or manual repairs.
- AI coding agents copy the patterns they see, so the check has to catch the
  write, not rely on the agent reading the rule.
- A small repo: no new dependencies, checks that run in seconds.

## Considered options

- **A. Keep the written rule only** (the status quo).
- **B. One writer function, enforced by types, a source-scan test and a
  behaviour test** (chosen).
- **C. A custom ESLint rule** (`no-restricted-syntax`) instead of the scan test.
- **D. Enforce in the database:** a conditional `UPDATE ... WHERE status = ?`,
  or a trigger that rejects moves not in the graph.
- **E. A state-machine library** that owns the entity and its transitions.

## Decision outcome

Option B.

- `Db.transition(id, name)` is the only code that changes a status after
  creation. It checks the graph and writes in one compare-and-set step.
- The store's general update methods cannot accept `status` (the type is
  `never`), so a direct write fails `pnpm typecheck`.
- A guard test parses every file under `src/` and fails on any status write
  outside the writer, including one hidden behind a cast. Its message tells
  the agent which function to use.
- A behaviour test runs every caller against every starting status and asserts
  no illegal move.
- Callbacks from other services that aren't legal return 200 and change
  nothing; human actions that aren't legal return 409.
- `insertOrder` is creation-only, so it cannot rewrite a status either.
- The carrier's "returned to depot" event is never applied. READY means packed
  at our warehouse; a parcel at the carrier's depot is not that. Returns need
  their own move in the graph, which is a separate decision.

### Three questions, three enforcers (amendment, 2026-10-09)

Reviewing the fix raised the question "can't an agent still write a query
that sets the status?" The answer splits into three questions, and each has
a different enforcer:

| Question | Enforcer | What it lets through |
|---|---|---|
| Is the value valid? (`"PAIDD"`) | The `OrderStatus` type; in a Prisma app, the enum. Free. | Every legal value from every status |
| Is the move legal? (DELIVERED → PENDING) | The graph, through the single writer: checks 1 to 3 above | Anything that doesn't go through TypeScript |
| Who may write it? (raw SQL, another service, psql) | Only the database | A superuser |

The first row is why types alone are not enough: `update({ data: { status:
body.status } })` compiles when the value is a valid enum member, and that is
the shape of a production bug I have seen (OWASP API3:2023, mass assignment:
a client sends `status`, the API spreads the body into the update). Two
additions:

- **Request bodies never choose a status.** Routes pick the fields they need
  (`customerId`, `items`, `orderId`, `event`); the graph decides the status.
  `tests/body-status.test.ts` sends `status` in every kind of request and
  asserts it is ignored.
- **The graph is exported as a Postgres trigger.** `pnpm sql` renders
  `db/order_status_guard.sql` from `TRANSITIONS`: a transitions table and a
  `BEFORE UPDATE OF status` trigger that raises `check_violation` on any move
  not in the table (and on an unknown value). `tests/status-sql.test.ts`
  fails if the committed file drifts from the graph. `db/verify.sql` was run
  against PostgreSQL 14: 49 raw-SQL attempts, 16 allowed (9 edges + 7
  same-status rewrites), 33 rejected (`docs/results/db-trigger.md`). It is
  not wired into this service, which has no database; in a real deployment it
  is the layer that holds for every writer. Stronger still: give the app role
  no `UPDATE` on the column and make one `SECURITY DEFINER` function the only
  writer, so raw SQL gets "permission denied".

### Consequences

Good:
- 0 of 49 attempted moves break the graph (`docs/results/after.md`), with the
  seeded defects for the cancel rule and the order list untouched.
- A new status means editing `src/domain/status.ts` and the caller that uses
  it. No check needs to change.
- An agent that writes a status directly gets a type error as it types, and a
  test failure that names the file, the line and the fix.

Bad:
- The scan test is a text-level check. A status key built at runtime would get
  past it; the types and the behaviour test are the backstop, and the database
  trigger is the backstop for everything outside this repo.
- The graph now exists twice, in TypeScript and in SQL. `pnpm sql` must be run
  after a graph change; the drift test fails until it is. The trigger is
  checked against Postgres by hand (`db/verify.sql`), not in `pnpm test`.
- Stale events from other services are dropped with a 200. The response says
  "not applied", but nothing alerts on it.
- One more test file to maintain, and a guard test that must itself be checked
  for passing vacuously (it asserts that it scanned files and found the writer).

### Confirmation

- `pnpm typecheck`, `pnpm test`, `pnpm measure after`.
- Each check was shown to fail by putting a direct write back: the types
  (`TS2322`), the guard test (named the file and line), the behaviour test
  (8 failures), and the creation-only `insertOrder` (1 failure).
- Review checklist: `docs/review-checklist.md`.
- The database layer: `db/verify.sql` against PostgreSQL 14, output in
  `docs/results/db-trigger.md`.

## Pros and cons of the options

### A. Written rule only

- Good: no code.
- Bad: measured not to work here, 20 illegal moves accepted with every check
  green. Agents follow the surrounding code more than the rule.

### B. Single writer + types + scan test + behaviour test (chosen)

- Good: the fastest feedback (a type error), a second layer for casts, a third
  layer for behaviour. No new dependency. Each layer can be shown to fail.
- Bad: three places to understand instead of one. The scan test is not a type
  checker.

### C. Custom ESLint rule

- Good: feedback in the editor; the standard tool for this kind of ban.
- Bad: adds a dependency and configuration to a tiny repo; an agent can add a
  disable comment, which then needs its own ban. Same coverage as the scan
  test. Worth revisiting if the repo adopts ESLint for other reasons.

### D. Enforce in the database (adopted as a complement, 2026-10-09)

- Good: the strongest guarantee; holds for every writer, including scripts and
  other services that reach the database.
- Bad: the graph would live in two places (code and schema). Resolved by
  generating the SQL from the graph and failing a test on drift. This service
  has an in-memory store, so the trigger is verified by hand and not wired in;
  in a real deployment it complements B, it does not replace it, because B is
  what gives the agent a type error as it types.

### E. A state-machine library

- Good: transitions, guards and events in one well-known model.
- Bad: a dependency and a new vocabulary for a graph of seven states; it
  doesn't by itself stop a direct write to the store, so B's checks would still
  be needed.

## More information

- Directive: `docs/directives/001-status-writes.md` (version 2 records the
  review round that led to `insertOrder` and "returned to depot").
- Measurements: `docs/results/baseline.md`, `docs/results/after.md`.
- The ADR format follows MADR.
