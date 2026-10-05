import type { TransitionName } from "../domain/status.js";
import { NotFoundError } from "../errors.js";
import type { Db } from "../store.js";
import { changeStatusForEvent, type EventOutcome } from "./status-change.js";

export const CARRIER_EVENTS = [
  "PICKED_UP",
  "DELIVERED",
  "RETURNED_TO_DEPOT",
] as const;

export type CarrierEvent = (typeof CARRIER_EVENTS)[number];

/**
 * RETURNED_TO_DEPOT has no move: READY means packed at our warehouse, and a
 * parcel at the carrier's depot is not that. Returns need their own move in
 * the graph, which is a separate decision.
 */
const TRANSITION_BY_EVENT: Record<CarrierEvent, TransitionName | null> = {
  PICKED_UP: "pickUp",
  DELIVERED: "deliver",
  RETURNED_TO_DEPOT: null,
};

export function isCarrierEvent(value: unknown): value is CarrierEvent {
  return (
    typeof value === "string" &&
    (CARRIER_EVENTS as readonly string[]).includes(value)
  );
}

/**
 * Called by the carrier's webhook. Carrier events can arrive late or out of
 * order; one with no legal move from the current status changes nothing and
 * says so.
 */
export function handleCarrierEvent(
  db: Db,
  orderId: string,
  event: CarrierEvent,
): EventOutcome {
  const transition = TRANSITION_BY_EVENT[event];
  if (transition === null) {
    const order = db.findOrder(orderId);
    if (!order) throw new NotFoundError("Order");
    return {
      applied: false,
      reason: `"${event}" has no move in the status graph`,
      order,
    };
  }
  return changeStatusForEvent(db, orderId, transition);
}
