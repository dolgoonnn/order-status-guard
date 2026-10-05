import type { Hono } from "hono";
import { createApp } from "../src/app.js";
import { Db, type DeliveryRun, type Order } from "../src/store.js";
import type { OrderView } from "../src/services/order-query.service.js";

export interface TestApi {
  db: Db;
  app: Hono;
  post<T>(path: string, body?: unknown): Promise<{ status: number; body: T }>;
  get<T>(path: string): Promise<{ status: number; body: T }>;
  createOrder(customerId?: string): Promise<Order>;
  orderToReady(customerId?: string): Promise<Order>;
  view(orderId: string): Promise<OrderView>;
}

export function createTestApi(): TestApi {
  const db = new Db();
  const app = createApp(db);

  async function post<T>(path: string, body: unknown = {}) {
    const response = await app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as T };
  }

  async function get<T>(path: string) {
    const response = await app.request(path);
    return { status: response.status, body: (await response.json()) as T };
  }

  async function createOrder(customerId = "cus-1") {
    const created = await post<Order>("/orders", {
      customerId,
      items: [
        { sku: "tea-100g", quantity: 2, unitPrice: 12000 },
        { sku: "cup", quantity: 1, unitPrice: 30000 },
      ],
    });
    return created.body;
  }

  async function orderToReady(customerId = "cus-1") {
    const order = await createOrder(customerId);
    await post("/internal/payments/invoice-paid", { orderId: order.id });
    const ready = await post<Order>(`/admin/orders/${order.id}/ready`);
    return ready.body;
  }

  async function view(orderId: string) {
    return (await get<OrderView>(`/orders/${orderId}`)).body;
  }

  return { db, app, post, get, createOrder, orderToReady, view };
}

export type { DeliveryRun, Order, OrderView };
