import test from "node:test";
import assert from "node:assert/strict";
import { assertConserved, byId, scenario } from "../helpers/scenario_helpers.ts";

test("allocation assigns free and reserved fragments to routes", () => {
  const payload = scenario("allocation");

  assert.equal(payload.scenario, "allocation");
  assert.equal(payload.metrics.active_reserved, 300_000);
  assert.equal(payload.metrics.active_free, 700_000);
  assert.equal(payload.metrics.route_north, 430_000);
  assert.equal(payload.metrics.route_south, 220_000);
  assert.equal(payload.metrics.unallocated_free, 350_000);
  assert.equal(payload.metrics.largest_route, 430_000);
  assert.equal(payload.metrics.route_headroom, 4_450_000);
  assert.equal(payload.metrics.route_active_total, 650_000);
  assert.equal(payload.metrics.route_committed_total, 300_000);
  assert.equal(payload.metrics.active_routes, 2);
  assert.equal(payload.flags.routes_within_capacity, true);
  assert.equal(payload.audit.underbacked_obligations, 0);
  assert.equal(byId(payload.obligations, "invoice-1001").amount, 180_000);
  assert.equal(byId(payload.obligations, "invoice-1002").amount, 120_000);
  assertConserved(payload);
});
