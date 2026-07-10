import { rmSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const temp = join(root, ".test-build");

function collect(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collect(full));
    } else if (entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

rmSync(temp, { recursive: true, force: true });
mkdirSync(temp, { recursive: true });

for (const source of collect(join(root, "tests"))) {
  const relative = source.slice(join(root, "tests").length + 1);
  const target = join(temp, relative).replace(/\.ts$/u, ".mjs");
  mkdirSync(dirname(target), { recursive: true });
  const transformed = readFileSync(source, "utf8").replace(/\.ts(["'])/gu, ".mjs$1");
  writeFileSync(target, transformed);
}

const build = spawnSync(process.execPath, ["scripts/build.mjs"], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const testFiles = collect(join(root, "tests"))
  .filter((file) => file.endsWith(".test.ts"))
  .map((file) => join(temp, file.slice(join(root, "tests").length + 1)).replace(/\.ts$/u, ".mjs"));

for (const file of testFiles) {
  if (!existsSync(file)) {
    throw new Error("missing transformed test file " + file);
  }
}

const result = spawnSync(process.execPath, ["--test", ...testFiles], {
  cwd: root,
  stdio: "inherit",
  shell: false,
});
process.exit(result.status ?? 1);
