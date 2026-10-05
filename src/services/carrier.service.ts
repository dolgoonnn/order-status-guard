import type { TransitionName } from "../domain/status.js";
import type { Db } from "../store.js";
import { changeStatusForEvent, type EventOutcome } from "./status-change.js";

export const CARRIER_EVENTS = [
  "PICKED_UP",
  "DELIVERED",
  "RETURNED_TO_DEPOT",
] as const;

export type CarrierEvent = (typeof CARRIER_EVENTS)[number];

const TRANSITION_BY_EVENT: Record<CarrierEvent, TransitionName> = {
  PICKED_UP: "pickUp",
  DELIVERED: "deliver",
  RETURNED_TO_DEPOT: "undispatch",
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
  return changeStatusForEvent(db, orderId, TRANSITION_BY_EVENT[event]);
}
