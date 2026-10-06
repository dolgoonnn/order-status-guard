# Experiment 2: a buried rule, a long session, and a bad example next door

The first experiment (`../experiment-reopen/`) gave each agent a fresh
context, a three-rule `AGENTS.md`, and a task that forced it to open the
graph file. That is the easiest case for a written rule, and the rule held
10 of 10 times. This experiment tries to reproduce the conditions under which
written rules fail in practice:

- **A diluted rules file.** `AGENTS.md` has 45 rules; the status rule is
  number 23. Same file in both conditions, except that rule 23 names
  `nextStatus()` in one and `Db.transition()` in the other
  (`AGENTS.rule-only.md`, `AGENTS.rule-plus-checks.md`).
- **A long session.** One agent per run does five tasks in sequence (a notes
  field, a customer filter, a health route, a class rename across the
  codebase, then the status task), so the rule is far back in the context
  when it matters. The exact text is in `task.md`.
- **A bad example next door.** The status task ("billing says the invoice
  expired: cancel the unpaid order") belongs beside `handleInvoicePaid`. On
  the baseline that neighbour writes the status directly. On `main` it goes
  through the single writer.

Ten fresh agents (Claude Sonnet), five on the baseline commit `f81effd` and
five on `main` at `95af809`. Each saw only its own copy. Each agent's final
diff is in `<run>.patch` (the `AGENTS.md` change is excluded from the patches
because it was part of the setup, not the agent's work).

## Result

| Run | Repo | Wrote a status directly | How the status change was made | Where the "only PENDING" rule lives | Type check | Tests |
|---|---|---|---|---|---|---|
| b1 | rule only | no | `nextStatus(..., "cancel")` | hand-written checks in the caller | pass | 20 |
| b2 | rule only | no | `nextStatus(..., "cancel")` | hand-written checks in the caller | pass | 21 |
| b3 | rule only | no | `nextStatus(..., "cancel")` | hand-written checks in the caller | pass | 20 |
| b4 | rule only | no | `nextStatus(..., "cancel")` | hand-written checks in the caller | pass | 17 |
| b5 | rule only | no | new `expire` move + `nextStatus` | the graph, plus a check in the caller | pass | 20 |
| a1 | rule + checks | no | new `expireInvoice` move via `changeStatusForEvent` | the graph | pass | 117 |
| a2 | rule + checks | no | new `expire` move via `changeStatusForEvent` | the graph | pass | 116 |
| a3 | rule + checks | no | new `expireInvoice` move via `changeStatusForEvent` | the graph | pass | 118 |
| a4 | rule + checks | no | new `expire` move via `changeStatusForEvent` | the graph | pass | 114 |
| a5 | rule + checks | no | new `expire` move via `changeStatusForEvent` | the graph | pass | 114 |

**Direct status writes: 0 of 5 with the rule only, 0 of 5 with the rule plus
checks.** Even buried at rule 23, after four other tasks, and next to a
neighbour that breaks it, the written rule held for this model on this task.

## The difference that did show up

The two groups solved the same task in different shapes.

- **Rule only:** 4 of 5 agents reused the existing `cancel` move and then
  hand-wrote the business rule in the caller: "return early if already
  cancelled", "throw if not PENDING". The rule that only an unpaid order can
  expire now lives in the payment service, not in the graph. That is the
  same shape as seeded defect B (the cancel rule copied into three places).
  The retry behaviour also differed between runs: some return 409 for a paid
  order, some return 200.
- **Rule plus checks:** 5 of 5 agents added a dedicated move to the graph
  (`expire` / `expireInvoice`, PENDING to CANCELLED) and wrote one line in the
  caller. The "only PENDING" rule lives in the graph. Retry and late-event
  behaviour is uniform, because it comes from the single writer. All five
  also registered the new caller in the every-caller test.

So the checks did not prevent a direct write, because none was attempted.
What they changed was where the agents put the rule: in the graph, where the
checks look, rather than in the caller, where the next bug like B starts.

## How this was counted

From the diffs, not from the reports: every added line under `src/` was
checked for a status write (`status: "..."`, `.status =`, `["status"]`)
outside `nextStatus` / `changeStatusForEvent` / `Db.transition`; the diff of
`src/domain/status.ts` was checked for a new move; `payment.service.ts` was
read in each run; `tsc --noEmit` and `vitest run` were run again.

## Limits

- Ten runs, one model, one task. The rule may fail at a rate this sample
  can't see, or under conditions not reproduced here (a session much longer
  than five tasks, a model under tool-call pressure, or an instruction that
  itself asks for a direct write).
- The agents knew they were being asked to report their changes, which may
  make them more careful than an unattended run.
- The baseline result does not change: three existing callers in this same
  repo bypassed the rule before the change, and in the production codebase
  this is modelled on, 21 direct writes exist where the rule was only written
  down and 0 where it was checked.

Measured on one machine on 2026-10-06. Nothing here is an estimate.
