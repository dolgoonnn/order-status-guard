import {
  ORDER_STATUSES,
  TRANSITIONS,
  type OrderStatus,
  type TransitionName,
} from "./status.js";

export interface LegalEdge {
  from: OrderStatus;
  to: OrderStatus;
  move: TransitionName;
}

/** Every legal edge of the graph, one row per (from, to), in graph order. */
export function legalEdges(): LegalEdge[] {
  const edges: LegalEdge[] = [];
  for (const [move, transition] of Object.entries(TRANSITIONS) as [
    TransitionName,
    (typeof TRANSITIONS)[TransitionName],
  ][]) {
    for (const from of transition.from) {
      edges.push({ from, to: transition.to, move });
    }
  }
  return edges;
}

function literal(value: string): string {
  if (!/^[A-Za-z_]+$/.test(value)) {
    throw new Error(`Unexpected characters in SQL literal: ${value}`);
  }
  return `'${value}'`;
}

/**
 * The status graph as a Postgres trigger, so the rule holds for every writer
 * that reaches the database: the app, other services, migrations, a human in
 * psql. TypeScript checks only see this repo; the database sees everyone.
 *
 * `pnpm sql` writes this to `db/order_status_guard.sql`;
 * `tests/status-sql.test.ts` fails if that file drifts from the graph.
 */
export function renderStatusGuardSql(): string {
  const rows = legalEdges()
    .map((edge) => `  (${literal(edge.from)}, ${literal(edge.to)}, ${literal(edge.move)})`)
    .join(",\n");
  const statuses = ORDER_STATUSES.map(literal).join(", ");
  return `-- Generated from src/domain/status.ts by \`pnpm sql\`. Do not edit by hand.
--
-- The order status graph, enforced by the database for every writer: the app,
-- other services with their own connection, migrations, and a human in psql.
-- Same-status updates pass (idempotent rewrites); any other move not listed
-- below is rejected with a check_violation.
--
-- Apply after the orders table exists. Re-running is safe.

CREATE TABLE IF NOT EXISTS order_status_transitions (
  from_status text NOT NULL,
  to_status   text NOT NULL,
  move        text NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

-- Replace the whole table, so an edge removed from the graph is removed here.
DELETE FROM order_status_transitions;
INSERT INTO order_status_transitions (from_status, to_status, move) VALUES
${rows};

CREATE OR REPLACE FUNCTION order_status_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN (${statuses}) THEN
    RAISE EXCEPTION 'unknown order status % (order %)', NEW.status, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT EXISTS (
       SELECT 1 FROM order_status_transitions
       WHERE from_status = OLD.status AND to_status = NEW.status
     ) THEN
    RAISE EXCEPTION 'illegal order status move % -> % (order %)',
      OLD.status, NEW.status, OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS order_status_guard ON orders;
CREATE TRIGGER order_status_guard
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW EXECUTE FUNCTION order_status_guard();

-- Stronger still, when the app has its own database role: grant UPDATE on
-- every column of orders except status, and make one SECURITY DEFINER
-- function the only writer of status. Then raw SQL from the app role gets
-- "permission denied" instead of relying on the trigger. Not generated here
-- because the column list belongs to the real schema, not to this graph.
`;
}
