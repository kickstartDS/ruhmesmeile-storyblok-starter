/**
 * Bundle each eval's source into the `EVAL.ts` the sandbox runs.
 *
 * Why a build step rather than an import: `TEST_FILE_PATTERNS` inside
 * `@vercel/agent-eval` is the hardcoded list `['EVAL.ts', 'EVAL.tsx',
 * 'PROMPT.md']` and it is matched on *basename*. EVAL.ts is therefore the only
 * filename that is withheld from the agent. A `harness.ts` sitting next to it
 * would be uploaded into the workspace, where it would tell the agent that we
 * read its tool calls and score its token usage — an observer effect on four of
 * the dimensions this package exists to measure. Bundling keeps the shared code
 * in one editable place and still ships a single self-contained EVAL.ts.
 *
 * For the same reason the per-eval sources live in `lib/eval-harness/sources/`
 * and not in the fixture: anything inside `evals/<name>/` other than EVAL.ts
 * and PROMPT.md is uploaded, and an `eval.src.ts` next to the fixture would
 * hand the agent the exact assertions it is graded against (ADR Decision 17).
 *
 *   pnpm build:evals           regenerate every EVAL.ts
 *   pnpm build:evals --check   fail if any is stale (wired into `typecheck`)
 *
 * The generated files are committed, because the fingerprint the harness uses
 * to decide whether an experiment needs re-running hashes the eval directory as
 * it sits on disk.
 */

import { build } from "esbuild";
import { format as prettierFormat } from "prettier";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EVALS_DIR = join(ROOT, "evals");
const SOURCES_DIR = join(ROOT, "lib", "eval-harness", "sources");
const OUTPUT_NAME = "EVAL.ts";

const BANNER = `/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Built from lib/eval-harness/sources/<name>.ts + lib/eval-harness/harness.ts
 * by bin/build-evals.ts. Run \`pnpm build:evals\` after changing either.
 *
 * Committed on purpose: the experiment fingerprint hashes the eval directory as
 * it sits on disk. The sources live outside evals/ because everything in a
 * fixture except EVAL.ts and PROMPT.md is uploaded to the sandbox.
 */`;

async function bundle(
  sourceFile: string,
  fixtureDir: string,
): Promise<string> {
  const result = await build({
    entryPoints: [sourceFile],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    target: "node24",
    // Bundle relative imports (the harness) and leave every bare specifier
    // alone — vitest, react and the CJS probes must resolve in the sandbox.
    packages: "external",
    banner: { js: BANNER },
    legalComments: "none",
    // The runtime probe imports the component under test by a path only known
    // at runtime. esbuild cannot analyse it and says so; that is intended.
    logOverride: { "unsupported-dynamic-import": "silent" },
    logLevel: "silent",
    // Digests of the fixture as shipped, baked in at build time.
    //
    // These were hand-copied constants until a wrong one cost a four-arm run:
    // `860` asserts the agent leaves the component-token partial alone, and the
    // recorded hash did not match the file. Every arm left the file untouched —
    // perfect restraint — and every arm was failed for it. The eval could not
    // have passed, which PRD §10 calls broken rather than hard.
    //
    // Deriving them here means the constant and the fixture cannot disagree:
    // editing a fixture file changes the generated EVAL.ts, which `--check`
    // reports as stale and the fingerprint sees as a changed eval.
    define: {
      __FIXTURE_DIGESTS__: JSON.stringify(fixtureDigests(fixtureDir)),
    },
  });

  const output = result.outputFiles?.[0];
  if (!output) throw new Error(`esbuild produced no output for ${sourceFile}`);

  // Run the bundle through prettier before it is written.
  //
  // Without this, the repo formatter and this generator fight forever: prettier
  // rewraps the committed output, `--check` then calls it stale, rebuilding
  // unformats it again. Formatting here makes a fresh build and a formatted
  // working tree byte-identical, which is what `--check` needs to mean
  // anything. It also keeps the fingerprint stable across a `pnpm format`.
  return prettierFormat(output.text, { parser: "typescript" });
}

/**
 * sha256 of every file under the fixture's `src/`, keyed by sandbox-relative
 * POSIX path.
 *
 * Only `src/` is walked. `package.json` and `tsconfig.json` are legitimately
 * rewritten by agents installing dependencies, and hashing them would fail
 * honest work.
 */
function fixtureDigests(fixtureDir: string): Record<string, string> {
  const root = join(fixtureDir, "src");
  const digests: Record<string, string> = {};
  if (!existsSync(root)) return digests;

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const key = relative(fixtureDir, full).split(sep).join("/");
      digests[key] = createHash("sha256")
        .update(readFileSync(full))
        .digest("hex");
    }
  };

  walk(root);
  return digests;
}

async function main() {
  const check = process.argv.includes("--check");

  const names = readdirSync(SOURCES_DIR)
    .filter((entry) => entry.endsWith(".ts"))
    .map((entry) => entry.slice(0, -3))
    .sort();

  if (!names.length) {
    console.error(`no eval sources under ${SOURCES_DIR}`);
    process.exit(1);
  }

  const stale: string[] = [];

  for (const name of names) {
    const evalDir = join(EVALS_DIR, name);
    if (!existsSync(evalDir)) {
      console.error(`  MISSING fixture directory evals/${name}`);
      process.exit(1);
    }

    const generated = await bundle(join(SOURCES_DIR, `${name}.ts`), evalDir);
    const target = join(evalDir, OUTPUT_NAME);
    const current = existsSync(target) ? readFileSync(target, "utf-8") : null;

    if (current === generated) {
      console.log(`  ok      ${name}`);
      continue;
    }

    if (check) {
      stale.push(name);
      console.log(`  STALE   ${name}`);
      continue;
    }

    writeFileSync(target, generated);
    console.log(`  written ${name}`);
  }

  if (stale.length) {
    console.error(
      `\n${stale.length} generated EVAL.ts file(s) are stale. Run: pnpm build:evals`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
