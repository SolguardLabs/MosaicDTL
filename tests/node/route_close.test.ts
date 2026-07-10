import test from "node:test";
import assert from "node:assert/strict";
import { assertConserved, byId, scenario } from "../helpers/scenario_helpers.ts";

test("route closure is allowed after active fragments are consolidated away", () => {
  const payload = scenario("route-close");

  assert.equal(payload.scenario, "route-close");
  assert.equal(payload.flags.route_closed, true);
  assert.equal(payload.metrics.route_retire_active, 0);
  assert.equal(payload.metrics.route_merge_active, 200_000);
  assert.equal(byId(payload.routes, "route-retire").state, "closed");
  assert.equal(payload.labels.closed_route, "route-retire");
  assertConserved(payload);
});
