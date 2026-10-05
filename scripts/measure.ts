/**
 * Measures the three candidate quality problems against the running code.
 * Usage: pnpm measure <label>   (writes docs/results/<label>.md)
 *
 * Everything here is measured on a synthetic in-memory service on one machine.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";
import {
  canFire,
  ORDER_STATUSES,
  TRANSITIONS,
  type OrderStatus,
} from "../src/domain/status.js";
import { Db } from "../src/store.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const label = process.argv[2] ?? "baseline";

const LEGAL_EDGES = new Set<string>(
  Object.values(TRANSITIONS).flatMap((transition) =>
    transition.from.map((from) => `${from}>${transition.to}`),
  ),
);

interface Writer {
  name: string;
  path: (orderId: string, runId: string) => string;
  body: (orderId: string) => unknown;
}

const WRITERS: Writer[] = [
  {
    name: "billing: invoice paid",
    path: () => "/internal/payments/invoice-paid",
    body: (orderId) => ({ orderId }),
  },
  {
    name: "carrier: PICKED_UP",
    path: () => "/internal/carrier/events",
    body: (orderId) => ({ orderId, event: "PICKED_UP" }),
  },
  {
    name: "carrier: DELIVERED",
    path: () => "/internal/carrier/events",
    body: (orderId) => ({ orderId, event: "DELIVERED" }),
  },
  {
    name: "carrier: RETURNED_TO_DEPOT",
    path: () => "/internal/carrier/events",
    body: (orderId) => ({ orderId, event: "RETURNED_TO_DEPOT" }),
  },
  {
    name: "admin: cancel run",
    path: (_orderId, runId) => `/admin/runs/${runId}/cancel`,
    body: () => ({}),
  },
  {
    name: "admin: cancel order",
    path: (orderId) => `/admin/orders/${orderId}/cancel`,
    body: () => ({}),
  },
  {
    name: "customer: cancel order",
    path: (orderId) => `/orders/${orderId}/cancel`,
    body: () => ({ customerId: "cus-1" }),
  },
];

interface Attempt {
  writer: string;
  from: OrderStatus;
  to: OrderStatus;
  httpStatus: number;
  illegal: boolean;
}

/** Puts one order in `status` (with a run), fires one writer, reports the move. */
async function attempt(writer: Writer, from: OrderStatus): Promise<Attempt> {
  const db = new Db();
  const app = createApp(db);
  const orderId = "ord-x";
  const runId = "run-x";
  db.insertOrder(
    {
      id: orderId,
      customerId: "cus-1",
      status: from,
      runId,
      createdAt: new Date(0).toISOString(),
    },
    [{ sku: "tea-100g", quantity: 1, unitPrice: 12000 }],
  );
  db.insertRun({ id: runId, orderIds: [orderId], state: "DISPATCHED" });

  const response = await app.request(writer.path(orderId, runId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(writer.body(orderId)),
  });
  const to = db.findOrder(orderId)?.status ?? from;
  const illegal = to !== from && !LEGAL_EDGES.has(`${from}>${to}`);
  return { writer: writer.name, from, to, httpStatus: response.status, illegal };
}

async function measureIllegalMoves(): Promise<Attempt[]> {
  const attempts: Attempt[] = [];
  for (const writer of WRITERS) {
    for (const from of ORDER_STATUSES) {
      attempts.push(await attempt(writer, from));
    }
  }
  return attempts;
}

interface DirectWrite {
  file: string;
  line: number;
  text: string;
}

/**
 * Rough static count for the baseline: a `status` key written through
 * db.updateOrder / db.updateOrders in a function that never calls nextStatus().
 */
function findDirectStatusWrites(): DirectWrite[] {
  const dir = join(root, "src", "services");
  const found: DirectWrite[] = [];
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".ts"))) {
    const lines = readFileSync(join(dir, file), "utf8").split("\n");
    let functionStart = 0;
    lines.forEach((text, index) => {
      if (/^export function /.test(text)) functionStart = index;
      if (!/db\.updateOrders?\(/.test(text) || !/\bstatus\b/.test(text)) return;
      const body = lines.slice(functionStart, index + 1).join("\n");
      if (!body.includes("nextStatus(")) {
        found.push({ file, line: index + 1, text: text.trim() });
      }
    });
  }
  return found;
}

interface CancelRuleRow {
  status: OrderStatus;
  graph: boolean;
  viewFlag: boolean;
  customer: boolean;
  admin: boolean;
}

async function measureCancelRule(): Promise<CancelRuleRow[]> {
  const rows: CancelRuleRow[] = [];
  for (const status of ORDER_STATUSES) {
    const probe = async (path: string, body: unknown): Promise<boolean> => {
      const db = new Db();
      const app = createApp(db);
      db.insertOrder(
        {
          id: "ord-x",
          customerId: "cus-1",
          status,
          runId: null,
          createdAt: new Date(0).toISOString(),
        },
        [],
      );
      const response = await app.request(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      return response.status === 200;
    };
    const db = new Db();
    const app = createApp(db);
    db.insertOrder(
      {
        id: "ord-x",
        customerId: "cus-1",
        status,
        runId: null,
        createdAt: new Date(0).toISOString(),
      },
      [],
    );
    const view = (await (await app.request("/orders/ord-x")).json()) as {
      canCancel: boolean;
    };
    rows.push({
      status,
      graph: canFire(status, "cancel"),
      viewFlag: view.canCancel,
      customer: await probe("/orders/ord-x/cancel", { customerId: "cus-1" }),
      admin: await probe("/admin/orders/ord-x/cancel", {}),
    });
  }
  return rows;
}

async function measureListQueries(orderCount: number): Promise<number> {
  const db = new Db();
  const app = createApp(db);
  for (let index = 0; index < orderCount; index += 1) {
    db.insertOrder(
      {
        id: `ord-${index}`,
        customerId: "cus-1",
        status: "PENDING",
        runId: null,
        createdAt: new Date(0).toISOString(),
      },
      [{ sku: "tea-100g", quantity: 1, unitPrice: 12000 }],
    );
  }
  const before = db.queryCount;
  await app.request("/admin/orders");
  return db.queryCount - before;
}

const yesNo = (value: boolean): string => (value ? "yes" : "no");

async function main(): Promise<void> {
  const attempts = await measureIllegalMoves();
  const illegal = attempts.filter((entry) => entry.illegal);
  const directWrites = findDirectStatusWrites();
  const cancelRows = await measureCancelRule();
  const cancelDisagreements = cancelRows.filter(
    (row) =>
      row.viewFlag !== row.customer ||
      row.admin !== row.graph ||
      (row.customer && !row.graph),
  );
  const listQueries = await measureListQueries(20);

  const out: string[] = [];
  out.push(`# Measurements: ${label}`);
  out.push("");
  out.push(
    "Measured on the synthetic in-memory service, one machine. No production data.",
  );
  out.push("");
  out.push("## A. Status moves that break the graph");
  out.push("");
  out.push(
    `- Attempts: ${attempts.length} (${WRITERS.length} writers × ${ORDER_STATUSES.length} starting statuses)`,
  );
  out.push(`- **Illegal moves accepted: ${illegal.length}**`);
  out.push(`- Direct status writes found in \`src/services\`: ${directWrites.length}`);
  out.push("");
  if (illegal.length > 0) {
    out.push("| Writer | From | To | HTTP |");
    out.push("|---|---|---|---|");
    for (const entry of illegal) {
      out.push(
        `| ${entry.writer} | ${entry.from} | ${entry.to} | ${entry.httpStatus} |`,
      );
    }
    out.push("");
  }
  if (directWrites.length > 0) {
    out.push("| File | Line | Code |");
    out.push("|---|---|---|");
    for (const write of directWrites) {
      out.push(`| ${write.file} | ${write.line} | \`${write.text}\` |`);
    }
    out.push("");
  }
  out.push("## B. Cancel rule copies");
  out.push("");
  out.push(
    `- **Statuses where the copies disagree: ${cancelDisagreements.length} of ${cancelRows.length}**`,
  );
  out.push("");
  out.push("| Status | Graph allows | Storefront shows button | Customer cancel works | Admin cancel works |");
  out.push("|---|---|---|---|---|");
  for (const row of cancelRows) {
    out.push(
      `| ${row.status} | ${yesNo(row.graph)} | ${yesNo(row.viewFlag)} | ${yesNo(row.customer)} | ${yesNo(row.admin)} |`,
    );
  }
  out.push("");
  out.push("## C. Queries for the admin order list");
  out.push("");
  out.push(`- **Queries to list 20 orders: ${listQueries}**`);
  out.push("");

  const text = out.join("\n");
  const target = join(root, "docs", "results", `${label}.md`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
  console.log(text);
  console.log(`\nWritten to docs/results/${label}.md`);
}

await main();
