/**
 * The known-token registry.
 *
 * Read from `packages/design-tokens-mcp/tokens/`, which is synced from the
 * design system at build time and is the same data the Design Tokens MCP
 * serves. Grading against the MCP's own source means a token the MCP would have
 * recommended can never be scored as unknown.
 *
 * Degrades to `loaded: false` if the token package has not been built, and
 * token conformance then reports itself inapplicable rather than failing every
 * trial for a local tooling gap.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WORKSPACE_ROOT = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "..",
  "..",
  "..",
);

const TOKENS_DIR = join(
  WORKSPACE_ROOT,
  "packages",
  "design-tokens-mcp",
  "tokens",
);

export interface TokenRegistry {
  loaded: boolean;
  /** `--ks-brand-*` — the branding layer. */
  branding: Set<string>;
  /** `--ks-*` minus branding — the semantic layer. */
  semantic: Set<string>;
  /** `--dsa-*` — component tokens shipped by the design system. */
  component: Set<string>;
  source: string;
}

let cached: TokenRegistry | null = null;

function collectDeclarations(source: string, into: Set<string>): void {
  // Custom property declarations only (`--name:`), not usages, so a token that
  // is merely referenced somewhere never counts as defined.
  for (const match of source.matchAll(/(--[a-zA-Z0-9-_]+)\s*:/g)) {
    into.add(match[1]!);
  }
}

function walkFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkFiles(full, out);
    else if (/\.(scss|css)$/.test(entry)) out.push(full);
  }
  return out;
}

export function loadTokenRegistry(): TokenRegistry {
  if (cached) return cached;

  const all = new Set<string>();
  const files = walkFiles(TOKENS_DIR);

  for (const file of files) {
    collectDeclarations(readFileSync(file, "utf-8"), all);
  }

  const branding = new Set<string>();
  const semantic = new Set<string>();
  const component = new Set<string>();

  for (const name of all) {
    if (name.startsWith("--ks-brand-")) branding.add(name);
    else if (name.startsWith("--ks-")) semantic.add(name);
    else if (name.startsWith("--dsa-")) component.add(name);
  }

  cached = {
    loaded: files.length > 0 && semantic.size > 0,
    branding,
    semantic,
    component,
    source: TOKENS_DIR,
  };
  return cached;
}
