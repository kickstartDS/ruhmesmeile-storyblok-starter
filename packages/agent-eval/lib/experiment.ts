/**
 * Experiment factory.
 *
 * Every experiment file is one line of configuration plus a call to
 * `defineExperiment()`. Keeping the wiring here means a variant cannot
 * accidentally differ from another in anything except its MCP set.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ExperimentConfig, Sandbox } from "@vercel/agent-eval";

import { DEFAULTS, PRIMARY_AGENT, PRIMARY_MODEL } from "../agent-eval.config";
import {
  MCP_STAGING_DIR,
  mcpConfigFor,
  stageVariant,
  type VariantKey,
} from "./mcp/variants";
import { hashStagedPackages, type StagedPackage } from "./mcp/stage";
import { assertFixtureHygiene } from "./fixtures/hygiene";

const PACKAGE_ROOT = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
);

export interface DefineExperimentOptions {
  /**
   * Experiment name. MUST match the file name — the framework derives the
   * results directory from the file name, and the variant-version guard keys
   * off that same directory.
   */
  name: string;
  /** Which MCP servers the agent gets. */
  variant: VariantKey;
  /** Runs per eval. See RUNS in agent-eval.config.ts. */
  runs: number;
  /** Reasoning effort passed through to the agent CLI. */
  effort?: "low" | "medium" | "high";
  /** Eval selection. Defaults to all. */
  evals?: ExperimentConfig["evals"];
}

export function defineExperiment(
  options: DefineExperimentOptions,
): ExperimentConfig {
  assertFixtureHygiene();

  // Staged on the host at module-load time: a missing MCP build then fails
  // before a sandbox is provisioned and before a single token is spent.
  const packages = stageVariant(options.variant);
  // Everything `setup()` puts in the sandbox, not just the staged servers. The
  // baseline stages nothing, so without the settings payload in here a change
  // to DENY_WEB_RESEARCH would be invisible and stale results would be reused.
  const variantVersion = createHash("sha256")
    .update(hashStagedPackages(packages))
    .update(JSON.stringify(DENY_WEB_RESEARCH))
    .digest("hex")
    .slice(0, 16);

  guardVariantVersion(options.name, options.variant, variantVersion);

  return {
    agent: PRIMARY_AGENT,
    model: PRIMARY_MODEL,
    evals: options.evals ?? "*",
    runs: options.runs,
    earlyExit: DEFAULTS.earlyExit,
    scripts: [...DEFAULTS.scripts],
    validation: DEFAULTS.validation,
    timeout: DEFAULTS.timeout,
    sandbox: DEFAULTS.sandbox,
    copyFiles: DEFAULTS.copyFiles,
    agentOptions: options.effort ? { effort: options.effort } : undefined,
    setup: (sandbox) => setupVariant(sandbox, packages),
  };
}

/**
 * Tools denied in every variant.
 *
 * The first baseline run with transcripts showed one of three no-MCP trials
 * searching the web and pulling real kickstartDS source off GitHub —
 * `TagLabelComponent.tsx`, `tag-label.scss`, and the docs site. A control that
 * can fetch the design system the MCP servers encode is not a control, and the
 * gap it closes is exactly the gap we are trying to price.
 *
 * It also breaks the harness in two other ways: it is nondeterministic (one
 * trial in three), and it makes results depend on live web content, which is
 * disqualifying for a regression gate meant to detect model drift over months.
 *
 * Denied everywhere, not just on the baseline, so no variant can quietly
 * substitute web research for an MCP call.
 *
 * NOTE: `--dangerously-skip-permissions` is always passed by the harness and
 * documents itself as bypassing all permission checks. Deny rules are expected
 * to survive it, but that is unverified — check `toolCalls` in
 * `agent-transcript-meta.json` after the next run: `WebFetch` and `WebSearch`
 * must be absent. If they are not, this has to move to a `PreToolUse` hook.
 */
const DENY_WEB_RESEARCH = ["WebSearch", "WebFetch"];

/**
 * Upload the staged MCP servers, install their runtime dependencies, and point
 * Claude Code at them.
 *
 * Every variant — including the `none` baseline, which stages nothing — gets a
 * settings file, because `DENY_WEB_RESEARCH` has to apply everywhere.
 */
async function setupVariant(
  sandbox: Sandbox,
  packages: StagedPackage[],
): Promise<void> {
  const workingDir = sandbox.getWorkingDirectory();

  // Upload everything first: a server's `npm install` resolves `file:` deps
  // against vendored packages that must already be on disk.
  for (const pkg of packages) {
    const prefix = `${MCP_STAGING_DIR}/${pkg.key}`;
    const files: Record<string, string> = {};

    for (const [path, content] of Object.entries(pkg.files)) {
      files[`${prefix}/${path}`] = content;
    }

    files[`${prefix}/package.json`] = JSON.stringify(
      {
        // The real package name is load-bearing: npm installs a `file:`
        // dependency under the name declared in its own manifest.
        name: pkg.packageName,
        version: pkg.version,
        private: true,
        type: "module",
        main: pkg.main,
        dependencies: pkg.dependencies,
      },
      null,
      2,
    );

    await sandbox.writeFiles(files);
  }

  // Vendored dependencies are installed transitively via their `file:` parent,
  // so only the servers themselves need an install.
  for (const pkg of packages) {
    if (!pkg.entry) continue;

    const install = await sandbox.runCommand(
      "npm",
      ["install", "--omit=dev", "--no-audit", "--no-fund"],
      { cwd: `${workingDir}/${MCP_STAGING_DIR}/${pkg.key}` },
    );

    if (install.exitCode !== 0) {
      throw new Error(
        `MCP setup: failed to install dependencies for ${pkg.packageName}\n${install.stderr}`,
      );
    }
  }

  await sandbox.writeFiles({
    ...(packages.length > 0 ? { ".mcp.json": mcpConfigFor(packages) } : {}),
    ".claude/settings.local.json": JSON.stringify(
      {
        // Project-scoped MCP servers are otherwise gated behind an interactive
        // approval prompt, which a `--print` run can never answer. Harmless on
        // the baseline, which declares no servers.
        enableAllProjectMcpServers: true,
        permissions: { deny: DENY_WEB_RESEARCH },
      },
      null,
      2,
    ),
  });
}

/**
 * Detect that `setup()` changed since the last run of this experiment.
 *
 * The framework fingerprints eval files plus a fixed set of config fields
 * (agent, model, scripts, timeout, earlyExit, runs). It cannot hash `setup()`,
 * because functions are not hashable — so a change to the MCP servers we stage
 * is invisible to it, and cached results from the previous MCP build would be
 * reused as if nothing had happened.
 *
 * That is the single most dangerous failure mode in this package: it would not
 * error, it would quietly report last week's numbers as this week's.
 */
function guardVariantVersion(
  experimentName: string,
  variant: VariantKey,
  variantVersion: string,
): void {
  const markerDir = join(PACKAGE_ROOT, "results", experimentName);
  const marker = join(markerDir, ".variant-version");
  const stamp = `${variant}:${variantVersion}`;

  if (!existsSync(marker)) {
    writeMarker(marker, stamp);
    return;
  }

  const previous = readFileSync(marker, "utf-8").trim();
  if (previous === stamp) return;

  if (!process.argv.includes("--force")) {
    throw new Error(
      `Experiment "${experimentName}" was last run against a different MCP build.\n` +
        `  previous: ${previous}\n` +
        `  current:  ${stamp}\n\n` +
        `The framework's fingerprint cannot see setup() changes, so cached results ` +
        `from the previous build would be reused and reported as current.\n` +
        `Re-run with --force to discard them.`,
    );
  }

  writeMarker(marker, stamp);
}

function writeMarker(marker: string, stamp: string): void {
  mkdirSync(dirname(marker), { recursive: true });
  writeFileSync(marker, `${stamp}\n`, "utf-8");
}
