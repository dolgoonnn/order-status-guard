-- Checks db/order_status_guard.sql against a real Postgres. From the repo root:
--
--   createdb osg_check
--   psql -d osg_check -v ON_ERROR_STOP=1 -f db/verify.sql
--   dropdb osg_check
--
-- Expected: every block prints PASS, and the summary says 16 allowed (9 legal
-- edges + 7 same-status rewrites) and 33 rejected out of 49 attempts.

CREATE TABLE orders (
  id     text PRIMARY KEY,
  status text NOT NULL,
  run_id text
);

\i db/order_status_guard.sql

INSERT INTO orders (id, status) VALUES ('ord-1', 'PENDING'), ('ord-2', 'DELIVERED');

-- A legal move, as raw SQL.
UPDATE orders SET status = 'PAID' WHERE id = 'ord-1';

-- The payment-retry bug, as raw SQL: PAID written on a delivered order.
DO $check$
BEGIN
  UPDATE orders SET status = 'PAID' WHERE id = 'ord-2';
  RAISE EXCEPTION 'FAIL: the trigger let DELIVERED -> PAID through';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: rejected with "%"', SQLERRM;
END
$check$;

-- A value the graph does not know.
DO $check$
BEGIN
  UPDATE orders SET status = 'PAIDD' WHERE id = 'ord-1';
  RAISE EXCEPTION 'FAIL: the trigger accepted an unknown status';
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE 'PASS: rejected with "%"', SQLERRM;
END
$check$;

-- A same-status rewrite with other fields is allowed (idempotent updates).
UPDATE orders SET status = 'DELIVERED', run_id = 'run-9' WHERE id = 'ord-2';

-- Every starting status against every target status, like scripts/measure.ts.
DO $check$
DECLARE
  statuses text[] := ARRAY['PENDING','PAID','READY','DISPATCHED','IN_TRANSIT','DELIVERED','CANCELLED'];
  from_s text;
  to_s   text;
  allowed  int := 0;
  rejected int := 0;
BEGIN
  FOREACH from_s IN ARRAY statuses LOOP
    FOREACH to_s IN ARRAY statuses LOOP
      DELETE FROM orders WHERE id = 'probe';
      INSERT INTO orders (id, status) VALUES ('probe', from_s);
      BEGIN
        UPDATE orders SET status = to_s WHERE id = 'probe';
        allowed := allowed + 1;
      EXCEPTION WHEN check_violation THEN
        rejected := rejected + 1;
      END;
    END LOOP;
  END LOOP;
  DELETE FROM orders WHERE id = 'probe';
  RAISE NOTICE 'attempts %: allowed % (legal edges + same-status), rejected %',
    allowed + rejected, allowed, rejected;
  IF allowed <> 16 OR rejected <> 33 THEN
    RAISE EXCEPTION 'FAIL: expected 16 allowed and 33 rejected';
  END IF;
  RAISE NOTICE 'PASS: only the graph''s edges and same-status rewrites get through';
END
$check$;

SELECT id, status, run_id FROM orders ORDER BY id;
