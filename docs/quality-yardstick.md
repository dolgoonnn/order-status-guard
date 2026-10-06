# Quality yardstick

How we judge a change in this repo. Every review uses these three questions.

## 1. User impact

An order's status is what customers, admins and vendors act on. An order must
never show a status it didn't reach by a legal move. The worst cases are a
delivered order going backwards (the customer is told something false, and the
parcel can be dispatched again) and a cancelled order coming back to life.

## 2. Maintenance effort

Adding a status, or a new caller that changes status, should mean editing the
graph in `src/domain/status.ts` and the caller itself. No caller should need to
know which moves are legal.

## 3. Operating cost

Every wrong status costs a support ticket and a manual data fix. Billing and
the carrier retry their callbacks and deliver them late, so handling a repeat
must not cause more retries or more repairs.

## What "good" looks like here

- One function changes an order's status. A direct write fails the type check
  and fails a test.
- No caller can move an order along an edge the graph doesn't have
  (`pnpm measure` reports 0 illegal moves).
- A repeated or late callback from another service returns 200 and changes
  nothing.
- A human action that can't happen returns an error that says why.
- Adding a status means editing `src/domain/status.ts`, and no check needs to
  change.

## What we accept

- The source-scan test is a text check, and unusual code could get past it.
  The types and the behaviour test are the backstop.
- A stale event from another service is dropped. The response says it wasn't
  applied, but nothing alerts on it.
- This change does not fix the duplicated cancel rule or the slow order list.
