/**
 * The order status graph. This is the ONLY place that knows which status
 * moves are legal. See AGENTS.md rule 1.
 */

export const ORDER_STATUSES = [
  "PENDING",
  "PAID",
  "READY",
  "DISPATCHED",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

interface Transition {
  readonly from: readonly OrderStatus[];
  readonly to: OrderStatus;
}

export const TRANSITIONS = {
  pay: { from: ["PENDING"], to: "PAID" },
  markReady: { from: ["PAID"], to: "READY" },
  dispatch: { from: ["READY"], to: "DISPATCHED" },
  undispatch: { from: ["DISPATCHED"], to: "READY" },
  pickUp: { from: ["DISPATCHED"], to: "IN_TRANSIT" },
  deliver: { from: ["IN_TRANSIT"], to: "DELIVERED" },
  cancel: { from: ["PENDING", "PAID", "READY"], to: "CANCELLED" },
} as const satisfies Record<string, Transition>;

export type TransitionName = keyof typeof TRANSITIONS;

export class IllegalTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly transition: TransitionName,
  ) {
    super(`Illegal transition "${transition}" from ${from}`);
    this.name = "IllegalTransitionError";
  }
}

export function canFire(from: OrderStatus, transition: TransitionName): boolean {
  const allowed: readonly OrderStatus[] = TRANSITIONS[transition].from;
  return allowed.includes(from);
}

/** Returns the status after `transition`, or throws if the move is illegal. */
export function nextStatus(
  from: OrderStatus,
  transition: TransitionName,
): OrderStatus {
  if (!canFire(from, transition)) {
    throw new IllegalTransitionError(from, transition);
  }
  return TRANSITIONS[transition].to;
}
