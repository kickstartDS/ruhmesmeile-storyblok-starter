/**
 * The MCP variant matrix (PRD §6.2).
 *
 * One variant per experiment file. Nothing else about the experiment changes,
 * so any measured difference is attributable to the MCP set — which is the
 * entire point of the package.
 */

import { stagePackage, type StagedPackage } from "./stage";

export { VENDOR_DIR } from "./stage";

/** Where staged servers live inside the sandbox. */
export const MCP_STAGING_DIR = ".mcp-servers";

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
 */
export function mcpConfigFor(packages: StagedPackage[]): string {
  const mcpServers: Record<string, unknown> = {};
  for (const pkg of packages) {
    if (!pkg.entry) continue; // vendored dependency, not a server
    mcpServers[pkg.key] = {
      command: "node",
      args: [`${MCP_STAGING_DIR}/${pkg.key}/${pkg.entry}`],
    };
  }
  return JSON.stringify({ mcpServers }, null, 2);
}
