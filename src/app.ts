import { Hono } from "hono";
import { IllegalTransitionError } from "./domain/status.js";
import { NotAllowedError, NotFoundError } from "./errors.js";
import {
  handleCarrierEvent,
  isCarrierEvent,
} from "./services/carrier.service.js";
import { cancelRun, dispatchRun } from "./services/delivery-run.service.js";
import { getOrder, listOrders } from "./services/order-query.service.js";
import {
  cancelOrderAsAdmin,
  cancelOrderAsCustomer,
  createOrder,
  markOrderReady,
} from "./services/order.service.js";
import { handleInvoicePaid } from "./services/payment.service.js";
import type { Db, OrderItem } from "./store.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) throw new NotAllowedError("items must be a list");
  return value.map((raw) => {
    if (
      !isRecord(raw) ||
      typeof raw.sku !== "string" ||
      typeof raw.quantity !== "number" ||
      typeof raw.unitPrice !== "number"
    ) {
      throw new NotAllowedError("Each item needs sku, quantity and unitPrice");
    }
    return { sku: raw.sku, quantity: raw.quantity, unitPrice: raw.unitPrice };
  });
}

function requireString(body: unknown, field: string): string {
  if (!isRecord(body) || typeof body[field] !== "string") {
    throw new NotAllowedError(`${field} is required`);
  }
  return body[field];
}

export function createApp(db: Db): Hono {
  const app = new Hono();

  app.onError((error, c) => {
    if (error instanceof NotFoundError) {
      return c.json({ error: error.message }, 404);
    }
    if (error instanceof NotAllowedError) {
      return c.json({ error: error.message }, 400);
    }
    if (error instanceof IllegalTransitionError) {
      return c.json({ error: error.message }, 409);
    }
    console.error(error);
    return c.json({ error: "Internal error" }, 500);
  });

  // Customers
  app.post("/orders", async (c) => {
    const body: unknown = await c.req.json();
    const customerId = requireString(body, "customerId");
    const items = parseItems(isRecord(body) ? body.items : undefined);
    return c.json(createOrder(db, { customerId, items }), 201);
  });

  app.get("/orders/:id", (c) => c.json(getOrder(db, c.req.param("id"))));

  app.post("/orders/:id/cancel", async (c) => {
    const customerId = requireString(await c.req.json(), "customerId");
    return c.json(cancelOrderAsCustomer(db, c.req.param("id"), customerId));
  });

  // Admin
  app.get("/admin/orders", (c) => c.json(listOrders(db)));

  app.post("/admin/orders/:id/ready", (c) =>
    c.json(markOrderReady(db, c.req.param("id"))),
  );

  app.post("/admin/orders/:id/cancel", (c) =>
    c.json(cancelOrderAsAdmin(db, c.req.param("id"))),
  );

  app.post("/admin/runs", async (c) => {
    const body: unknown = await c.req.json();
    const orderIds = isRecord(body) ? body.orderIds : undefined;
    if (
      !Array.isArray(orderIds) ||
      !orderIds.every((id): id is string => typeof id === "string")
    ) {
      throw new NotAllowedError("orderIds must be a list of ids");
    }
    return c.json(dispatchRun(db, orderIds), 201);
  });

  app.post("/admin/runs/:id/cancel", (c) =>
    c.json(cancelRun(db, c.req.param("id"))),
  );

  // Other services
  app.post("/internal/payments/invoice-paid", async (c) => {
    const orderId = requireString(await c.req.json(), "orderId");
    return c.json(handleInvoicePaid(db, orderId));
  });

  app.post("/internal/carrier/events", async (c) => {
    const body: unknown = await c.req.json();
    const orderId = requireString(body, "orderId");
    const event = isRecord(body) ? body.event : undefined;
    if (!isCarrierEvent(event)) {
      throw new NotAllowedError("Unknown carrier event");
    }
    return c.json(handleCarrierEvent(db, orderId, event));
  });

  return app;
}
