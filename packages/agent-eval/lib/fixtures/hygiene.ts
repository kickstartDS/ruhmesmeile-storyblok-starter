/**
 * Fixture hygiene (D14).
 *
 * Repo-local agent instructions (`.github/copilot-instructions.md`, `CLAUDE.md`,
 * …) encode a large amount of kickstartDS knowledge. If any of it reached a
 * fixture, the baseline variant would silently receive the very guidance the
 * MCP servers are supposed to provide — and every measured MCP delta would
 * collapse toward zero for reasons that have nothing to do with the MCPs.
 *
 * Only the eval fixture directory is uploaded to the sandbox, so repo-root
 * instruction files cannot leak on their own. This guards against someone
 * copying one into a fixture.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "..",
);

const FORBIDDEN_FILES = [
  "CLAUDE.md",
  "AGENTS.md",
  ".cursorrules",
  ".windsurfrules",
  "GEMINI.md",
  join(".github", "copilot-instructions.md"),
];

const FORBIDDEN_DIRS = [join(".github", "instructions"), ".cursor", ".claude"];

/**
 * Throw if any eval fixture carries agent instructions.
 *
 * Called from `defineExperiment()` so it fails at config load, before a sandbox
 * exists and before any spend.
 */
export function assertFixtureHygiene(
  evalsDir = join(PACKAGE_ROOT, "evals"),
): void {
  if (!existsSync(evalsDir)) return;

  const violations: string[] = [];

  for (const entry of readdirSync(evalsDir)) {
    const fixtureDir = join(evalsDir, entry);
    if (!statSync(fixtureDir).isDirectory()) continue;

    for (const file of FORBIDDEN_FILES) {
      if (existsSync(join(fixtureDir, file))) {
        violations.push(`${entry}/${file}`);
      }
    }
    for (const dir of FORBIDDEN_DIRS) {
      if (existsSync(join(fixtureDir, dir))) {
        violations.push(`${entry}/${dir}/`);
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Fixture hygiene violation — agent instructions found inside eval fixtures:\n` +
        violations.map((v) => `  - ${v}`).join("\n") +
        `\n\nEvery variant, including the baseline, must start from the same ` +
        `instruction-free fixture. Guidance may only reach the agent through an ` +
        `MCP server under test.`,
    );
  }
}
