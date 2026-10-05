import { nextStatus } from "../domain/status.js";
import { NotAllowedError, NotFoundError } from "../errors.js";
import type { Db, DeliveryRun } from "../store.js";

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
  for (const orderId of orderIds) {
    const order = db.findOrder(orderId);
    if (!order) throw new NotFoundError("Order");
    const status = nextStatus(order.status, "dispatch");
    db.updateOrder(order.id, { status, runId: run.id });
  }
  db.insertRun(run);
  return run;
}

/**
 * Cancels a courier run, so its orders can be batched again. The courier may
 * already have picked up or delivered some of them.
 */
export function cancelRun(db: Db, runId: string): DeliveryRun {
  const run = db.findRun(runId);
  if (!run) throw new NotFoundError("Run");
  if (run.state === "CANCELLED") {
    throw new NotAllowedError("Run is already cancelled");
  }
  // SEEDED DEFECT A1: writes the status directly to every member instead of
  // using the graph. Orders already IN_TRANSIT or DELIVERED go back to READY.
  db.updateOrders(run.orderIds, { status: "READY", runId: null });
  db.updateRun(run.id, { state: "CANCELLED" });
  return { ...run, state: "CANCELLED" };
}
