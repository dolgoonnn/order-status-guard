import { nextStatus } from "../domain/status.js";
import { NotAllowedError, NotFoundError } from "../errors.js";
import type { Db, Order, OrderItem } from "../store.js";

export interface CreateOrderInput {
  customerId: string;
  items: OrderItem[];
}

export function createOrder(db: Db, input: CreateOrderInput): Order {
  if (input.items.length === 0) {
    throw new NotAllowedError("An order needs at least one item");
  }
  const order: Order = {
    id: db.nextId("ord"),
    customerId: input.customerId,
    status: "PENDING", // initial state
    runId: null,
    createdAt: new Date().toISOString(),
  };
  db.insertOrder(order, input.items);
  return order;
}

/** Customer cancels their own order. Goes through the status graph. */
export function cancelOrderAsCustomer(
  db: Db,
  orderId: string,
  customerId: string,
): Order {
  const order = db.findOrder(orderId);
  if (!order || order.customerId !== customerId) {
    throw new NotFoundError("Order");
  }
  // SEEDED DEFECT B (duplicated rule, copy 1 of 3): who may cancel, and when.
  if (order.status !== "PENDING" && order.status !== "PAID") {
    throw new NotAllowedError("This order can no longer be cancelled");
  }
  const status = nextStatus(order.status, "cancel");
  db.updateOrder(order.id, { status });
  return { ...order, status };
}

/** Warehouse marks a paid order as packed and ready. Goes through the graph. */
export function markOrderReady(db: Db, orderId: string): Order {
  const order = db.findOrder(orderId);
  if (!order) throw new NotFoundError("Order");
  const status = nextStatus(order.status, "markReady");
  db.updateOrder(order.id, { status });
  return { ...order, status };
}

/** Admin cancels an order. */
export function cancelOrderAsAdmin(db: Db, orderId: string): Order {
  const order = db.findOrder(orderId);
  if (!order) throw new NotFoundError("Order");
  // SEEDED DEFECT B (duplicated rule, copy 2 of 3): same rule, different list.
  const cancellable = ["PENDING", "PAID", "READY", "DISPATCHED"];
  if (!cancellable.includes(order.status)) {
    throw new NotAllowedError("This order can no longer be cancelled");
  }
  const status = nextStatus(order.status, "cancel");
  db.updateOrder(order.id, { status });
  return { ...order, status };
}
