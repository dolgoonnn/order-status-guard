import { describe, expect, it } from "vitest";
import {
  createTestApi,
  type DeliveryRun,
  type Order,
  type OrderView,
} from "./helpers.js";

describe("order flow", () => {
  it("takes an order from placed to delivered", async () => {
    const api = createTestApi();
    const order = await api.orderToReady();
    expect(order.status).toBe("READY");

    const run = await api.post<DeliveryRun>("/admin/runs", {
      orderIds: [order.id],
    });
    expect(run.status).toBe(201);
    expect((await api.view(order.id)).status).toBe("DISPATCHED");

    await api.post("/internal/carrier/events", {
      orderId: order.id,
      event: "PICKED_UP",
    });
    expect((await api.view(order.id)).status).toBe("IN_TRANSIT");

    await api.post("/internal/carrier/events", {
      orderId: order.id,
      event: "DELIVERED",
    });
    expect((await api.view(order.id)).status).toBe("DELIVERED");
  });

  it("lets a customer cancel an unpaid order", async () => {
    const api = createTestApi();
    const order = await api.createOrder("cus-7");
    const cancelled = await api.post<Order>(`/orders/${order.id}/cancel`, {
      customerId: "cus-7",
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe("CANCELLED");
  });

  it("hides another customer's order", async () => {
    const api = createTestApi();
    const order = await api.createOrder("cus-7");
    const response = await api.post(`/orders/${order.id}/cancel`, {
      customerId: "cus-8",
    });
    expect(response.status).toBe(404);
  });

  it("cancels a run and frees its orders for the next batch", async () => {
    const api = createTestApi();
    const order = await api.orderToReady();
    const run = await api.post<DeliveryRun>("/admin/runs", {
      orderIds: [order.id],
    });
    const cancelled = await api.post<DeliveryRun>(
      `/admin/runs/${run.body.id}/cancel`,
    );
    expect(cancelled.body.state).toBe("CANCELLED");
    expect((await api.view(order.id)).status).toBe("READY");
  });

  it("lists orders with totals for the admin", async () => {
    const api = createTestApi();
    await api.createOrder();
    await api.createOrder();
    const list = await api.get<OrderView[]>("/admin/orders");
    expect(list.body).toHaveLength(2);
    expect(list.body[0]?.total).toBe(54000);
  });
});
