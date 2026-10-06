# Experiment: does the written rule hold without the checks?

Ten fresh AI coding agents (Claude Sonnet, via Claude Code's Agent tool) were
given the same task in ten separate copies of the repo. Five copies were at
the baseline commit (`f81effd`: the written rule in `AGENTS.md`, no checks).
Five were at `main` after the change (`523db3b`: the rule plus the single
writer, the types, the guard test and the every-caller test). Each agent saw
only its own copy and nothing else. The exact task text is in `task.md`; each
agent's final diff is in `<run>.patch`.

The task ("reopen a cancelled order") needs a status move the graph does not
have, so the agent must either add a move to the graph or write the status
directly.

## Result

| Run | Repo | Added the move to the graph | Wrote a status directly | Went through the writer | Type check | Tests |
|---|---|---|---|---|---|---|
| b1 | rule only | yes | no | `nextStatus` | pass | 8 / 8 |
| b2 | rule only | yes | no | `nextStatus` | pass | 8 / 8 |
| b3 | rule only | yes | no | `nextStatus` | pass | 8 / 8 |
| b4 | rule only | yes | no | `nextStatus` | pass | 8 / 8 |
| b5 | rule only | yes | no | `nextStatus` | pass | 8 / 8 |
| a1 | rule + checks | yes | no | `changeStatusForHuman` | pass | 106 / 106 |
| a2 | rule + checks | yes | no | `changeStatusForHuman` | pass | 106 / 106 |
| a3 | rule + checks | yes | no | `changeStatusForHuman` | pass | 107 / 107 |
| a4 | rule + checks | yes | no | `changeStatusForHuman` | pass | 106 / 106 |
| a5 | rule + checks | yes | no | `changeStatusForHuman` | pass | 105 / 105 |

**Direct status writes: 0 of 5 with the rule only, 0 of 5 with the rule plus
checks.** On this task, with this model, the written rule was enough. The
checks caught nothing, because there was nothing to catch.

One difference did show: all five "rule + checks" agents added the new
endpoint to the every-caller test on their own, so the new move is verified
from every starting status. None of the "rule only" agents had anything like
that to extend. Four of the five "rule + checks" agents also noticed that
directive 001 lists the graph as out of scope, said so, and explained why the
new task needs the edge anyway.

## How this was counted

Mechanically, not from the agents' reports: for each copy, the diff of
`src/domain/status.ts` was checked for a new `reopen` move, every added line
under `src/` was checked for a `status` write outside `nextStatus` /
`changeStatusForHuman` / `db.transition`, and `tsc --noEmit` and `vitest run`
were run again.

## What this does and does not show

- It does not show the checks preventing a mistake. Ten runs of one small task
  with one model is a small sample, and the task required reading the graph
  file, which may have nudged every agent toward using it.
- It does not change the baseline result: before the change, three existing
  callers in the same repo already bypassed the rule, and 20 of 49 attempted
  moves broke the graph (`baseline.md`). The production codebase this is
  modelled on has 21 direct writes where the rule was only written down.
- What it does show: with the checks in place, an agent extends the
  verification rather than working around it, and a direct write would have
  failed `tsc` and the guard test (shown separately by putting one back).

Measured on one machine on 2026-10-06. Nothing here is an estimate.
