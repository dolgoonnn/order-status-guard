import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findStatusWrites } from "./status-write-scan.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The only places allowed to write a status: the writer and the creator. */
const WRITER_FILE = "src/store.ts";
const ALLOWED_INSIDE = new Set(["transition", "createOrder"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith(".ts") ? [path] : [];
  });
}

function violations(): string[] {
  return sourceFiles(join(root, "src")).flatMap((path) => {
    const file = relative(root, path);
    return findStatusWrites(file, readFileSync(path, "utf8"))
      .filter(
        (write) =>
          !(file === WRITER_FILE && write.inside && ALLOWED_INSIDE.has(write.inside)),
      )
      .map(
        (write) =>
          `${file}:${write.line} writes an order status directly: \`${write.code}\`. ` +
          `Use db.transition(id, name) in ${WRITER_FILE} (through changeStatusForHuman / ` +
          `changeStatusForEvent), and add the move to src/domain/status.ts if the graph lacks it.`,
      );
  });
}

describe("only Db.transition writes an order status", () => {
  it("finds no direct status write under src/", () => {
    expect(violations(), violations().join("\n")).toEqual([]);
  });
});

describe("the status-write scanner", () => {
  const scan = (code: string) => findStatusWrites("fixture.ts", code);

  it("catches an object key, shorthand and string key", () => {
    expect(scan(`db.updateOrder(id, { status: "PAID" });`)).toHaveLength(1);
    expect(scan(`const status = "PAID"; db.updateOrder(id, { status });`)).toHaveLength(1);
    expect(scan(`db.updateOrder(id, { "status": "PAID" });`)).toHaveLength(1);
    expect(scan(`db.updateOrder(id, { ["status"]: "PAID" });`)).toHaveLength(1);
  });

  it("catches an assignment, including compound and element access", () => {
    expect(scan(`order.status = "PAID";`)).toHaveLength(1);
    expect(scan(`order["status"] = "PAID";`)).toHaveLength(1);
    expect(scan(`order.status ??= "PAID";`)).toHaveLength(1);
  });

  it("catches a write hidden behind a type cast", () => {
    expect(scan(`db.updateOrder(id, { status: "PAID" } as unknown as Patch);`)).toHaveLength(1);
    expect(scan(`(order as Order).status = "PAID";`)).toHaveLength(1);
    expect(scan(`(<Order>order).status = "PAID";`)).toHaveLength(1);
    expect(scan(`Object.assign(order, { status: "PAID" } satisfies object);`)).toHaveLength(1);
  });

  it("reports the line and the enclosing function", () => {
    const [write] = scan(`\nfunction pay() {\n  order.status = "PAID";\n}`);
    expect(write).toMatchObject({ line: 3, inside: "pay" });
  });

  it("ignores reads and comparisons", () => {
    expect(scan(`if (order.status === "PAID") {} const { status } = order;`)).toEqual([]);
    expect(scan(`const same = order.status == other.status;`)).toEqual([]);
  });
});
