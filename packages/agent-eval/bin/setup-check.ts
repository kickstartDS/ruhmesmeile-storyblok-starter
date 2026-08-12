/**
 * Zero-spend rehearsal of `setupVariant()` against a real container.
 *
 * The first full matrix (D-26) was confounded by a setup defect, and cost a
 * full matrix to discover — because `setup()` had never been exercised except
 * as part of a paid run. The CLI offers no rehearsal: `run` takes `--force`,
 * `--smoke` and `--ack-failures`, and `--smoke` spends real money (D-23).
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
import { stopHostServers } from "../lib/mcp/serve";
import {
  MCP_RUNTIME_DIR_NAME,
  MCP_UPLOAD_DIR,
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
  `Hashed ${packages.length} package(s), ${servers.length} server(s): ` +
    `${servers.map((s) => s.key).join(", ") || "none"}\n` +
    `Nothing is uploaded — servers run on the host over HTTP (ADR 55).\n`,
);

const sandbox = await createSandbox({ backend: "docker", runtime: "node24" });

try {
  const workingDir = sandbox.getWorkingDirectory();

  // The real thing. A server that will not start on the host, or that the
  // container cannot reach across the bridge, throws here — which is the
  // entire point.
  await setupVariant(sandbox, packages);
  console.log("setup() completed — every server answered tools/list.\n");

  assert(
    !(await exists(sandbox, `${workingDir}/${MCP_UPLOAD_DIR}`)),
    "no server tree in the workspace",
    "the agent can list it, read dist/tools.js, and call the handlers directly",
  );
  assert(
    !(await exists(sandbox, `/tmp/${MCP_RUNTIME_DIR_NAME}`)),
    "no server tree beside the workspace either",
    "this is the path `812` lost two arms to (ADR 55)",
  );

  if (servers.length > 0) {
    assert(
      !(await exists(sandbox, "/tmp/mcp-probe.mjs")),
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
      const { type, url } = spec as { type?: string; url?: string };
      assert(
        type === "http" && /^http:\/\/[\d.]+:\d+\/mcp$/.test(url ?? ""),
        `${name} is declared as a host-side HTTP endpoint`,
        `${type} ${url}`,
      );
      // The one file in the sandbox that names a server must name nothing but
      // a URL — no path an agent could follow to the token files.
      const serialized = JSON.stringify(spec);
      assert(
        !serialized.includes(MCP_RUNTIME_DIR_NAME) &&
          !serialized.includes(MCP_UPLOAD_DIR) &&
          !serialized.includes("node"),
        `${name} leaks no filesystem path`,
        serialized,
      );
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
  stopHostServers();
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
