import { NotAllowedError, NotFoundError } from "../errors.js";
import type { Db, Order, OrderItem } from "../store.js";
import { changeStatusForHuman } from "./status-change.js";

export interface CreateOrderInput {
  customerId: string;
  items: OrderItem[];
}

export function createOrder(db: Db, input: CreateOrderInput): Order {
  if (input.items.length === 0) {
    throw new NotAllowedError("An order needs at least one item");
  }
  return db.createOrder(input);
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
  return changeStatusForHuman(db, order.id, "cancel");
}

/** Warehouse marks a paid order as packed and ready. Goes through the graph. */
export function markOrderReady(db: Db, orderId: string): Order {
  return changeStatusForHuman(db, orderId, "markReady");
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
  return changeStatusForHuman(db, order.id, "cancel");
}
