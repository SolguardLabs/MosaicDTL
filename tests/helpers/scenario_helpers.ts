import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const binary = join(root, "build", process.platform === "win32" ? "mosaicdtl.exe" : "mosaicdtl");
let built = false;
const cache = new Map();

function ensureBuilt() {
  if (existsSync(binary)) {
    built = true;
    return;
  }
  execFileSync(process.execPath, ["scripts/build.mjs"], {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
    timeout: 120_000,
  });
  built = true;
}

export function scenario(name) {
  if (!cache.has(name)) {
    ensureBuilt();
    const stdout = execFileSync(binary, ["scenario", name], {
      cwd: root,
      encoding: "utf8",
      timeout: 120_000,
    });
    cache.set(name, JSON.parse(stdout));
  }
  return cache.get(name);
}

export function byId(items, id) {
  const value = items.find((item) => item.id === id);
  assert.ok(value, "missing item " + id);
  return value;
}

export function assertConserved(payload) {
  assert.equal(payload.audit.deposited, 1_000_000);
  assert.equal(payload.audit.nominal_accounted, 1_000_000);
  assert.equal(payload.audit.nominal_conserved, true);
}
