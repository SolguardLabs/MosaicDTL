import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scenario } from "../helpers/scenario_helpers.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const binary = join(root, "build", process.platform === "win32" ? "mosaicdtl.exe" : "mosaicdtl");

test("cli lists deterministic scenarios", () => {
  scenario("allocation");
  const stdout = execFileSync(binary, ["list"], { cwd: root, encoding: "utf8" });
  const payload = JSON.parse(stdout);

  assert.equal(payload.protocol, "MosaicDTL");
  assert.deepEqual(payload.scenarios, [
    "allocation",
    "withdrawal",
    "consolidation",
    "route-close",
    "provenance-leak",
  ]);
});
