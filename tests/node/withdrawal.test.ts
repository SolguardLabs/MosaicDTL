import test from "node:test";
import assert from "node:assert/strict";
import { assertConserved, scenario } from "../helpers/scenario_helpers.ts";

test("withdrawal consumes only liquidity classified as free", () => {
  const payload = scenario("withdrawal");

  assert.equal(payload.scenario, "withdrawal");
  assert.equal(payload.metrics.withdrawn, 150_000);
  assert.equal(payload.metrics.active_reserved, 300_000);
  assert.equal(payload.flags.reserved_backing_survived, true);
  assert.equal(payload.audit.underbacked_obligations, 0);
  assert.equal(payload.audit.active_free, 550_000);
  assertConserved(payload);
});
