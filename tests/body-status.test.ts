import { describe, expect, it } from "vitest";
import { createTestApi, type Order } from "./helpers.js";

/**
 * A request body never chooses a status. Routes pick the fields they need and
 * the graph decides the status. This is the production bug the single writer
 * exists for: a client sends `status`, the API spreads the body into an
 * update, the enum accepts a valid value, and a wrong move is written.
 */
describe("a status in a request body is ignored", () => {
  it("on create: the order starts PENDING whatever the body says", async () => {
    const api = createTestApi();
    const created = await api.post<Order>("/orders", {
      customerId: "cus-1",
      items: [{ sku: "tea-100g", quantity: 1, unitPrice: 12000 }],
      status: "DELIVERED",
    });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("PENDING");
    expect(api.db.findOrder(created.body.id)?.status).toBe("PENDING");
  });

  it("on a service callback: the graph's answer wins, not the body's", async () => {
    const api = createTestApi();
    const order = await api.createOrder();
    const paid = await api.post<{ applied: boolean; order: Order }>(
      "/internal/payments/invoice-paid",
      { orderId: order.id, status: "DELIVERED" },
    );
    expect(paid.status).toBe(200);
    expect(paid.body.order.status).toBe("PAID");
  });

  it("on a carrier event: an illegal move stays not applied", async () => {
    const api = createTestApi();
    const order = await api.createOrder();
    const event = await api.post<{ applied: boolean; order: Order }>(
      "/internal/carrier/events",
      { orderId: order.id, event: "DELIVERED", status: "DELIVERED" },
    );
    expect(event.status).toBe(200);
    expect(event.body.applied).toBe(false);
    expect(api.db.findOrder(order.id)?.status).toBe("PENDING");
  });

  it("on a human action: the move named by the route is the one applied", async () => {
    const api = createTestApi();
    const order = await api.createOrder();
    await api.post("/internal/payments/invoice-paid", { orderId: order.id });
    const ready = await api.post<Order>(`/admin/orders/${order.id}/ready`, {
      status: "DELIVERED",
    });
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe("READY");
  });
});
