#!/usr/bin/env node
/**
 * Verify that the committed contract set reproduces exactly.
 *
 *   node scripts/contracts/bin/verify.mjs [--contracts contracts] [--quiet]
 *
 * The full check, and the slow one: it regenerates the declared-default
 * stories, rebuilds Storybook from them, derives the contracts from a fresh
 * browser pass, and diffs the result against `contracts/`. Any difference is a
 * failure — the committed set is stale, or the derivation is not deterministic.
 *
 * Needs Playwright's Chromium and a working Storybook build; it is not part of
 * every CI run for that reason. The fast per-PR check is `bin/validate.mjs`.
 */

import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, "../../..");

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1] ?? true);
};
const QUIET = argv.includes("--quiet");
const COMMITTED = resolve(PACKAGE_ROOT, flag("contracts", "contracts"));

const run = (label, command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: PACKAGE_ROOT,
    stdio: QUIET ? ["ignore", "ignore", "inherit"] : "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.status !== 0) {
    console.error(`\n${label} failed (exit ${result.status ?? "signal"}).`);
    process.exit(1);
  }
};

const generate = (args) => {
  const result = spawnSync("node", [join(HERE, "generate.mjs"), ...args], {
    cwd: PACKAGE_ROOT,
    stdio: QUIET ? ["ignore", "ignore", "inherit"] : "inherit",
  });
  if (result.status !== 0) {
    console.error(`\ngenerate ${args.join(" ")} failed.`);
    process.exit(1);
  }
};

/** Every file under `dir`, relative and sorted. */
const filesUnder = (dir) => {
  const files = [];
  const walk = (current) => {
    for (const name of readdirSync(current).sort()) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(relative(dir, full));
    }
  };
  walk(dir);
  return files;
};

const OUT = mkdtempSync(join(tmpdir(), "kickstartds-contracts-verify-"));

try {
  if (!QUIET) console.log("\n1/4  declared-default stories");
  generate(["--emit-stories", "--quiet"]);

  if (!QUIET) console.log("2/4  Storybook");
  run("build-storybook", "pnpm", ["run", "build-storybook"]);

  if (!QUIET) console.log("3/4  derive contracts (fresh observation)");
  // Seed the committed narratives into the temp set before deriving, so the
  // regenerated briefs include their prose. The diff then excludes the
  // narratives themselves (model output is not reproducible) but still compares
  // the briefs derived from them.
  for (const name of readdirSync(COMMITTED)) {
    if (name.endsWith(".narrative.json")) {
      copyFileSync(join(COMMITTED, name), join(OUT, name));
    }
  }
  generate(["--out", OUT, "--quiet"]);

  if (!QUIET) console.log("4/4  diff against the committed set");
  // Narratives are model-generated and explicitly outside the determinism
  // guarantee (PRD §5.12, §6.4): they are compared for existence, not bytes.
  const isNarrative = (file) => file.endsWith(".narrative.json");
  const expected = filesUnder(COMMITTED).filter((file) => !isNarrative(file));
  const actual = filesUnder(OUT).filter((file) => !isNarrative(file));
  const differences = [];

  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  for (const file of expected) if (!actualSet.has(file)) differences.push(`missing: ${file}`);
  for (const file of actual) if (!expectedSet.has(file)) differences.push(`unexpected: ${file}`);
  for (const file of expected) {
    if (!actualSet.has(file)) continue;
    const a = readFileSync(join(COMMITTED, file));
    const b = readFileSync(join(OUT, file));
    if (!a.equals(b)) differences.push(`differs: ${file}`);
  }

  if (differences.length) {
    console.error(
      `\ncommitted contracts do not reproduce — ${differences.length} difference(s):`,
    );
    for (const difference of differences.slice(0, 40)) {
      console.error(`  ✗ ${difference}`);
    }
    if (differences.length > 40) {
      console.error(`  … ${differences.length - 40} more`);
    }
    console.error(
      "\nCommit the regenerated set (contracts/) or fix the non-determinism.",
    );
    process.exit(1);
  }

  console.log(`\nverified: ${expected.length} files reproduce byte-for-byte\n`);
} finally {
  rmSync(OUT, { recursive: true, force: true });
}
