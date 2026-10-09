import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ORDER_STATUSES, TRANSITIONS } from "../src/domain/status.js";
import { legalEdges, renderStatusGuardSql } from "../src/domain/status-sql.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const committed = readFileSync(join(root, "db", "order_status_guard.sql"), "utf8");

describe("the database trigger is generated from the graph", () => {
  it("db/order_status_guard.sql matches the graph (if not, run `pnpm sql` and commit)", () => {
    expect(committed).toBe(renderStatusGuardSql());
  });

  it("has one transitions row per legal edge", () => {
    const expected = Object.values(TRANSITIONS).reduce(
      (count, transition) => count + transition.from.length,
      0,
    );
    const rows = committed.match(/^ {2}\('[A-Z_]+', '[A-Z_]+', '\w+'\)/gm) ?? [];
    expect(legalEdges()).toHaveLength(expected);
    expect(rows).toHaveLength(expected);
  });

  it("names every status, so an unknown value is rejected too", () => {
    for (const status of ORDER_STATUSES) {
      expect(committed).toContain(`'${status}'`);
    }
  });

  it("guards the status column with a BEFORE UPDATE trigger", () => {
    expect(committed).toContain("BEFORE UPDATE OF status ON orders");
    expect(committed).toContain("ERRCODE = 'check_violation'");
  });
});
