# Review checklist: changes that touch an order's status

Use this for any change under `src/services/`, `src/store.ts` or
`src/domain/status.ts`, whoever wrote it. Each item is a yes or no.

## Before reading the diff

- [ ] `pnpm typecheck`, `pnpm test` and `pnpm measure after` pass, run by you,
      not pasted.
- [ ] `docs/results/after.md` still reports 0 illegal moves and 0 direct
      writes.

## The status rules

- [ ] Every status change goes through `Db.transition`. No `status` key in an
      update, no assignment to `.status`, no `insertOrder` on an existing id.
- [ ] No cast, `@ts-expect-error` or disable comment anywhere near a status
      write.
- [ ] A callback from another service that isn't legal returns 200 and changes
      nothing. A human action that isn't legal returns 409.
- [ ] A new move was added to `src/domain/status.ts`, not worked around in a
      caller.

## The checks themselves

- [ ] `tests/status-writes.guard.test.ts`, `tests/every-caller.test.ts` and
      `scripts/measure.ts` are unchanged, or the change makes them stricter.
- [ ] If a guard changed: put a direct write back and confirm it still fails.
- [ ] If an existing test changed, the change is listed with a reason, and the
      behaviour change was wanted.

## Scope and handoff

- [ ] The diff stays inside the directive's scope. Anything outside it is
      named as a departure, not slipped in.
- [ ] The `SEEDED DEFECT B` and `C` code is untouched.
- [ ] Another engineer could change this without asking: the directive,
      `AGENTS.md` and the decision record say why it is the way it is.
