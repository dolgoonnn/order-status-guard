# Agent instructions

A small order service: customers place orders, billing confirms payment, the
warehouse batches orders into courier runs, and the carrier reports delivery.

## Commands

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm test        # vitest run
pnpm dev         # http://localhost:3000
```

## Rules

1. Use `pnpm`, never `npm` or `yarn`, for every command.
2. Keep services as plain functions that take `db` as their first argument.
3. No `any`. Narrow `unknown` input at the HTTP boundary in `src/app.ts`.
4. Name files `kebab-case.ts`; name services `<domain>.service.ts`.
5. One exported function per use case; helpers stay module-private.
6. Import order: node built-ins, then packages, then relative paths, each group alphabetised.
7. Use `import type` for type-only imports.
8. Every route handler returns JSON; never return a bare string.
9. HTTP status codes: 201 for creation, 200 otherwise, 404 unknown id, 400 invalid input, 409 illegal state.
10. Errors thrown from services must be one of the classes in `src/errors.ts`; add a class there rather than throwing `Error`.
11. Validate request bodies in `src/app.ts`, not in services.
12. Never log request bodies; they may contain customer data.
13. Dates are ISO strings in UTC; never store a `Date` object.
14. Money is an integer number of the smallest unit; never a float.
15. Keep `Db` methods one query each so the query counter stays meaningful.
16. Do not add dependencies without saying so in the summary.
17. Tests live in `tests/`, one file per feature, named `<feature>.test.ts`.
18. Use the helpers in `tests/helpers.ts`; do not construct `Db` by hand in a test unless you need a specific starting state.
19. A test asserts behaviour through the HTTP layer, not by calling a service directly, unless the service has no route.
20. Every new route gets at least one happy-path test and one failure test.
21. Keep functions under 40 lines; split rather than nest.
22. Prefer early returns to nested conditionals.
23. Order status changes MUST go through `nextStatus()` in `src/domain/status.ts`. Never write a `status` value directly.
24. Do not reorder object keys in existing code; diffs should show only your change.
25. Use `readonly` for arrays and objects that are never mutated.
26. Avoid default exports.
27. Comments explain why, not what. Delete a comment that restates the code.
28. Keep the `SEEDED DEFECT` comments where they are; they are deliberate.
29. Run `pnpm typecheck` and `pnpm test` before you report; paste the last lines.
30. Do not commit; the reviewer commits.
31. Never edit `scripts/measure.ts`.
32. Do not rename exported symbols unless the task says so.
33. When a task says "rename", update every reference, including tests and comments.
34. Use `Number.isInteger` for integer checks; never `parseInt` on user input.
35. Strings shown to users are plain English sentences ending with a full stop.
36. Prefer `Map` over plain objects for keyed collections in the store.
37. No optional chaining on values that cannot be null; narrow the type instead.
38. Handle a missing order with `NotFoundError`, never with a 500.
39. Do not use `console.log` in `src/`; the server file is the only exception.
40. Keep `src/app.ts` free of business logic; it parses, calls a service, and answers.
41. Do not introduce global mutable state outside the `Db` instance.
42. A function that returns an `Order` returns a copy, never the stored object.
43. Tests must not depend on each other or on execution order.
44. When unsure between two designs, pick the smaller diff and say why.
45. Summarise every task in the final report in one line each.
