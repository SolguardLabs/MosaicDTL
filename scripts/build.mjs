import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const buildDir = join(root, "build");
const isWindows = process.platform === "win32";
const output = join(buildDir, isWindows ? "mosaicdtl.exe" : "mosaicdtl");

function commandWorks(command, args = ["--version"]) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8", shell: false });
  return result.status === 0;
}

function findWindowsClang() {
  if (!isWindows) {
    return [];
  }
  const roots = [];
  if (process.env.LOCALAPPDATA) {
    roots.push(join(process.env.LOCALAPPDATA, "Programs"));
  }
  roots.push(process.env.ProgramFiles || "");
  roots.push(process.env["ProgramFiles(x86)"] || "");
  const candidates = [];
  const direct = [
    join(process.env.ProgramFiles || "C:\\Program Files", "LLVM", "bin", "clang++.exe"),
    "C:\\msys64\\mingw64\\bin\\g++.exe",
  ];
  for (const candidate of direct) {
    if (existsSync(candidate)) {
      candidates.push(candidate);
    }
  }
  for (const base of roots) {
    if (!base || !existsSync(base)) {
      continue;
    }
    const stack = [base];
    while (stack.length > 0) {
      const current = stack.pop();
      let entries = [];
      try {
        entries = readdirSync(current, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const full = join(current, entry.name);
        if (entry.isDirectory()) {
          if (/LLVM|clang|bin/i.test(full) && full.length < 180) {
            stack.push(full);
          }
        } else if (entry.name.toLowerCase() === "clang++.exe") {
          candidates.push(full);
        }
      }
    }
  }
  return candidates;
}

function pickCompiler() {
  const requested = process.env.CXX;
  const candidates = requested ? [requested] : ["c++", "g++", "clang++", ...findWindowsClang()];
  for (const candidate of candidates) {
    if (commandWorks(candidate)) {
      return candidate;
    }
  }
  throw new Error("No C++ compiler found. Set CXX or install clang++/g++.");
}

mkdirSync(buildDir, { recursive: true });
const sources = readdirSync(join(root, "src"))
  .filter((name) => name.endsWith(".cpp"))
  .sort()
  .map((name) => join(root, "src", name));

const compiler = pickCompiler();
const args = ["-std=c++17", "-Wall", "-Wextra", "-O2", "-Isrc", ...sources, "-o", output];

const result = spawnSync(compiler, args, { cwd: root, stdio: "inherit", shell: false });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(output);
