#!/usr/bin/env node
/**
 * Pass 4 — generate component narratives (PRD §5.12).
 *
 *   node scripts/contracts/bin/narrate.mjs [options]
 *
 *   --contracts <dir>    contract set to read (default: contracts)
 *   --screenshots <dir>  screenshot root (default: static)
 *   --only a,b           restrict to these contract ids
 *   --model <id>         override the vision model (default: $NARRATIVE_MODEL or gpt-4o-2024-08-06)
 *   --base-url <url>     OpenAI-compatible endpoint (default: $OPENAI_BASE_URL or api.openai.com/v1)
 *   --dry-run            list what would be generated; no model calls, no writes
 *   --force              regenerate even when inputs are unchanged
 *   --quiet              summary only
 *
 * Requires `OPENAI_API_KEY` (unless `--dry-run`). Also rewrites each affected
 * `brief.md`, because the brief is where the prose is surfaced (§8.2) and it is
 * derived from the committed contract plus the narrative — no re-derivation of
 * the contract is needed or done.
 *
 * Narratives are committed and excluded from `contracts:verify`'s byte diff:
 * model output is not reproducible, which is exactly why it lives in its own
 * file (PRD §5.12, §6.4).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildBrief } from "../lib/brief.mjs";
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  PROMPT_VERSION,
  createOpenAiCaptioner,
  narrateComponent,
  narrativeInputs,
  narrativeUpToDate,
} from "../lib/narrative.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(HERE, "../../..");

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1] ?? true);
};

const CONTRACTS_DIR = resolve(PACKAGE_ROOT, flag("contracts", "contracts"));
const SCREENSHOTS_ROOT = resolve(PACKAGE_ROOT, flag("screenshots", "static"));
const ONLY = flag("only", null);
const MODEL = String(flag("model", process.env.NARRATIVE_MODEL ?? DEFAULT_MODEL));
const BASE_URL = String(
  flag("base-url", process.env.OPENAI_BASE_URL ?? DEFAULT_BASE_URL),
);
const DRY_RUN = argv.includes("--dry-run");
const FORCE = argv.includes("--force");
const QUIET = argv.includes("--quiet");

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path, value) => {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
};

const API_KEY = process.env.OPENAI_API_KEY;
if (!DRY_RUN && !API_KEY) {
  console.error(
    "OPENAI_API_KEY is not set. Pass --dry-run to see what would be generated.",
  );
  process.exit(1);
}

const indexPath = join(CONTRACTS_DIR, "index.json");
if (!existsSync(indexPath)) {
  console.error(`no contract set at ${CONTRACTS_DIR} (index.json missing)`);
  process.exit(1);
}

const allIds = readJson(indexPath).artifacts.map((artifact) => artifact.contractId);
const selected = ONLY ? String(ONLY).split(",").map((s) => s.trim()) : allIds;
const unknown = selected.filter((id) => !allIds.includes(id));
if (unknown.length) {
  console.error(`not in the contract set: ${unknown.join(", ")}`);
  process.exit(1);
}

const caption = API_KEY
  ? createOpenAiCaptioner({ apiKey: API_KEY, model: MODEL, baseUrl: BASE_URL })
  : null;

if (!QUIET) {
  console.log(`\ncomponent narratives`);
  console.log(`  contracts   ${CONTRACTS_DIR}`);
  console.log(`  screenshots ${SCREENSHOTS_ROOT}`);
  console.log(`  model       ${MODEL}${DRY_RUN ? " (dry run)" : ""}`);
  if (BASE_URL !== DEFAULT_BASE_URL) console.log(`  base url    ${BASE_URL}`);
  console.log(`  ids         ${selected.length}\n`);
}

const summary = { generated: 0, unchanged: 0, empty: 0, failed: 0 };
const problems = [];

for (const id of selected) {
  const contractFile = join(CONTRACTS_DIR, `${id}.contract.json`);
  const contract = readJson(contractFile);
  const inputs = narrativeInputs(contract, { screenshotsRoot: SCREENSHOTS_ROOT });

  const narrativeFile = join(CONTRACTS_DIR, `${id}.narrative.json`);
  const existing = existsSync(narrativeFile) ? readJson(narrativeFile) : null;

  if (!FORCE && narrativeUpToDate(existing, inputs, { model: MODEL, promptVersion: PROMPT_VERSION })) {
    summary.unchanged++;
    if (!QUIET) console.log(`  ${id.padEnd(22)} unchanged`);
    continue;
  }

  const hasScreenshot = (relative) =>
    Boolean(relative) && Object.hasOwn(inputs.screenshots, relative);
  const describable =
    (hasScreenshot(contract.default?.evidence?.screenshot) ? 1 : 0) +
    (contract.variants ?? []).filter((variant) =>
      hasScreenshot(variant.evidence?.screenshot),
    ).length;

  if (DRY_RUN) {
    console.log(
      `  ${id.padEnd(22)} would describe ${describable} item(s)` +
        (inputs.missing.length ? `  ⚠ ${inputs.missing.length} screenshot(s) missing` : ""),
    );
    continue;
  }

  if (describable === 0) {
    summary.empty++;
    problems.push(`${id}: no screenshots available for any describable item`);
    continue;
  }

  try {
    const { narrative, skipped } = await narrateComponent({
      contract,
      screenshotsRoot: SCREENSHOTS_ROOT,
      caption,
      model: MODEL,
    });
    if (!narrative) {
      summary.empty++;
      problems.push(`${id}: nothing describable`);
      continue;
    }
    writeJson(narrativeFile, narrative);
    // The brief is derived from the contract plus the narrative (§8.2), so it
    // can be rebuilt from committed artifacts without re-deriving the contract.
    writeFileSync(
      join(CONTRACTS_DIR, `${id}.brief.md`),
      buildBrief(contract, narrative),
    );
    summary.generated++;
    if (!QUIET) {
      console.log(
        `  ${id.padEnd(22)} ${narrative.variants.length + (narrative.default ? 1 : 0)} described` +
          (skipped.length ? `  ⚠ ${skipped.length} screenshot(s) missing` : ""),
      );
    }
  } catch (error) {
    summary.failed++;
    problems.push(`${id}: ${error.message}`);
    if (!QUIET) console.log(`  ${id.padEnd(22)} FAILED ${error.message}`);
  }
}

if (!DRY_RUN) {
  console.log(
    `\n  generated ${summary.generated}  unchanged ${summary.unchanged}  ` +
      `nothing to describe ${summary.empty}  failed ${summary.failed}`,
  );
  for (const problem of problems) console.log(`  ⚠ ${problem}`);
}

process.exit(summary.failed > 0 ? 1 : 0);
