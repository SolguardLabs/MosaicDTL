import test from "node:test";
import assert from "node:assert/strict";
import { assertConserved, byId, scenario } from "../helpers/scenario_helpers.ts";

test("consolidation preserves free and committed outputs by origin", () => {
  const payload = scenario("consolidation");

  assert.equal(payload.scenario, "consolidation");
  assert.equal(payload.receipts.length, 1);
  assert.equal(payload.receipts[0].total_amount, 500_000);
  assert.equal(payload.receipts[0].free_amount, 400_000);
  assert.equal(payload.receipts[0].reserved_amount, 100_000);
  assert.equal(payload.receipts[0].output_fragment_ids.length, 2);
  const outputs = payload.receipts[0].output_fragment_ids.map((id) => byId(payload.fragments, id));
  assert.deepEqual(
    outputs.map((fragment) => [fragment.kind, fragment.amount, fragment.obligation_id]),
    [
      ["free", 400_000, ""],
      ["reserved", 100_000, "invoice-merge"],
    ],
  );
  assert.equal(payload.receipts[0].target_route_id, "route-merge");
  assert.equal(payload.flags.receipt_total_checked, true);
  assert.equal(payload.flags.origin_preserved, true);
  assert.equal(payload.flags.invoice_backed, true);
  assert.equal(payload.audit.active_reserved, 100_000);
  assertConserved(payload);
});
