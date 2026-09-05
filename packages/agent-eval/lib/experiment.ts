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
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { ExperimentConfig, ModelTier, Sandbox } from "@vercel/agent-eval";

import { DEFAULTS, PRIMARY_AGENT, PRIMARY_MODEL } from "../agent-eval.config";
import {
  mcpConfigFor,
  mcpUrl,
  serverSpec,
  stageVariant,
  type VariantKey,
} from "./mcp/variants";
import { ensureHostServer } from "./mcp/serve";
import { hashStagedPackages, type StagedPackage } from "./mcp/stage";
import { assertFixtureHygiene } from "./fixtures/hygiene";
import { evalsInTier } from "./graders/targets";

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
  /**
   * The model to run against. Defaults to `PRIMARY_MODEL`.
   *
   * Declared per experiment because the results directory is the file name and
   * the file name carries the model label. Leaving the model to come only from
   * `PRIMARY_MODEL` — i.e. from `EVAL_MODEL` in the caller's shell — meant
   * `EVAL_MODEL=haiku` would write Haiku trials into `cc-*-sonnet-high/` with
   * nothing objecting, and `collectRun()`, the published report and the
   * calibration candidate pool all aggregate by directory. Two models would
   * have been averaged together under a name asserting one of them, with the
   * only evidence in the `model` field of each individual `result.json`, which
   * nothing groups by. (D-117, ADR 82.)
   */
  model?: ModelTier;
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
    model: options.model ?? PRIMARY_MODEL,
    evals: selectedEvals(options.evals ?? defaultEvals()),
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
const SETUP_VERSION = "6-host-http-transport";

/** The in-sandbox reachability probe, shipped as-is. */
const PROBE_SOURCE = readFileSync(
  fileURLToPath(new URL("./mcp/probe-http.mjs", import.meta.url)),
  "utf-8",
);

/**
 * Point the sandbox at the host-side MCP servers, prove it can reach them, and
 * lock down web research.
 *
 * Nothing is uploaded. The servers run on the host in Streamable HTTP mode and
 * the sandbox gets a URL, because every version of shipping them into the
 * container leaked (ADR 55, D-26): first the agent read `.mcp-servers/` out of
 * its own working directory, then \u2014 once they were moved to `/tmp` \u2014 it read
 * the design-tokens server's token files out of the absolute path `.mcp.json`
 * names. A stdio server cannot be hidden from the user that has to execute it.
 *
 * Every variant \u2014 including the `none` baseline, which stages nothing \u2014 gets a
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
  // The fixture's own dependencies are NOT installed here. The framework's
  // agent definition already runs `npm install` in the workspace as its first
  // install step, so declaring a dependency in the eval's `package.json` is
  // sufficient — doing it again would just pay for the install twice.

  const servers = packages.filter((pkg) => pkg.entry);

  if (servers.length > 0) {
    const ports: Record<string, number> = {};
    for (const server of servers) {
      ports[server.key] = await ensureHostServer(
        server.key,
        serverSpec(server.key).packageDir,
      );
    }

    const hostAddress = await resolveHostAddress(sandbox);
    await probeHostServers(sandbox, servers, hostAddress, ports);

    await sandbox.writeFiles({
      ".mcp.json": mcpConfigFor(packages, hostAddress, ports),
    });
  }

  await sandbox.writeFiles({
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
 * redirect goes through here.
 */
function shell(sandbox: Sandbox, command: string) {
  return sandbox.runCommand("bash", ["-c", command]);
}

/**
 * The address the sandbox uses to reach the host.
 *
 * `host.docker.internal` is not an option: the framework's docker backend
 * hardcodes `HostConfig: { AutoRemove: true }` and exposes no hook for
 * `ExtraHosts`, so on Linux that name does not resolve. The container's default
 * gateway is the bridge, which is the host — read straight out of
 * `/proc/net/route` rather than shelling out to `ip`, which `node:24-slim` does
 * not ship.
 *
 * The gateway is stored there as little-endian hex, hence the byte reversal.
 */
async function resolveHostAddress(sandbox: Sandbox): Promise<string> {
  const read = await sandbox.runCommand("node", [
    "-e",
    "const l=require('fs').readFileSync('/proc/net/route','utf8').split('\\n').slice(1)" +
      ".map(s=>s.split(/\\s+/)).find(f=>f[1]==='00000000');" +
      "if(!l)process.exit(1);" +
      "const h=l[2];console.log([6,4,2,0].map(i=>parseInt(h.substr(i,2),16)).join('.'));",
  ]);

  const address = read.stdout.trim();

  if (read.exitCode !== 0 || !/^\d+\.\d+\.\d+\.\d+$/.test(address)) {
    throw new Error(
      `MCP setup: could not determine the host address from inside the sandbox.\n` +
        `${read.stderr.trim() || read.stdout.trim()}\n\n` +
        `Without it the servers are unreachable and the run would measure a ` +
        `variant that silently has no MCP at all.`,
    );
  }

  return address;
}

/**
 * Speak JSON-RPC to every server over the exact URL the agent will use, from
 * inside the container, and require a non-empty tool list.
 *
 * Runs before the agent, so an unreachable server costs a container start
 * rather than an experiment. This checks strictly more than the old stdio probe
 * did: it covers the host process, the bridge, and the HTTP transport together.
 */
async function probeHostServers(
  sandbox: Sandbox,
  servers: StagedPackage[],
  hostAddress: string,
  ports: Record<string, number>,
): Promise<void> {
  const probePath = "/tmp/mcp-probe.mjs";
  const uploadName = ".mcp-probe.mjs";

  await sandbox.writeFiles({ [uploadName]: PROBE_SOURCE });
  const place = await shell(
    sandbox,
    `mv '${sandbox.getWorkingDirectory()}/${uploadName}' '${probePath}'`,
  );
  if (place.exitCode !== 0) {
    throw new Error(`MCP setup: could not place the probe\n${place.stderr}`);
  }

  try {
    for (const server of servers) {
      const url = mcpUrl(hostAddress, ports[server.key]);
      const probe = await sandbox.runCommand("node", [probePath, url]);

      if (probe.exitCode !== 0) {
        throw new Error(
          `MCP setup: server "${server.key}" did not answer tools/list at ${url}.\n` +
            `${probe.stdout.trim() || probe.stderr.trim()}\n\n` +
            `The server is unreachable, so the run would measure a variant that ` +
            `silently has no MCP at all.`,
        );
      }
    }
  } finally {
    // Nothing left lying around that hints at how the sandbox reaches the host.
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
 * Which evals an experiment runs when it does not name any itself.
 *
 * Not `"*"`. Phase 1 priced a greenfield trial at $4.24–$5.67 and an edit trial
 * at $0.23; with `"*"` every fixture added joins all four arms, so the suite's
 * cost is set by its most expensive tasks and there is a standing disincentive
 * to add cheap ones. Tiering removes that: `core` is the edit and diff tasks
 * and is cheap enough to run on every campaign, `extra` is the
 * build-from-scratch tasks and is bought deliberately.
 *
 *   pnpm eval cc-none-sonnet-high                    # core only
 *   EVAL_EXTRA_EVALS=1 pnpm eval cc-none-sonnet-high # the full suite
 *
 * The tier lives in `TARGETS`, which is already the per-eval registry and is
 * already host-side. A fixture with no target entry is not silently dropped —
 * `assertFixtureHygiene()` fails first.
 */
function defaultEvals(): string[] | "*" {
  const extra = process.env.EVAL_EXTRA_EVALS?.trim();
  if (extra && extra !== "0" && extra !== "false") return "*";
  return evalsInTier("core");
}

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

  const raw = readFileSync(marker, "utf-8");

  // A marker that exists but holds nothing is debris, not history.
  //
  // `results/{experiment}/` is created before the first trial runs, so a crash
  // or a kill in that window leaves a zero-byte marker behind — and the guard
  // then compared the stamp against the empty string, failed, and refused every
  // subsequent run of that experiment with "was last run against a different
  // MCP build" plus a drift summary admitting it could not attribute the
  // change. The only way out was `--force`, on an experiment that had never
  // produced a result to discard.
  //
  // Treated as absent instead. An empty marker means no run ever finished under
  // it, so there is nothing the guard exists to protect.
  if (raw.trim() === "") {
    writeMarker(marker, stamp, parts);
    return;
  }

  const previous = raw.trim().split("\n")[0]!.trim();
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
  //
  // There is no `--dry`. `run` accepts `--force`, `--smoke` and
  // `--ack-failures`, and nothing else — so the only zero-spend escape is a
  // read-only command.
  const argv = process.argv.slice(2);
  const spends =
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

  const moved = Object.keys(parts).filter(
    (key) => previous[key] !== parts[key],
  );
  if (!moved.length) return "";

  return (
    `\n  changed: ${moved.join(", ")}\n` +
    moved
      .map(
        (key) =>
          `    ${key.padEnd(9)} ${previous[key] ?? "?"} -> ${parts[key]}`,
      )
      .join("\n") +
    "\n"
  );
}

function writeMarker(marker: string, stamp: string, parts: VariantParts): void {
  mkdirSync(dirname(marker), { recursive: true });
  // Staged through a temporary file because `writeFileSync` is not atomic: a
  // kill mid-write leaves a truncated marker, which is how the empty-marker
  // case above came to exist. `renameSync` within one directory is atomic, so
  // the marker is either the old content or the new one, never a fragment.
  const staging = `${marker}.${process.pid}.tmp`;
  writeFileSync(
    staging,
    `${stamp}\n${JSON.stringify(parts, null, 2)}\n`,
    "utf-8",
  );
  renameSync(staging, marker);
}
