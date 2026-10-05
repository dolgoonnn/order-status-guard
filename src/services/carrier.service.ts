import type { OrderStatus } from "../domain/status.js";
import { NotAllowedError, NotFoundError } from "../errors.js";
import type { Db, Order } from "../store.js";

export const CARRIER_EVENTS = [
  "PICKED_UP",
  "DELIVERED",
  "RETURNED_TO_DEPOT",
] as const;

export type CarrierEvent = (typeof CARRIER_EVENTS)[number];

const STATUS_BY_EVENT: Record<CarrierEvent, OrderStatus> = {
  PICKED_UP: "IN_TRANSIT",
  DELIVERED: "DELIVERED",
  RETURNED_TO_DEPOT: "READY",
};

export function isCarrierEvent(value: unknown): value is CarrierEvent {
  return (
    typeof value === "string" &&
    (CARRIER_EVENTS as readonly string[]).includes(value)
  );
}

/**
 * Called by the carrier's webhook. Carrier events can arrive late or out of
 * order.
 */
export function handleCarrierEvent(
  db: Db,
  orderId: string,
  event: CarrierEvent,
): Order {
  const order = db.findOrder(orderId);
  if (!order) throw new NotFoundError("Order");
  if (order.status === "CANCELLED") {
    throw new NotAllowedError("Order is cancelled");
  }
  // SEEDED DEFECT A3: writes the mapped status directly instead of using the
  // graph. A late PICKED_UP after DELIVERED moves the order back to IN_TRANSIT.
  const status = STATUS_BY_EVENT[event];
  db.updateOrder(order.id, { status });
  return { ...order, status };
}
