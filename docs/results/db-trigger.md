# The database layer, checked against Postgres

`db/order_status_guard.sql` is generated from `src/domain/status.ts` by
`pnpm sql`. `db/verify.sql` applies it to a throwaway database and tries raw
SQL writes against it. This is a by-hand check, not part of `pnpm test`,
because this service has an in-memory store and no database.

Run on 2026-10-09 against PostgreSQL 14.15 (Homebrew), from the repo root:

```
createdb osg_check
psql -d osg_check -v ON_ERROR_STOP=1 -q -f db/verify.sql
dropdb osg_check
```

Output:

```
NOTICE:  PASS: rejected with "illegal order status move DELIVERED -> PAID (order ord-2)"
NOTICE:  PASS: rejected with "unknown order status PAIDD (order ord-1)"
NOTICE:  attempts 49: allowed 16 (legal edges + same-status), rejected 33
NOTICE:  PASS: only the graph's edges and same-status rewrites get through
  id   |  status   | run_id
-------+-----------+--------
 ord-1 | PAID      |
 ord-2 | DELIVERED | run-9
(2 rows)
```

Exit code 0. The 49 attempts are every starting status against every target
status, written as `UPDATE orders SET status = …` with no application code in
between. 9 legal edges and 7 same-status rewrites pass; the other 33 raise
`check_violation`.
