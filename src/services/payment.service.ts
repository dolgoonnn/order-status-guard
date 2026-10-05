import { NotFoundError } from "../errors.js";
import type { Db, Order } from "../store.js";

/**
 * Called by the billing service when an invoice is paid. Billing retries its
 * webhooks, so the same event can arrive more than once.
 */
export function handleInvoicePaid(db: Db, orderId: string): Order {
  const order = db.findOrder(orderId);
  if (!order) throw new NotFoundError("Order");
  // SEEDED DEFECT A2: writes the status directly instead of using the graph.
  // A duplicate or late callback moves a DELIVERED or CANCELLED order to PAID.
  db.updateOrder(order.id, { status: "PAID" });
  return { ...order, status: "PAID" };
}
