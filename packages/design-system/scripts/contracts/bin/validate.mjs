#!/usr/bin/env node
/**
 * Validate the committed contract set without regenerating it.
 *
 *   node scripts/contracts/bin/validate.mjs [--in contracts] [--quiet]
 *
 * Fast enough for every CI run: no browser, no Storybook. Catches a hand-edited
 * contract, a schema that moved underneath the set, and an address that no
 * longer matches its file. The full regeneration-and-diff check is
 * `bin/verify.mjs`.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateCommittedSet } from "../lib/validate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, "../../..");

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1] ?? true);
};

const IN = resolve(PACKAGE_ROOT, flag("in", "contracts"));
const QUIET = argv.includes("--quiet");

const { ok, failures, counts } = validateCommittedSet(IN);

if (!QUIET) {
  console.log(`\ncontract set  ${IN}`);
  console.log(
    `  contracts  ${counts.contracts}/${counts.expected}` +
      `  knapsack ${counts.knapsack}/${counts.expected}` +
      `  addresses ${counts.addresses}/${counts.expected}` +
      `  narratives ${counts.narratives}` +
      `  manifest ${counts.manifest}` +
      `  dsds ${counts.dsds}`,
  );
}

if (!ok) {
  console.error(`\n${failures.length} failure(s):`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}

if (!QUIET) console.log("\nvalid\n");
