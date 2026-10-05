import { describe, expect, it } from "vitest";
import {
  canFire,
  ORDER_STATUSES,
  TRANSITIONS,
  type OrderStatus,
  type TransitionName,
} from "../src/domain/status.js";
import { createApp } from "../src/app.js";
import { Db } from "../src/store.js";

const LEGAL_EDGES = new Set<string>(
  Object.values(TRANSITIONS).flatMap((transition) =>
    transition.from.map((from) => `${from}>${transition.to}`),
  ),
);

interface Caller {
  name: string;
  /** "service" callers retry and arrive late; "human" callers get errors. */
  kind: "service" | "human";
  /** The graph move this caller asks for. */
  transition: TransitionName;
  /** True when a failed move has other rules in front of the graph (defect B). */
  hasOwnCancelRule?: boolean;
  path: (orderId: string, runId: string) => string;
  body: (orderId: string) => unknown;
}

const CALLERS: Caller[] = [
  {
    name: "billing: invoice paid",
    kind: "service",
    transition: "pay",
    path: () => "/internal/payments/invoice-paid",
    body: (orderId) => ({ orderId }),
  },
  {
    name: "carrier: PICKED_UP",
    kind: "service",
    transition: "pickUp",
    path: () => "/internal/carrier/events",
    body: (orderId) => ({ orderId, event: "PICKED_UP" }),
  },
  {
    name: "carrier: DELIVERED",
    kind: "service",
    transition: "deliver",
    path: () => "/internal/carrier/events",
    body: (orderId) => ({ orderId, event: "DELIVERED" }),
  },
  {
    name: "carrier: RETURNED_TO_DEPOT",
    kind: "service",
    transition: "undispatch",
    path: () => "/internal/carrier/events",
    body: (orderId) => ({ orderId, event: "RETURNED_TO_DEPOT" }),
  },
  {
    name: "admin: cancel run",
    kind: "human",
    transition: "undispatch",
    path: (_orderId, runId) => `/admin/runs/${runId}/cancel`,
    body: () => ({}),
  },
  {
    name: "admin: cancel order",
    kind: "human",
    transition: "cancel",
    hasOwnCancelRule: true,
    path: (orderId) => `/admin/orders/${orderId}/cancel`,
    body: () => ({}),
  },
  {
    name: "customer: cancel order",
    kind: "human",
    transition: "cancel",
    hasOwnCancelRule: true,
    path: (orderId) => `/orders/${orderId}/cancel`,
    body: () => ({ customerId: "cus-1" }),
  },
  {
    name: "admin: mark ready",
    kind: "human",
    transition: "markReady",
    path: (orderId) => `/admin/orders/${orderId}/ready`,
    body: () => ({}),
  },
  {
    name: "admin: dispatch run",
    kind: "human",
    transition: "dispatch",
    path: () => "/admin/runs",
    body: (orderId) => ({ orderIds: [orderId] }),
  },
];

async function fire(caller: Caller, from: OrderStatus) {
  const db = new Db();
  const app = createApp(db);
  db.insertOrder(
    {
      id: "ord-x",
      customerId: "cus-1",
      status: from,
      runId: "run-x",
      createdAt: new Date(0).toISOString(),
    },
    [{ sku: "tea-100g", quantity: 1, unitPrice: 12000 }],
  );
  db.insertRun({ id: "run-x", orderIds: ["ord-x"], state: "DISPATCHED" });
  const response = await app.request(caller.path("ord-x", "run-x"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(caller.body("ord-x")),
  });
  const body = (await response.json()) as Record<string, unknown>;
  const to = db.findOrder("ord-x")?.status ?? from;
  return { httpStatus: response.status, body, to };
}

describe("every caller, from every starting status", () => {
  for (const caller of CALLERS) {
    describe(caller.name, () => {
      for (const from of ORDER_STATUSES) {
        it(`from ${from}: never makes an illegal move`, async () => {
          const { httpStatus, body, to } = await fire(caller, from);

          // 1. The order is unchanged or moved along an edge the graph has.
          expect(to === from || LEGAL_EDGES.has(`${from}>${to}`)).toBe(true);

          // 2. If the graph allows the move, a legal start really moves.
          if (canFire(from, caller.transition) && !caller.hasOwnCancelRule) {
            expect(to).toBe(TRANSITIONS[caller.transition].to);
          }

          // 3. If the graph forbids it, nothing changes.
          if (!canFire(from, caller.transition)) {
            expect(to).toBe(from);
          }

          // 4. What the caller is told.
          if (caller.kind === "service") {
            expect(httpStatus).toBe(200);
            expect(body.applied).toBe(to !== from);
          } else if (to !== from) {
            expect([200, 201]).toContain(httpStatus);
          } else if (caller.name === "admin: cancel run") {
            // A run cancel always succeeds; it just leaves moved-on orders.
            expect(httpStatus).toBe(200);
          } else {
            expect([400, 409]).toContain(httpStatus);
            expect(typeof body.error).toBe("string");
            if (!caller.hasOwnCancelRule) expect(httpStatus).toBe(409);
          }
        });
      }
    });
  }
});
