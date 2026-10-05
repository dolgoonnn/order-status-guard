import type { Db } from "../store.js";
import { changeStatusForEvent, type EventOutcome } from "./status-change.js";

/**
 * Called by the billing service when an invoice is paid. Billing retries its
 * webhooks, so the same event can arrive more than once; a repeat or late
 * event changes nothing and says so.
 */
export function handleInvoicePaid(db: Db, orderId: string): EventOutcome {
  return changeStatusForEvent(db, orderId, "pay");
}
