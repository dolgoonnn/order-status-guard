import {
  canFire,
  IllegalTransitionError,
  type OrderStatus,
} from "../domain/status.js";
import { NotAllowedError, NotFoundError } from "../errors.js";
import type { Db, DeliveryRun } from "../store.js";
import { changeStatusForHuman } from "./status-change.js";

/** Batches READY orders into one courier run. Goes through the status graph. */
export function dispatchRun(db: Db, orderIds: string[]): DeliveryRun {
  if (orderIds.length === 0) {
    throw new NotAllowedError("A run needs at least one order");
  }
  const run: DeliveryRun = {
    id: db.nextId("run"),
    orderIds: [...orderIds],
    state: "DISPATCHED",
  };
  // Check every order first, so an illegal one leaves the others untouched.
  for (const orderId of orderIds) {
    const order = db.findOrder(orderId);
    if (!order) throw new NotFoundError("Order");
    if (!canFire(order.status, "dispatch")) {
      throw new IllegalTransitionError(order.status, "dispatch");
    }
  }
  for (const orderId of orderIds) {
    changeStatusForHuman(db, orderId, "dispatch", { runId: run.id });
  }
  db.insertRun(run);
  return run;
}

export interface CancelRunResult extends DeliveryRun {
  /** Orders that were still DISPATCHED and went back to READY. */
  released: string[];
  /** Orders the courier had already moved on; left exactly as they were. */
  left: { orderId: string; status: OrderStatus }[];
}

/**
 * Cancels a courier run, so its still-DISPATCHED orders can be batched again.
 * The courier may already have picked up or delivered some of them; those are
 * left untouched and reported.
 */
export function cancelRun(db: Db, runId: string): CancelRunResult {
  const run = db.findRun(runId);
  if (!run) throw new NotFoundError("Run");
  if (run.state === "CANCELLED") {
    throw new NotAllowedError("Run is already cancelled");
  }
  const released: string[] = [];
  const left: CancelRunResult["left"] = [];
  for (const orderId of run.orderIds) {
    const order = db.findOrder(orderId);
    if (!order) throw new NotFoundError("Order");
    // An order handed to a newer run is no longer this run's to release.
    const result =
      order.runId === run.id
        ? db.transition(orderId, "undispatch", { runId: null })
        : null;
    if (result?.applied) {
      released.push(orderId);
    } else {
      left.push({ orderId, status: order.status });
    }
  }
  db.updateRun(run.id, { state: "CANCELLED" });
  return { ...run, state: "CANCELLED", released, left };
}
