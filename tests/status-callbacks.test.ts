import { describe, expect, it } from "vitest";
import type { Order } from "../src/store.js";
import { createTestApi, type DeliveryRun } from "./helpers.js";

interface EventBody {
  applied: boolean;
  reason?: string;
  order: Order;
}

interface CancelRunBody extends DeliveryRun {
  released: string[];
  left: { orderId: string; currentStatus: string }[];
}

const paid = (orderId: string) => ({ orderId });
const carrier = (orderId: string, event: string) => ({ orderId, event });

describe("billing callback", () => {
  it("applies the first call and ignores a repeat", async () => {
    const api = createTestApi();
    const order = await api.createOrder();

    const first = await api.post<EventBody>("/internal/payments/invoice-paid", paid(order.id));
    expect(first.status).toBe(200);
    expect(first.body.applied).toBe(true);
    expect(first.body.order.status).toBe("PAID");

    const repeat = await api.post<EventBody>("/internal/payments/invoice-paid", paid(order.id));
    expect(repeat.status).toBe(200);
    expect(repeat.body.applied).toBe(false);
    expect(repeat.body.reason).toContain("PAID");
    expect((await api.view(order.id)).status).toBe("PAID");
  });

  it("does not bring a delivered or cancelled order back to PAID", async () => {
    const api = createTestApi();
    const cancelled = await api.createOrder();
    await api.post(`/admin/orders/${cancelled.id}/cancel`);
    const late = await api.post<EventBody>("/internal/payments/invoice-paid", paid(cancelled.id));
    expect(late.status).toBe(200);
    expect(late.body.applied).toBe(false);
    expect((await api.view(cancelled.id)).status).toBe("CANCELLED");
  });

  it("still answers 404 for an unknown order", async () => {
    const api = createTestApi();
    const response = await api.post("/internal/payments/invoice-paid", paid("ord-nope"));
    expect(response.status).toBe(404);
  });
});

describe("carrier events", () => {
  async function dispatched() {
    const api = createTestApi();
    const order = await api.orderToReady();
    await api.post("/admin/runs", { orderIds: [order.id] });
    return { api, order };
  }

  it("drops a late PICKED_UP after DELIVERED", async () => {
    const { api, order } = await dispatched();
    await api.post("/internal/carrier/events", carrier(order.id, "PICKED_UP"));
    await api.post("/internal/carrier/events", carrier(order.id, "DELIVERED"));

    const late = await api.post<EventBody>("/internal/carrier/events", carrier(order.id, "PICKED_UP"));
    expect(late.status).toBe(200);
    expect(late.body.applied).toBe(false);
    expect((await api.view(order.id)).status).toBe("DELIVERED");
  });

  it("drops an event for a cancelled order with 200", async () => {
    const api = createTestApi();
    const order = await api.createOrder();
    await api.post(`/admin/orders/${order.id}/cancel`);
    const response = await api.post<EventBody>("/internal/carrier/events", carrier(order.id, "DELIVERED"));
    expect(response.status).toBe(200);
    expect(response.body.applied).toBe(false);
  });

  it("applies RETURNED_TO_DEPOT only while the order is DISPATCHED", async () => {
    const { api, order } = await dispatched();
    await api.post("/internal/carrier/events", carrier(order.id, "PICKED_UP"));

    const whileInTransit = await api.post<EventBody>("/internal/carrier/events", carrier(order.id, "RETURNED_TO_DEPOT"));
    expect(whileInTransit.status).toBe(200);
    expect(whileInTransit.body.applied).toBe(false);
    expect((await api.view(order.id)).status).toBe("IN_TRANSIT");
  });

  it("applies RETURNED_TO_DEPOT for a DISPATCHED order", async () => {
    const { api, order } = await dispatched();
    const response = await api.post<EventBody>("/internal/carrier/events", carrier(order.id, "RETURNED_TO_DEPOT"));
    expect(response.body.applied).toBe(true);
    expect((await api.view(order.id)).status).toBe("READY");
  });
});

describe("cancelling a run after some orders were picked up", () => {
  it("releases the DISPATCHED orders and leaves the rest alone", async () => {
    const api = createTestApi();
    const pickedUp = await api.orderToReady();
    const waiting = await api.orderToReady();
    const delivered = await api.orderToReady();
    const run = await api.post<DeliveryRun>("/admin/runs", {
      orderIds: [pickedUp.id, waiting.id, delivered.id],
    });
    await api.post("/internal/carrier/events", carrier(pickedUp.id, "PICKED_UP"));
    await api.post("/internal/carrier/events", carrier(delivered.id, "PICKED_UP"));
    await api.post("/internal/carrier/events", carrier(delivered.id, "DELIVERED"));

    const cancelled = await api.post<CancelRunBody>(`/admin/runs/${run.body.id}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.state).toBe("CANCELLED");
    expect(cancelled.body.released).toEqual([waiting.id]);
    expect(cancelled.body.left).toEqual([
      { orderId: pickedUp.id, currentStatus: "IN_TRANSIT" },
      { orderId: delivered.id, currentStatus: "DELIVERED" },
    ]);

    expect((await api.view(waiting.id)).status).toBe("READY");
    expect((await api.view(waiting.id)).runId).toBeNull();
    expect((await api.view(pickedUp.id)).status).toBe("IN_TRANSIT");
    expect((await api.view(pickedUp.id)).runId).toBe(run.body.id);
    expect((await api.view(delivered.id)).status).toBe("DELIVERED");
  });

  it("does not release an order that was handed to a newer run", async () => {
    const api = createTestApi();
    const order = await api.orderToReady();
    const first = await api.post<DeliveryRun>("/admin/runs", { orderIds: [order.id] });
    await api.post("/internal/carrier/events", carrier(order.id, "RETURNED_TO_DEPOT"));
    const second = await api.post<DeliveryRun>("/admin/runs", { orderIds: [order.id] });

    const cancelled = await api.post<CancelRunBody>(`/admin/runs/${first.body.id}/cancel`);
    expect(cancelled.body.released).toEqual([]);
    expect((await api.view(order.id)).status).toBe("DISPATCHED");
    expect((await api.view(order.id)).runId).toBe(second.body.id);
  });
});

describe("human callers", () => {
  it("answers 409 with the reason for an illegal move", async () => {
    const api = createTestApi();
    const order = await api.createOrder();
    const response = await api.post<{ error: string }>(`/admin/orders/${order.id}/ready`);
    expect(response.status).toBe(409);
    expect(response.body.error).toContain("markReady");
    expect(response.body.error).toContain("PENDING");
  });

  it("dispatches nothing when one order in the batch is not READY", async () => {
    const api = createTestApi();
    const ready = await api.orderToReady();
    const pending = await api.createOrder();
    const response = await api.post("/admin/runs", { orderIds: [ready.id, pending.id] });
    expect(response.status).toBe(409);
    expect((await api.view(ready.id)).status).toBe("READY");
  });
});
