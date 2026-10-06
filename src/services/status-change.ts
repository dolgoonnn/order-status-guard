import { IllegalTransitionError, type TransitionName } from "../domain/status.js";
import { NotFoundError } from "../errors.js";
import type { Db, Order, OrderPatch } from "../store.js";

/**
 * Status change for a person (customer, admin). An illegal move throws
 * IllegalTransitionError, which the app answers with 409 and the reason.
 */
export function changeStatusForHuman(
  db: Db,
  orderId: string,
  transition: TransitionName,
  patch: OrderPatch = {},
): Order {
  const result = db.transition(orderId, transition, patch);
  if (result.applied) return result.order;
  if (result.reason === "not_found") throw new NotFoundError("Order");
  throw new IllegalTransitionError(result.order.status, transition);
}

export type EventOutcome =
  | { applied: true; order: Order }
  | { applied: false; reason: string; order: Order };

/**
 * Status change for another service (billing, carrier). They retry and can
 * deliver late, so an illegal move is not an error: nothing changes and the
 * outcome says it was not applied.
 */
export function changeStatusForEvent(
  db: Db,
  orderId: string,
  transition: TransitionName,
): EventOutcome {
  const result = db.transition(orderId, transition);
  if (result.applied) return { applied: true, order: result.order };
  if (result.reason === "not_found") throw new NotFoundError("Order");
  return {
    applied: false,
    reason: `"${transition}" is not legal from ${result.order.status}`,
    order: result.order,
  };
}
