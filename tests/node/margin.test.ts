import test from "node:test";
import assert from "node:assert/strict";
import { assertConserved, scenario } from "../helpers/scenario_helpers.ts";

test("margin staging and route stress reconcile with executed obligation", () => {
  const payload = scenario("margin");

  assert.equal(payload.scenario, "margin");
  assert.equal(payload.metrics.margin_principal, 400_000);
  assert.equal(payload.metrics.margin_reserved, 650_000);
  assert.equal(payload.metrics.modeled_stress, 137_886);
  assert.equal(payload.metrics.margin_releasable, 112_114);
  assert.equal(payload.metrics.withdrawn, 50_000);
  assert.equal(payload.metrics.realized_stress, 82_500);
  assert.equal(payload.metrics.impaired, 82_500);
  assert.equal(payload.metrics.executed, 400_000);
  assert.equal(payload.flags.obligation_paid, true);
  assert.equal(payload.audit.impaired, 82_500);
  assert.equal(payload.audit.active_reserved, 117_500);
  assert.equal(payload.audit.underbacked_obligations, 0);
  assert.deepEqual(
    payload.events
      .map((event) => event.kind)
      .filter((kind) =>
        ["margin_posted", "margin_released", "stress_realized", "execution"].includes(kind),
      ),
    ["margin_posted", "margin_posted", "margin_released", "stress_realized", "execution"],
  );
  assertConserved(payload);
});
