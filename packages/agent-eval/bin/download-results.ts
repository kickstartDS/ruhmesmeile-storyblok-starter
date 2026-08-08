#!/usr/bin/env tsx
/**
 * 2.12 — pulling results down from CI.
 *
 *   pnpm results:download                      # newest run of the eval workflow
 *   pnpm results:download --run 12345678       # one specific workflow run
 *   pnpm results:download --limit 5            # the last five runs
 *   pnpm results:download --from ./some/dir    # merge a tree you already have
 *
 * Campaigns are expensive enough that where they ran should not decide where
 * they can be read. This merges an artifact tree into the local `results/` so
 * that grading, reports and the index work identically against trials this
 * machine paid for and trials CI did.
 *
 * The merge is idempotent because a finished run is immutable: once
 * `<experiment>/<timestamp>/` exists it is never rewritten, so downloading the
 * same workflow run twice is a no-op rather than a way to lose the reports and
 * screenshots that were built locally on top of it. That asymmetry is the whole
 * design — CI owns the trial, this machine owns everything derived from it.
 *
 * Artifacts are located structurally rather than by name. Anything containing
 * `<experiment>/<timestamp>/<eval>/summary.json` is a results tree, whatever
 * prefix the artifact download wrapped it in, so this does not break the first
 * time someone renames a workflow artifact.
 */

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative } from "node:path";

import { RESULTS_ROOT } from "../lib/graders/trial";

/** Directories that never contain results and are expensive to walk. */
const SKIP = new Set(["node_modules", ".git", "storybook-static"]);

function flag(name: string): string | undefined {
  const argv = process.argv.slice(2);
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
}

function gh(args: string[]): string {
  try {
    return execFileSync("gh", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    const detail = (error as { stderr?: string }).stderr?.trim();
    throw new Error(
      `gh ${args[0]} failed${detail ? `: ${detail}` : ""}.\n` +
        `The GitHub CLI must be installed and authenticated (gh auth login), ` +
        `or use --from <dir> to merge a tree you already have.`,
    );
  }
}

/** Workflow run ids to fetch, newest first. */
function runIds(): string[] {
  const explicit = flag("run");
  if (explicit) return [explicit];

  const limit = Number(flag("limit") ?? 1);
  const listed = gh([
    "run",
    "list",
    "--workflow",
    flag("workflow") ?? "agent-eval.yml",
    "--status",
    "completed",
    "--limit",
    String(limit),
    "--json",
    "databaseId",
  ]);

  return (JSON.parse(listed) as Array<{ databaseId: number }>).map((run) =>
    String(run.databaseId),
  );
}

/**
 * Every `<experiment>/<timestamp>` directory in a downloaded tree.
 *
 * Found by locating `summary.json`, which sits at
 * `<experiment>/<timestamp>/<eval>/summary.json` — so the run directory is two
 * levels up and the experiment name is three.
 */
function runDirsIn(root: string): string[] {
  const found = new Set<string>();

  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name)) walk(join(dir, entry.name));
      } else if (entry.name === "summary.json") {
        found.add(dirname(dir));
      }
    }
  };

  walk(root);
  return [...found].sort();
}

/** Copies a run into place unless it is already there. Returns what happened. */
function merge(runDir: string): "added" | "present" {
  const timestamp = basename(runDir);
  const experiment = basename(dirname(runDir));
  const destination = join(RESULTS_ROOT, experiment, timestamp);

  if (existsSync(destination)) return "present";

  cpSync(runDir, destination, { recursive: true });
  return "added";
}

function main(): void {
  const from = flag("from");
  const scratch = from ? null : mkdtempSync(join(tmpdir(), "agent-eval-dl-"));

  try {
    const roots: string[] = [];

    if (from) {
      roots.push(from);
    } else {
      for (const id of runIds()) {
        const into = join(scratch!, id);
        console.log(`Downloading workflow run ${id}…`);
        gh(["run", "download", id, "--dir", into]);
        roots.push(into);
      }
    }

    let added = 0;
    let present = 0;

    for (const root of roots) {
      for (const runDir of runDirsIn(root)) {
        const outcome = merge(runDir);
        if (outcome === "added") added += 1;
        else present += 1;

        console.log(
          `  ${outcome === "added" ? "added   " : "present "}` +
            `${basename(dirname(runDir))}/${basename(runDir)}`,
        );
      }
    }

    console.log(
      `\n${added} run(s) added, ${present} already present, under ` +
        `${relative(process.cwd(), RESULTS_ROOT)}.`,
    );
    if (added) console.log("Run `pnpm report:index` to refresh the index.");
  } finally {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  }
}

main();
