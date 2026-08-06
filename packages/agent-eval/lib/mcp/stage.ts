/**
 * Staging of built MCP server packages into the sandbox.
 *
 * The sandbox has no access to the host filesystem, and `Sandbox.writeFiles()`
 * only accepts UTF-8 strings — so we cannot ship a packed tarball. Both MCP
 * servers compile to plain JS and ship text-only data (JSON/CSS), so we read
 * the built package from the workspace, upload it file-by-file, and install its
 * runtime dependencies from the registry inside the sandbox.
 *
 * Workspace-protocol dependencies (`@kickstartds/shared-auth`) exist on no
 * registry, so they are vendored alongside the server and referenced as `file:`
 * dependencies, recursively.
 *
 * The hash of everything we upload becomes the variant version, which is how we
 * detect that `setup()` changed — something the framework's fingerprint cannot
 * see, because it never hashes `setup()`.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));

/** Monorepo root, resolved from packages/agent-eval/lib/mcp/. */
export const WORKSPACE_ROOT = resolve(HERE, "..", "..", "..", "..");

/** Subdirectory holding vendored workspace dependencies. */
export const VENDOR_DIR = "_vendor";

/**
 * Extensions we are willing to upload. Everything an MCP server needs is text;
 * anything else is either a build artifact we do not need or a binary we cannot
 * transfer, and silently mangling it would produce a confusing runtime failure.
 */
const TEXT_EXTENSIONS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".ts",
  ".css",
  ".scss",
  ".md",
  ".txt",
  ".yml",
  ".yaml",
  ".map",
]);

export interface StagedPackage {
  /** Path under `.mcp-servers/`, e.g. `design-tokens` or `_vendor/shared-auth`. */
  key: string;
  /** npm package name. */
  packageName: string;
  version: string;
  /** Package-relative path -> file content. */
  files: Record<string, string>;
  /** Dependencies for the staged package.json, workspace specs resolved. */
  dependencies: Record<string, string>;
  /** `main` from the source manifest — npm resolves `file:` deps through it. */
  main: string;
  /** Entry point for MCP servers; `null` for vendored dependencies. */
  entry: string | null;
}

interface WorkspaceManifest {
  name: string;
  version: string;
  main?: string;
  files?: string[];
  dependencies?: Record<string, string>;
}

let workspaceIndex: Map<string, string> | null = null;

/** name -> absolute package directory, for every package under `packages/`. */
function getWorkspaceIndex(): Map<string, string> {
  if (workspaceIndex) return workspaceIndex;

  const index = new Map<string, string>();
  const packagesDir = join(WORKSPACE_ROOT, "packages");

  for (const entry of readdirSync(packagesDir)) {
    const manifestPath = join(packagesDir, entry, "package.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(
      readFileSync(manifestPath, "utf-8"),
    ) as WorkspaceManifest;
    index.set(manifest.name, join(packagesDir, entry));
  }

  workspaceIndex = index;
  return index;
}

function collectTextFiles(
  dir: string,
  rootDir: string,
  out: Record<string, string>,
): void {
  for (const entry of readdirSync(dir).sort()) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectTextFiles(full, rootDir, out);
      continue;
    }
    const ext = entry.slice(entry.lastIndexOf("."));
    if (!TEXT_EXTENSIONS.has(ext)) continue;
    out[relative(rootDir, full).split(/[\\/]/).join("/")] = readFileSync(
      full,
      "utf-8",
    );
  }
}

function readManifest(pkgPath: string): WorkspaceManifest {
  const manifestPath = join(pkgPath, "package.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `MCP staging: no package.json at ${manifestPath}. Is the workspace checked out?`,
    );
  }
  return JSON.parse(readFileSync(manifestPath, "utf-8")) as WorkspaceManifest;
}

function collectIncludes(
  pkgPath: string,
  manifest: WorkspaceManifest,
  include: string[],
): Record<string, string> {
  const files: Record<string, string> = {};
  for (const sub of include) {
    const subDir = join(pkgPath, sub);
    if (!existsSync(subDir)) {
      throw new Error(
        `MCP staging: ${manifest.name} is missing "${sub}/". Run ` +
          `\`pnpm --filter ${manifest.name} build\` before running evals.`,
      );
    }
    collectTextFiles(subDir, pkgPath, files);
  }
  return files;
}

/** `@kickstartds/shared-auth` -> `_vendor/kickstartds-shared-auth` */
function vendorKeyFor(packageName: string): string {
  return `${VENDOR_DIR}/${packageName.replace(/^@/, "").replace(/\//g, "-")}`;
}

/**
 * Read a built workspace package and prepare it — plus every workspace
 * dependency it pulls in — for upload.
 *
 * @param packageDir Directory name under `packages/`.
 * @param key        Directory name to use inside `.mcp-servers/`.
 * @param include    Subdirectories of the package to upload (must be built).
 */
export function stagePackage(
  packageDir: string,
  key: string,
  include: string[],
): StagedPackage[] {
  const pkgPath = join(WORKSPACE_ROOT, "packages", packageDir);
  const manifest = readManifest(pkgPath);
  const files = collectIncludes(pkgPath, manifest, include);

  const entry = "dist/index.js";
  if (!files[entry]) {
    throw new Error(
      `MCP staging: ${manifest.name} has no built ${entry}. Run ` +
        `\`pnpm --filter ${manifest.name} build\` before running evals.`,
    );
  }

  const vendored: StagedPackage[] = [];
  const dependencies = resolveDependencies(manifest, key, vendored, new Set());

  return [
    {
      key,
      packageName: manifest.name,
      version: manifest.version,
      files,
      dependencies,
      main: manifest.main ?? entry,
      entry,
    },
    ...vendored,
  ];
}

/**
 * Rewrite workspace-protocol dependencies into `file:` references, staging the
 * referenced package as we go.
 *
 * @param fromKey Staging key of the package these dependencies belong to —
 *                `file:` specifiers are resolved relative to it.
 */
function resolveDependencies(
  manifest: WorkspaceManifest,
  fromKey: string,
  vendored: StagedPackage[],
  seen: Set<string>,
): Record<string, string> {
  const index = getWorkspaceIndex();
  const resolved: Record<string, string> = {};

  for (const [name, spec] of Object.entries(manifest.dependencies ?? {})) {
    if (!spec.startsWith("workspace:")) {
      resolved[name] = spec;
      continue;
    }

    const depPath = index.get(name);
    if (!depPath) {
      throw new Error(
        `MCP staging: ${manifest.name} depends on "${name}" via the workspace ` +
          `protocol, but no package under packages/ declares that name.`,
      );
    }

    const depKey = vendorKeyFor(name);
    resolved[name] = `file:${relativeStagingPath(fromKey, depKey)}`;

    if (seen.has(name)) continue;
    seen.add(name);

    const depManifest = readManifest(depPath);
    const staged: StagedPackage = {
      key: depKey,
      packageName: depManifest.name,
      version: depManifest.version,
      files: collectIncludes(
        depPath,
        depManifest,
        depManifest.files ?? ["dist"],
      ),
      dependencies: {},
      main: depManifest.main ?? "dist/index.js",
      entry: null,
    };

    // Registered before recursing so a diamond dependency is staged once.
    vendored.push(staged);
    staged.dependencies = resolveDependencies(
      depManifest,
      depKey,
      vendored,
      seen,
    );
  }

  return resolved;
}

/** Relative path from one staging key to another, for `file:` specifiers. */
function relativeStagingPath(fromKey: string, toKey: string): string {
  return `${"../".repeat(fromKey.split("/").length)}${toKey}`;
}

/**
 * Deterministic hash of everything a variant uploads. This is the signal the
 * framework's fingerprint is blind to (it hashes eval files plus a fixed set of
 * config fields, never `setup()`).
 */
export function hashStagedPackages(packages: StagedPackage[]): string {
  const hash = createHash("sha256");
  for (const pkg of [...packages].sort((a, b) => a.key.localeCompare(b.key))) {
    hash.update(`pkg:${pkg.key}@${pkg.version}\n`);
    hash.update(`deps:${JSON.stringify(pkg.dependencies)}\n`);
    for (const path of Object.keys(pkg.files).sort()) {
      hash.update(`file:${path}\n`);
      hash.update(pkg.files[path]);
      hash.update("\0");
    }
  }
  return hash.digest("hex").slice(0, 16);
}
