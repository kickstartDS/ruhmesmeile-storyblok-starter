/**
 * The MCP variant matrix (PRD §6.2).
 *
 * One variant per experiment file. Nothing else about the experiment changes,
 * so any measured difference is attributable to the MCP set — which is the
 * entire point of the package.
 */

import { stagePackage, type StagedPackage } from "./stage";

export { VENDOR_DIR } from "./stage";

/**
 * Where servers were *uploaded*, back when they were uploaded at all.
 *
 * Nothing writes here any more — the servers run on the host over HTTP (ADR 55)
 * and no server file enters the sandbox. The constant survives because the leak
 * detector still watches for the path: if a future change reintroduces staging
 * without reintroducing the detection, the confounding returns silently.
 */
export const MCP_UPLOAD_DIR = ".mcp-servers";

/**
 * Where servers used to *run* from — a sibling of the workspace.
 *
 * Also historical, and kept for the same reason. The full story is worth
 * keeping because it is the argument for the current design:
 *
 * The first full matrix (D-26) was confounded because the servers sat in the
 * agent's working directory. With the MCP tools unavailable, the agent listed
 * the workspace, found `.mcp-servers/`, read `dist/tools.js`, and then called
 * the handler functions directly with `node -e "import('./handlers.js')…"`. It
 * obtained the servers' entire payload without a single MCP call.
 *
 * Moving the directory to `/tmp` removed the stumble but not the capability,
 * and `812` proved it: agents read the design-tokens server's own token files
 * out of `/tmp/.agent-eval-mcp/design-tokens/tokens/`, because `.mcp.json` sat
 * in the working directory naming the absolute path. For a stdio server that is
 * unfixable — the agent's user must be able to execute the server, so it must
 * be able to read it.
 *
 * The fix was to stop shipping the files at all. See `lib/mcp/serve.ts`.
 */
export const MCP_RUNTIME_DIR_NAME = ".agent-eval-mcp";

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
  /** Package subdirectories to hash (all must be built). */
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
  // `tokens/` and `rules/` are data the server reads at runtime. They no longer
  // travel anywhere, but they still have to be hashed: re-syncing tokens from
  // the design system changes what this arm answers, and stale results from
  // before the sync must not be reported as current.
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
 * Read and hash everything a variant will expose.
 *
 * Called on the host at experiment-definition time so that a missing build
 * fails before a sandbox is provisioned and before any tokens are spent. The
 * returned list is flat: MCP servers first, then any vendored workspace
 * dependencies they pull in.
 *
 * Nothing here is uploaded any more — the servers run on the host (ADR 55). The
 * staging pass survives because it is also what feeds `variantVersion`, and the
 * servers are the system under test: a rebuilt server has to invalidate results
 * whether or not it travels.
 */
export function stageVariant(variant: VariantKey): StagedPackage[] {
  return serversForVariant(variant).flatMap((server) =>
    stagePackage(server.packageDir, server.name, server.include),
  );
}

/**
 * The `.mcp.json` Claude Code reads from the project root.
 *
 * One `type: "http"` entry per server, pointing at the host across the docker
 * bridge. This file is the only thing in the sandbox that so much as mentions
 * the servers, and all it now leaks is a URL — not a source tree, and not the
 * design-tokens server's token files, which is what `812` actually lost arms to
 * (ADR 55).
 */
export function mcpConfigFor(
  packages: StagedPackage[],
  hostAddress: string,
  ports: Record<string, number>,
): string {
  const mcpServers: Record<string, unknown> = {};
  for (const pkg of packages) {
    if (!pkg.entry) continue; // vendored dependency, not a server
    const port = ports[pkg.key];
    if (!port) {
      throw new Error(`No host port resolved for MCP server "${pkg.key}".`);
    }
    mcpServers[pkg.key] = {
      type: "http",
      url: mcpUrl(hostAddress, port),
    };
  }
  return JSON.stringify({ mcpServers }, null, 2);
}

/** The Streamable HTTP endpoint both servers expose. */
export function mcpUrl(hostAddress: string, port: number): string {
  return `http://${hostAddress}:${port}/mcp`;
}

/**
 * Look a server spec up by the name it is staged under.
 *
 * `StagedPackage` carries the npm package name, not the workspace directory,
 * and the two differ for every server we ship. Deriving one from the other is
 * exactly the kind of guess that breaks the first time a package is renamed.
 */
export function serverSpec(name: string): McpServerSpec {
  const spec = [COMPONENT_BUILDER, DESIGN_TOKENS].find(
    (candidate) => candidate.name === name,
  );
  if (!spec) throw new Error(`Unknown MCP server "${name}".`);
  return spec;
}
