/**
 * The MCP variant matrix (PRD §6.2).
 *
 * One variant per experiment file. Nothing else about the experiment changes,
 * so any measured difference is attributable to the MCP set — which is the
 * entire point of the package.
 */

import { posix } from "node:path";

import { stagePackage, type StagedPackage } from "./stage";

export { VENDOR_DIR } from "./stage";

/**
 * Where servers are *uploaded*. Necessarily inside the workspace: the docker
 * sandbox extracts every `writeFiles` tar at the container workdir, so there is
 * no way to place a file outside it directly.
 */
export const MCP_UPLOAD_DIR = ".mcp-servers";

/**
 * Where servers actually *run* from — a sibling of the workspace, not a child.
 *
 * The first full matrix (D-26) was confounded because the servers sat in the
 * agent's working directory. With the MCP tools unavailable, the agent listed
 * the workspace, found `.mcp-servers/`, read `dist/tools.js`, and then called
 * the handler functions directly with `node -e "import('./handlers.js')…"`. It
 * obtained the servers' entire payload without a single MCP call, and the run
 * measured content availability rather than tool use.
 *
 * Moving the directory out of the workspace does not make it unreachable — a
 * `find /` still locates it, and `--dangerously-skip-permissions` means nothing
 * blocks the read. It removes the *stumble*, which is how this actually
 * happened. The guarantee comes from the leak detector in `mcp-usage.ts`, which
 * marks any run touching this path `confounded`.
 */
export const MCP_RUNTIME_DIR_NAME = ".agent-eval-mcp";

/**
 * Absolute runtime location.
 *
 * `/tmp` rather than a sibling of the workspace: the sandbox user owns the
 * workspace but not its parent, so `mv` into `/home/sandbox` fails with
 * `Permission denied`. `/tmp` is 1777 on every backend.
 *
 * The parent directory is not load-bearing — the leak detector keys on
 * `MCP_RUNTIME_DIR_NAME`, so it keeps working wherever the servers end up.
 */
export function mcpRuntimeDir(_workingDir: string): string {
  return posix.join("/tmp", MCP_RUNTIME_DIR_NAME);
}

export type VariantKey =
  | "none"
  | "component-builder"
  | "design-tokens"
  | "both";

export interface McpServerSpec {
  /** Name the agent sees in tool identifiers (`mcp__<name>__<tool>`). */
  name: string;
  /** Workspace directory under `packages/`. */
  packageDir: string;
  /** Package subdirectories to upload (all must be built). */
  include: string[];
}

const COMPONENT_BUILDER: McpServerSpec = {
  name: "component-builder",
  packageDir: "component-builder-mcp",
  include: ["dist"],
};

const DESIGN_TOKENS: McpServerSpec = {
  name: "design-tokens",
  packageDir: "design-tokens-mcp",
  // `tokens/` and `rules/` are data the server reads at runtime; without them
  // it starts but answers every query with an empty token set.
  include: ["dist", "tokens", "rules"],
};

const VARIANT_SERVERS: Record<VariantKey, McpServerSpec[]> = {
  none: [],
  "component-builder": [COMPONENT_BUILDER],
  "design-tokens": [DESIGN_TOKENS],
  both: [COMPONENT_BUILDER, DESIGN_TOKENS],
};

/** Where staged servers live inside the sandbox. */
export function serversForVariant(variant: VariantKey): McpServerSpec[] {
  const servers = VARIANT_SERVERS[variant];
  if (!servers) {
    throw new Error(
      `Unknown MCP variant "${variant}". Expected one of: ${Object.keys(VARIANT_SERVERS).join(", ")}`,
    );
  }
  return servers;
}

/**
 * Read and hash everything a variant will upload.
 *
 * Called on the host at experiment-definition time so that a missing build
 * fails before a sandbox is provisioned and before any tokens are spent. The
 * returned list is flat: MCP servers first, then any vendored workspace
 * dependencies they pull in.
 */
export function stageVariant(variant: VariantKey): StagedPackage[] {
  return serversForVariant(variant).flatMap((server) =>
    stagePackage(server.packageDir, server.name, server.include),
  );
}

/**
 * The `.mcp.json` Claude Code reads from the project root.
 *
 * Servers are launched over stdio from the staged build (Decision 6): the run
 * then tests the MCP code in the current commit, not whatever happens to be
 * deployed.
 *
 * Paths are absolute and point outside the workspace, so this file is the only
 * thing in the project tree that so much as names the servers.
 */
export function mcpConfigFor(
  packages: StagedPackage[],
  runtimeDir: string,
): string {
  const mcpServers: Record<string, unknown> = {};
  for (const pkg of packages) {
    if (!pkg.entry) continue; // vendored dependency, not a server
    mcpServers[pkg.key] = {
      command: "node",
      args: [posix.join(runtimeDir, pkg.key, pkg.entry)],
    };
  }
  return JSON.stringify({ mcpServers }, null, 2);
}
