import type { OrderStatus } from "./domain/status.js";

export interface OrderItem {
  sku: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customerId: string;
  status: OrderStatus;
  runId: string | null;
  createdAt: string;
}

export type RunState = "DISPATCHED" | "CANCELLED";

export interface DeliveryRun {
  id: string;
  orderIds: string[];
  state: RunState;
}

/**
 * In-memory stand-in for a database. Every method counts as one query, so the
 * baseline script can report queries per request.
 */
export class Db {
  private readonly orders = new Map<string, Order>();
  private readonly items = new Map<string, OrderItem[]>();
  private readonly runs = new Map<string, DeliveryRun>();
  private sequence = 0;
  queryCount = 0;

  nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}-${String(this.sequence).padStart(4, "0")}`;
  }

  insertOrder(order: Order, items: OrderItem[]): void {
    this.queryCount += 1;
    this.orders.set(order.id, { ...order });
    this.items.set(order.id, items.map((item) => ({ ...item })));
  }

  findOrder(id: string): Order | undefined {
    this.queryCount += 1;
    const order = this.orders.get(id);
    return order ? { ...order } : undefined;
  }

  listOrders(): Order[] {
    this.queryCount += 1;
    return [...this.orders.values()].map((order) => ({ ...order }));
  }

  itemsForOrder(orderId: string): OrderItem[] {
    this.queryCount += 1;
    return (this.items.get(orderId) ?? []).map((item) => ({ ...item }));
  }

  updateOrder(id: string, patch: Partial<Omit<Order, "id">>): void {
    this.queryCount += 1;
    const order = this.orders.get(id);
    if (!order) throw new Error(`Order ${id} not found`);
    this.orders.set(id, { ...order, ...patch });
  }

  updateOrders(ids: string[], patch: Partial<Omit<Order, "id">>): void {
    this.queryCount += 1;
    for (const id of ids) {
      const order = this.orders.get(id);
      if (order) this.orders.set(id, { ...order, ...patch });
    }
  }

  insertRun(run: DeliveryRun): void {
    this.queryCount += 1;
    this.runs.set(run.id, { ...run, orderIds: [...run.orderIds] });
  }

  findRun(id: string): DeliveryRun | undefined {
    this.queryCount += 1;
    const run = this.runs.get(id);
    return run ? { ...run, orderIds: [...run.orderIds] } : undefined;
  }

  updateRun(id: string, patch: Partial<Omit<DeliveryRun, "id">>): void {
    this.queryCount += 1;
    const run = this.runs.get(id);
    if (!run) throw new Error(`Run ${id} not found`);
    this.runs.set(id, { ...run, ...patch });
  }
}
