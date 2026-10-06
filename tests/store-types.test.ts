import { describe, expectTypeOf, it } from "vitest";
import type { OrderStatus } from "../src/domain/status.js";
import type { Db } from "../src/store.js";

type UpdateOrderPatch = Parameters<Db["updateOrder"]>[1];
type UpdateOrdersPatch = Parameters<Db["updateOrders"]>[1];

// These are checked by `pnpm typecheck` (tsc covers tests/). If a general
// update method accepts `status` again, the file stops compiling.
describe("general store updates cannot write a status", () => {
  it("updateOrder rejects a status field", () => {
    expectTypeOf<{ status: OrderStatus }>().not.toMatchTypeOf<UpdateOrderPatch>();
    expectTypeOf<{ status: OrderStatus; runId: null }>().not.toMatchTypeOf<UpdateOrderPatch>();
    expectTypeOf<{ runId: null }>().toMatchTypeOf<UpdateOrderPatch>();
  });

  it("updateOrders rejects a status field", () => {
    expectTypeOf<{ status: OrderStatus }>().not.toMatchTypeOf<UpdateOrdersPatch>();
    expectTypeOf<{ runId: null }>().toMatchTypeOf<UpdateOrdersPatch>();
  });
});
