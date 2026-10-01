/**
 * Validate a committed contract set in place.
 *
 * Unlike `publish()`, which derives projections, this reads what is on disk and
 * checks it:
 *
 *   - every contract validates against the committed format schema;
 *   - every Knapsack projection validates against the target's vendored schema;
 *   - the Knapsack manifest validates and its content addresses verify;
 *   - `index.json`'s content addresses verify;
 *   - the DSDS projection is present and well-formed.
 *
 * This is what CI runs (fast, no browser). The full regeneration-and-diff check
 * is `bin/verify.mjs`.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

import { verifyAddress } from "./canonical.mjs";

const CONTRACTS_DIR = fileURLToPath(new URL("..", import.meta.url));

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const formatErrors = (errors) =>
  (errors ?? [])
    .slice(0, 5)
    .map((error) => `${error.instancePath || "/"} ${error.message}`)
    .join("; ");

/**
 * @param {string} dir a contract set: `index.json`, `{id}.contract.json`,
 *   `knapsack/`, `dsds/`
 * @returns {{ ok: boolean, failures: string[], counts: object }}
 */
export function validateCommittedSet(dir) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validateContract = ajv.compile(
    readJson(join(CONTRACTS_DIR, "schema/contract.schema.json")),
  );
  const validateKnapsackContract = ajv.compile(
    readJson(join(CONTRACTS_DIR, "vendor/knapsack/component.contract.schema.json")),
  );
  const validateKnapsackManifest = ajv.compile(
    readJson(join(CONTRACTS_DIR, "vendor/knapsack/manifest.schema.json")),
  );
  const validateNarrative = ajv.compile(
    readJson(join(CONTRACTS_DIR, "schema/narrative.schema.json")),
  );

  const failures = [];
  const check = (label, validate, value) => {
    if (validate(value)) return true;
    failures.push(`${label}: ${formatErrors(validate.errors)}`);
    return false;
  };

  const indexPath = join(dir, "index.json");
  if (!existsSync(indexPath)) {
    return { ok: false, failures: [`no index.json under ${dir}`], counts: {} };
  }

  const index = readJson(indexPath);
  if (
    typeof index !== "object" ||
    index === null ||
    !Array.isArray(index.artifacts)
  ) {
    return { ok: false, failures: ["index.json has no artifacts array"], counts: {} };
  }

  let contracts = 0;
  let knapsack = 0;
  let addresses = 0;
  let narratives = 0;

  for (const artifact of index.artifacts) {
    const contract = readJson(join(dir, artifact.path));
    if (check(`contract ${artifact.contractId}`, validateContract, contract)) {
      contracts++;
    }

    const verdict = verifyAddress(contract, artifact.address);
    if (verdict.ok) addresses++;
    else {
      failures.push(
        `index address ${artifact.path}: expected ${verdict.expected}, got ${verdict.actual}`,
      );
    }

    const projected = readJson(
      join(dir, "knapsack", `${artifact.contractId}.contract.json`),
    );
    if (
      check(
        `knapsack ${artifact.contractId}`,
        validateKnapsackContract,
        projected,
      )
    ) {
      knapsack++;
    }

    // Narratives are optional (Pass 4, §5.12) and advisory, but when present
    // they must satisfy their own schema and belong to this component.
    const narrativePath = join(dir, `${artifact.contractId}.narrative.json`);
    if (existsSync(narrativePath)) {
      const narrative = readJson(narrativePath);
      if (check(`narrative ${artifact.contractId}`, validateNarrative, narrative)) {
        narratives++;
        if (narrative.component !== contract.component) {
          failures.push(
            `narrative ${artifact.contractId}: component "${narrative.component}" does not match contract "${contract.component}"`,
          );
        }
      }
    }
  }

  const manifest = readJson(join(dir, "knapsack", "manifest.json"));
  if (check("knapsack manifest", validateKnapsackManifest, manifest)) {
    for (const artifact of manifest.artifacts) {
      const target = readJson(join(dir, "knapsack", artifact.path));
      const verdict = verifyAddress(target, artifact.address);
      if (!verdict.ok) {
        failures.push(
          `manifest address ${artifact.path}: expected ${verdict.expected}, got ${verdict.actual}`,
        );
      }
    }
  }

  const dsds = readJson(join(dir, "dsds", "specs.json"));
  if (typeof dsds !== "object" || dsds === null || !Array.isArray(dsds.components)) {
    failures.push("dsds/specs.json has no components array");
  }

  return {
    ok: failures.length === 0,
    failures,
    counts: {
      contracts,
      knapsack,
      addresses,
      narratives,
      manifest: Array.isArray(manifest?.artifacts) ? manifest.artifacts.length : 0,
      dsds: Array.isArray(dsds?.components) ? dsds.components.length : 0,
      expected: index.artifacts.length,
    },
  };
}
