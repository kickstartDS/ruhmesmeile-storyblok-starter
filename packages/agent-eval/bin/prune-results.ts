#!/usr/bin/env tsx
/**
 * 2.10 — retention pruning.
 *
 *   pnpm results:prune            # show what would go
 *   pnpm results:prune --apply    # actually delete
 *   pnpm results:prune --keep 20
 *
 * A campaign is 60 trials and roughly half a gigabyte once reports are built,
 * and the results tree is append-only: every re-run of a task leaves the
 * previous timestamp behind. D10 sets the policy — keep the last 10 runs per
 * experiment, plus anything explicitly pinned — and this implements it.
 *
 * Three deliberate safety properties, because this deletes paid-for data that
 * no amount of money can reproduce identically:
 *
 * It is a dry run unless told otherwise. Printing the plan is the default and
 * `--apply` is the exception, so the destructive path is never the one you get
 * by mistyping an argument.
 *
 * Pins are honoured before counting. A run named in `results/<experiment>/
 * .pinned` (one timestamp per line, `#` comments allowed) is never eligible,
 * regardless of age — that is what makes a baseline you compare against for a
 * year survive a policy written for scratch runs.
 *
 * And *current* runs are pinned implicitly. Timestamps differ per eval, so an
 * experiment's newest ten directories are not the same set as the runs it is
 * currently reporting: re-running one task leaves the other four still pointing
 * at an older batch. `resolveMatrix()` knows which those are, and a policy that
 * ignored it would eventually delete a live result and only be noticed by the
 * report going blank.
 */

import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { join, relative } from "node:path";

import {
  listExperiments,
  listRuns,
  resolveMatrix,
  RESULTS_ROOT,
} from "../lib/graders/trial";

const DEFAULT_KEEP = 10;
const PIN_FILE = ".pinned";

/** Timestamps pinned for an experiment, if it has a pin file. */
function pinnedFor(experiment: string): Set<string> {
  const path = join(RESULTS_ROOT, experiment, PIN_FILE);
  if (!existsSync(path)) return new Set();

  return new Set(
    readFileSync(path, "utf8")
      .split("\n")
      .map((line) => line.replace(/#.*$/, "").trim())
      .filter(Boolean),
  );
}

/** Bytes on disk under a directory. */
function sizeOf(dir: string): number {
  let total = 0;
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const child = join(current, entry.name);
      if (entry.isDirectory()) walk(child);
      else total += statSync(child).size;
    }
  };
  walk(dir);
  return total;
}

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function main(): void {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const keepIndex = argv.indexOf("--keep");
  const keep =
    keepIndex >= 0 && argv[keepIndex + 1]
      ? Number(argv[keepIndex + 1])
      : DEFAULT_KEEP;

  if (!Number.isInteger(keep) || keep < 1) {
    throw new Error(`--keep must be a positive integer, got "${keep}".`);
  }

  let reclaimed = 0;
  let removals = 0;

  for (const experiment of listExperiments()) {
    const pinned = pinnedFor(experiment);
    const current = new Set(
      resolveMatrix(experiment).map((entry) => entry.timestamp),
    );

    // `listRuns` is chronological; newest last. Keep the tail, and never count
    // a pinned or currently-reported run against the budget — each is retained
    // on its own ticket.
    const runs = listRuns(experiment);
    const eligible = runs.filter(
      (run) => !pinned.has(run) && !current.has(run),
    );
    const doomed = eligible.slice(0, Math.max(0, eligible.length - keep));

    if (!doomed.length) {
      console.log(
        `${experiment} — ${runs.length} run(s), ${pinned.size} pinned, ` +
          `${current.size} current, nothing to prune.`,
      );
      continue;
    }

    console.log(
      `\n${experiment} — ${runs.length} run(s), keeping ${keep} plus ` +
        `${current.size} current and ${pinned.size} pinned:`,
    );
    for (const run of doomed) {
      const dir = join(RESULTS_ROOT, experiment, run);
      const size = sizeOf(dir);
      reclaimed += size;
      removals += 1;

      console.log(
        `  ${apply ? "removed" : "would remove"}  ${run}  ${mb(size)}`,
      );
      if (apply) rmSync(dir, { recursive: true, force: true });
    }
  }

  console.log(
    `\n${apply ? "Removed" : "Would remove"} ${removals} run(s), ` +
      `${mb(reclaimed)} under ${relative(process.cwd(), RESULTS_ROOT)}.`,
  );
  if (!apply && removals) {
    console.log("Re-run with --apply to delete. Pin runs to keep in .pinned.");
  }
}

main();
