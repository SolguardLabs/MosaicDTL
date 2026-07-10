import test from "node:test";
import assert from "node:assert/strict";
import { assertConserved, scenario } from "../helpers/scenario_helpers.ts";

test("consolidation checks totals and produces one target route fragment", () => {
  const payload = scenario("consolidation");

  assert.equal(payload.scenario, "consolidation");
  assert.equal(payload.receipts.length, 1);
  assert.equal(payload.receipts[0].total_amount, 400_000);
  assert.equal(payload.receipts[0].free_amount, 400_000);
  assert.equal(payload.receipts[0].reserved_amount, 0);
  assert.equal(payload.receipts[0].target_route_id, "route-merge");
  assert.equal(payload.flags.receipt_total_checked, true);
  assert.equal(payload.flags.origin_preserved, true);
  assert.equal(payload.audit.active_reserved, 0);
  assertConserved(payload);
});
