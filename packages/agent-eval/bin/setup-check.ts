/**
 * Zero-spend rehearsal of `setupVariant()` against a real container.
 *
 * The first full matrix (D-26) was confounded by a setup defect, and cost a
 * full matrix to discover — because `setup()` had never been exercised except
 * as part of a paid run. `--dry` does not help: it previews fingerprints and
 * never provisions a sandbox.
 *
 * This provisions the same docker image the harness uses, runs the real setup
 * path, and asserts the properties Decision 22 depends on. No agent, no model,
 * no tokens — the only cost is a container start.
 *
 * It deliberately does NOT import an experiment file: `defineExperiment()`
 * writes the `.variant-version` marker at module load, and doing that here
 * would make a subsequent real run skip the `--force` prompt it is supposed to
 * raise.
 *
 * Usage: pnpm setup:check [variant]      (default: both)
 */

import { createSandbox, type Sandbox } from "@vercel/agent-eval";

import { setupVariant } from "../lib/experiment";
import {
  MCP_UPLOAD_DIR,
  mcpRuntimeDir,
  stageVariant,
  type VariantKey,
} from "../lib/mcp/variants";

const VARIANTS: VariantKey[] = [
  "none",
  "component-builder",
  "design-tokens",
  "both",
];

const variant = (process.argv[2] ?? "both") as VariantKey;
if (!VARIANTS.includes(variant)) {
  console.error(
    `Unknown variant "${variant}". Expected one of: ${VARIANTS.join(", ")}`,
  );
  process.exit(2);
}

const failures: string[] = [];

function assert(ok: boolean, label: string, detail?: string): void {
  if (ok) {
    console.log(`  \u2713 ${label}`);
    return;
  }
  console.log(`  \u2717 ${label}${detail ? `\n      ${detail}` : ""}`);
  failures.push(label);
}

async function exists(sandbox: Sandbox, path: string): Promise<boolean> {
  const probe = await sandbox.runCommand("bash", [
    "-c",
    `test -e '${path}' && echo yes || echo no`,
  ]);
  return probe.stdout.trim() === "yes";
}

console.log(`\nSetup check — variant "${variant}", no agent, no spend.\n`);

const packages = stageVariant(variant);
const servers = packages.filter((pkg) => pkg.entry);
console.log(
  `Staged ${packages.length} package(s), ${servers.length} server(s): ` +
    `${servers.map((s) => s.key).join(", ") || "none"}\n`,
);

const sandbox = await createSandbox({ backend: "docker", runtime: "node24" });

try {
  const workingDir = sandbox.getWorkingDirectory();
  const runtimeDir = mcpRuntimeDir(workingDir);

  // The real thing. A dead server, a failed install, or a workspace we cannot
  // move out of throws here — which is the entire point.
  await setupVariant(sandbox, packages);
  console.log("setup() completed — every staged server answered tools/list.\n");

  assert(
    !(await exists(sandbox, `${workingDir}/${MCP_UPLOAD_DIR}`)),
    "the upload directory is gone from the workspace",
    "the agent can list it, read dist/tools.js, and call the handlers directly",
  );

  if (servers.length > 0) {
    assert(
      await exists(sandbox, runtimeDir),
      `servers live outside the workspace (${runtimeDir})`,
    );
    assert(
      !(await exists(sandbox, `${runtimeDir}/probe.mjs`)),
      "the probe cleaned up after itself",
    );

    const config = JSON.parse(
      await sandbox.readFile(`${workingDir}/.mcp.json`),
    );
    const entries = Object.entries(config.mcpServers ?? {});

    assert(
      entries.length === servers.length,
      `.mcp.json declares all ${servers.length} server(s)`,
      `declares ${entries.length}`,
    );

    for (const [name, spec] of entries) {
      const arg = (spec as { args?: string[] }).args?.[0] ?? "";
      assert(
        arg.startsWith(runtimeDir),
        `${name} is launched from outside the workspace`,
        arg,
      );
      assert(await exists(sandbox, arg), `${name} entry point exists`, arg);
    }
  } else {
    assert(
      !(await exists(sandbox, `${workingDir}/.mcp.json`)),
      "the baseline declares no MCP servers",
    );
  }

  const settings = JSON.parse(
    await sandbox.readFile(`${workingDir}/.claude/settings.local.json`),
  );
  assert(
    settings.enableAllProjectMcpServers === true,
    "project MCP servers are pre-approved",
  );
  assert(
    Array.isArray(settings.permissions?.deny) &&
      settings.permissions.deny.includes("WebFetch") &&
      settings.permissions.deny.includes("WebSearch"),
    "web research is denied",
  );
} finally {
  await (sandbox as unknown as { stop: () => Promise<void> }).stop();
}

if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed. Do not start a run.\n`);
  process.exit(1);
}

console.log(
  "\nSetup is sound. What this does NOT prove: that Claude Code goes on to\n" +
    "expose the tools to the agent. Only a real run shows that — watch for\n" +
    "`mcp-usage/reached-mcp` and the `confounded` class when grading it.\n",
);
