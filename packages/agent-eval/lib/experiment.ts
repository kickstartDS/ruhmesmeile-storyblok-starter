/**
 * Experiment factory.
 *
 * Every experiment file is one line of configuration plus a call to
 * `defineExperiment()`. Keeping the wiring here means a variant cannot
 * accidentally differ from another in anything except its MCP set.
 */

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ExperimentConfig, Sandbox } from "@vercel/agent-eval";

import { DEFAULTS, PRIMARY_AGENT, PRIMARY_MODEL } from "../agent-eval.config";
import {
  MCP_UPLOAD_DIR,
  mcpConfigFor,
  mcpRuntimeDir,
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
  //
  // Kept as named parts rather than one opaque digest: a campaign is bought in
  // chunks over days, and when this fires the only question that matters is
  // which input moved. "The MCP build changed" justifies re-running the arm;
  // "a formatter touched probe.mjs" justifies reverting one file and keeping
  // the results. One hash cannot tell those apart.
  const parts = {
    staged: hashStagedPackages(packages),
    settings: shortHash(JSON.stringify(DENY_WEB_RESEARCH)),
    probe: shortHash(PROBE_SOURCE),
    setup: SETUP_VERSION,
  };
  const variantVersion = shortHash(Object.values(parts).join("\u0000"));

  guardVariantVersion(options.name, options.variant, variantVersion, parts);

  return {
    agent: PRIMARY_AGENT,
    model: PRIMARY_MODEL,
    evals: selectedEvals(options.evals ?? "*"),
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
 * Bump on any `setupVariant()` change the framework's fingerprint cannot see.
 *
 * `computeFingerprint` hashes the eval directory plus agent/model/scripts/
 * timeout/earlyExit/runs. It does not hash `setup()`. Staged packages and
 * `DENY_WEB_RESEARCH` are folded into the variant hash explicitly below, but
 * anything else we change in here — the shape of `.mcp.json`, the settings
 * payload, an added install step — is invisible, and stale results from the
 * previous build would be silently reported as current.
 */
const SETUP_VERSION = "5-vendored-deps-installed-servers-outside-workspace";

/** The in-sandbox JSON-RPC liveness probe, shipped as-is. */
const PROBE_SOURCE = readFileSync(
  fileURLToPath(new URL("./mcp/probe.mjs", import.meta.url)),
  "utf-8",
);

/**
 * Upload the staged MCP servers, install their dependencies, move them out of
 * the agent's reach, prove they answer `tools/list`, and point Claude Code at
 * them.
 *
 * Every variant — including the `none` baseline, which stages nothing — gets a
 * settings file, because `DENY_WEB_RESEARCH` has to apply everywhere.
 *
 * Exported for `bin/setup-check.ts`, which rehearses this against a real
 * container without running an agent. Do not call it from an experiment file:
 * `defineExperiment()` wires it up, and going around that skips the
 * variant-version guard.
 */
export async function setupVariant(
  sandbox: Sandbox,
  packages: StagedPackage[],
): Promise<void> {
  const workingDir = sandbox.getWorkingDirectory();
  const runtimeDir = mcpRuntimeDir(workingDir);

  // The fixture's own dependencies are NOT installed here. The framework's
  // agent definition already runs `npm install` in the workspace as its first
  // install step, so declaring a dependency in the eval's `package.json` is
  // sufficient — doing it again would just pay for the install twice.

  // Upload everything first: a server's `npm install` resolves `file:` deps
  // against vendored packages that must already be on disk.
  for (const pkg of packages) {
    const prefix = `${MCP_UPLOAD_DIR}/${pkg.key}`;
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

  // Every staged package with dependencies needs its own install, vendored
  // ones included.
  //
  // It is tempting to assume a `file:` dependency is installed through its
  // parent — npm does place its transitive deps in the parent's tree. But npm
  // links `file:` deps rather than copying them, and Node resolves from a
  // symlink's *realpath*: code in `_vendor/kickstartds-shared-auth/dist/` looks
  // in `_vendor/…/node_modules`, then `_vendor/node_modules`, and never in the
  // server's `node_modules` where npm actually put things. That assumption is
  // what killed the first matrix — both servers died on startup with
  // `Cannot find package 'jsonwebtoken'`, Claude Code exposed no tools, and the
  // agent read the servers off disk instead (D-26).
  //
  // Vendored packages go first so a server's `file:` link always points at a
  // directory that is already complete.
  const installOrder = [...packages].sort(
    (a, b) => Number(Boolean(a.entry)) - Number(Boolean(b.entry)),
  );

  for (const pkg of installOrder) {
    if (Object.keys(pkg.dependencies).length === 0) continue;

    const install = await sandbox.runCommand(
      "npm",
      ["install", "--omit=dev", "--no-audit", "--no-fund"],
      { cwd: `${workingDir}/${MCP_UPLOAD_DIR}/${pkg.key}` },
    );

    if (install.exitCode !== 0) {
      throw new Error(
        `MCP setup: failed to install dependencies for ${pkg.packageName}\n${install.stderr}`,
      );
    }
  }

  if (packages.length > 0) {
    await relocateOutOfWorkspace(sandbox, workingDir, runtimeDir);
    await probeStagedServers(sandbox, runtimeDir, packages);
  }

  await sandbox.writeFiles({
    ...(packages.length > 0
      ? { ".mcp.json": mcpConfigFor(packages, runtimeDir) }
      : {}),
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
 * `Sandbox` exposes only `runCommand`; the backends have a `runShell`, but it
 * is not on the published interface. Anything needing globbing, `&&`, or a
 * move goes through here.
 */
function shell(sandbox: Sandbox, command: string) {
  return sandbox.runCommand("bash", ["-c", command]);
}

/**
 * Move the servers from the upload directory to a sibling of the workspace.
 *
 * `writeFiles` cannot target anything outside the workspace — the docker
 * backend extracts every upload tar at the container workdir — so the servers
 * have to land inside it and be moved afterwards. See `MCP_RUNTIME_DIR_NAME`
 * for why they cannot be left there.
 */
async function relocateOutOfWorkspace(
  sandbox: Sandbox,
  workingDir: string,
  runtimeDir: string,
): Promise<void> {
  const move = await shell(
    sandbox,
    `rm -rf '${runtimeDir}' && mv '${workingDir}/${MCP_UPLOAD_DIR}' '${runtimeDir}'`,
  );

  if (move.exitCode !== 0) {
    throw new Error(
      `MCP setup: could not move the staged servers out of the workspace.\n` +
        `  from: ${workingDir}/${MCP_UPLOAD_DIR}\n` +
        `  to:   ${runtimeDir}\n` +
        `Leaving them in the workspace is not an option — the agent reads them ` +
        `directly and the run silently stops measuring MCP use (D-26).\n` +
        move.stderr,
    );
  }
}

/**
 * Speak JSON-RPC to every staged server and require a non-empty tool list.
 *
 * Runs before the agent, so a dead server costs a container start rather than
 * an experiment.
 */
async function probeStagedServers(
  sandbox: Sandbox,
  runtimeDir: string,
  packages: StagedPackage[],
): Promise<void> {
  const probePath = `${runtimeDir}/probe.mjs`;
  const uploadName = `${MCP_UPLOAD_DIR}-probe.mjs`;

  await sandbox.writeFiles({ [uploadName]: PROBE_SOURCE });
  const place = await shell(
    sandbox,
    `mv '${sandbox.getWorkingDirectory()}/${uploadName}' '${probePath}'`,
  );
  if (place.exitCode !== 0) {
    throw new Error(`MCP setup: could not place the probe\n${place.stderr}`);
  }

  try {
    for (const pkg of packages) {
      if (!pkg.entry) continue;

      const probe = await sandbox.runCommand("node", [
        probePath,
        `${runtimeDir}/${pkg.key}/${pkg.entry}`,
      ]);

      if (probe.exitCode !== 0) {
        throw new Error(
          `MCP setup: server "${pkg.key}" did not answer tools/list.\n` +
            `${probe.stdout.trim() || probe.stderr.trim()}\n\n` +
            `The server is unusable, so the run would measure a variant that ` +
            `silently has no MCP at all.`,
        );
      }
    }
  } finally {
    // Nothing left lying around that hints at where the servers went.
    await shell(sandbox, `rm -f '${probePath}'`);
  }
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
type VariantParts = Record<string, string>;

const EVALS_ROOT = join(PACKAGE_ROOT, "evals");

/** CLI subcommands that never spend. `run` is absent: it does. */
const READ_ONLY_COMMANDS = new Set([
  "status",
  "refingerprint",
  "playground",
  "init",
]);

/**
 * Which evals this invocation is allowed to run.
 *
 * A full matrix is ~$310, so it gets bought in chunks. The CLI has no per-eval
 * filter, and running one eval across all arms is the chunk shape that keeps
 * results comparable — it completes whole rows, so the campaign can stop at any
 * point and still have a matrix rather than a ragged pile.
 *
 * Scoping happens here rather than by editing the config, because the eval list
 * is not part of `computeFingerprint` — narrowing it cannot invalidate results
 * for the evals that do run.
 *
 *   EVAL_ONLY=860-restraint pnpm eval cc-none-sonnet-high cc-both-sonnet-high
 *
 * An unknown name is fatal. Silently matching nothing would look like a
 * finished chunk, and silently matching everything would spend the whole
 * budget — both are worse than stopping.
 */
function selectedEvals<T>(configured: T): T | string[] {
  const raw = process.env.EVAL_ONLY?.trim();
  if (!raw) return configured;

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  const available = existsSync(EVALS_ROOT)
    ? readdirSync(EVALS_ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
    : [];

  const unknown = requested.filter((name) => !available.includes(name));
  if (unknown.length) {
    throw new Error(
      `EVAL_ONLY names an eval that does not exist: ${unknown.join(", ")}\n` +
        `  available: ${available.join(", ")}`,
    );
  }

  return requested;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function guardVariantVersion(
  experimentName: string,
  variant: VariantKey,
  variantVersion: string,
  parts: VariantParts,
): void {
  const markerDir = join(PACKAGE_ROOT, "results", experimentName);
  const marker = join(markerDir, ".variant-version");
  const stamp = `${variant}:${variantVersion}`;

  if (!existsSync(marker)) {
    writeMarker(marker, stamp, parts);
    return;
  }

  const previous = readFileSync(marker, "utf-8").trim().split("\n")[0]!.trim();
  if (previous === stamp) return;

  if (!process.argv.includes("--force")) {
    throw new Error(
      `Experiment "${experimentName}" was last run against a different MCP build.\n` +
        `  previous: ${previous}\n` +
        `  current:  ${stamp}\n` +
        describeDrift(marker, parts) +
        `\nThe framework's fingerprint cannot see setup() changes, so cached results ` +
        `from the previous build would be reused and reported as current.\n` +
        `Re-run with --force to discard them.`,
    );
  }

  // Only a spending run may advance the marker. `--force` is also accepted by
  // commands that spend nothing, and merely loading the config under those
  // would stamp the results as current while they are still from the old build
  // — silently destroying the very signal this guard exists to raise.
  //
  // Written as an inversion on purpose. The obvious version, `argv.includes
  // ("run")`, is wrong: the CLI's primary form is `agent-eval <experiment>`
  // with no subcommand at all, so a real run would never advance the marker and
  // every subsequent invocation would demand `--force` forever.
  //
  // `--smoke` is excluded because it deletes only its own results; advancing on
  // it would stamp everything it did *not* re-run as current.
  const argv = process.argv.slice(2);
  const spends =
    !argv.includes("--dry") &&
    !argv.includes("--smoke") &&
    !argv.some((arg) => READ_ONLY_COMMANDS.has(arg));
  if (!spends) return;

  writeMarker(marker, stamp, parts);
}

/**
 * Name the inputs that moved, so the fix is obvious.
 *
 * Older markers only stored the stamp, so there is nothing to compare against;
 * say so rather than implying everything changed.
 */
function describeDrift(marker: string, parts: VariantParts): string {
  let previous: VariantParts;
  try {
    const lines = readFileSync(marker, "utf-8").trim().split("\n").slice(1);
    previous = JSON.parse(lines.join("\n")) as VariantParts;
  } catch {
    return `\n  (marker predates per-input tracking — cannot attribute the change)\n`;
  }

  const moved = Object.keys(parts).filter((key) => previous[key] !== parts[key]);
  if (!moved.length) return "";

  return (
    `\n  changed: ${moved.join(", ")}\n` +
    moved
      .map((key) => `    ${key.padEnd(9)} ${previous[key] ?? "?"} -> ${parts[key]}`)
      .join("\n") +
    "\n"
  );
}

function writeMarker(
  marker: string,
  stamp: string,
  parts: VariantParts,
): void {
  mkdirSync(dirname(marker), { recursive: true });
  writeFileSync(marker, `${stamp}\n${JSON.stringify(parts, null, 2)}\n`, "utf-8");
}
