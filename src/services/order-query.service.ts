import { NotFoundError } from "../errors.js";
import type { Db, Order, OrderItem } from "../store.js";

export interface OrderView extends Order {
  items: OrderItem[];
  total: number;
  canCancel: boolean;
}

function totalOf(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

function toView(order: Order, items: OrderItem[]): OrderView {
  return {
    ...order,
    items,
    total: totalOf(items),
    // SEEDED DEFECT B (duplicated rule, copy 3 of 3): the storefront shows a
    // cancel button from this flag, using yet another list of statuses.
    canCancel: order.status === "PENDING",
  };
}

export function getOrder(db: Db, orderId: string): OrderView {
  const order = db.findOrder(orderId);
  if (!order) throw new NotFoundError("Order");
  return toView(order, db.itemsForOrder(order.id));
}

/** Admin order list with totals. */
export function listOrders(db: Db): OrderView[] {
  const orders = db.listOrders();
  // SEEDED DEFECT C: one extra query per order (N+1) to load its items.
  return orders.map((order) => toView(order, db.itemsForOrder(order.id)));
}
