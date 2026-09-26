#!/usr/bin/env tsx
/**
 * Print an experiment's token and cost totals in the shape a provider invoice
 * quotes them, so the estimate can be laid next to a real bill.
 *
 *   pnpm invoice <experiment> [timestamp] [--all-runs]
 *
 * Exists because the campaign's USD figures are an estimate built from
 * transcript `usage` blocks and a hand-maintained price table, and neither has
 * ever been checked against money actually spent. The DeepSeek spike was the
 * first check and found two errors at once (D-173): the price table had cache
 * reads at 50× the real rate, and two scripts were summing each API call ~3.6×
 * because Claude Code repeats a message's `usage` once per content block.
 *
 * Two conventions matter when comparing:
 *
 *  - Novita's dashboard quotes "Input Tokens" *inclusive* of cache reads, so
 *    its input column is this report's input + cacheRead. Both are printed.
 *  - A dashboard can lag the run. On the spike it was five calls behind, which
 *    read as a 23% overestimate until the tail landed. Compare call counts
 *    before concluding the model is wrong.
 *
 * And two ways this report is structurally narrower than a bill, both of which
 * a provider charges for and neither of which leaves a transcript to read:
 *
 *  - **Superseded runs.** `resolveMatrix` keeps the newest run per eval, which
 *    is right for grading and wrong for reconciliation: re-running a failed
 *    eval does not refund the first attempt. `--all-runs` walks every run
 *    directory instead.
 *  - **Trials with no transcript.** A trial killed at the timeout wrote
 *    nothing, so `efficiencyOf` reports `available: false` and contributes
 *    zero — while the provider billed every call it made up to the kill. These
 *    are counted and printed as `unaccounted` rather than skipped in silence,
 *    because a blind spot invisible in the output is one that gets mistaken
 *    for a pricing error (D-176).
 */

import { efficiencyOf } from "../lib/graders/efficiency";
import {
  listRuns,
  loadEval,
  loadRun,
  resolveMatrix,
  type Trial,
} from "../lib/graders/trial";
import { costOf } from "../lib/report/cost";

const args = process.argv.slice(2);
const allRuns = args.includes("--all-runs");
const [experiment, timestamp] = args.filter((a) => !a.startsWith("--"));
if (!experiment) {
  console.error("usage: pnpm invoice <experiment> [timestamp] [--all-runs]");
  process.exit(1);
}

// A run id is a path, not a bare stamp: a vendor-qualified model contributes
// its own directories, so this experiment's runs are keyed
// `deepseek/deepseek-v4.1-flash/2026-…Z`. Match on the trailing segment so the
// timestamp the user reads off the filesystem, or off `results`, is the one
// they can pass (D-171 is the same shape one layer down).
const matchesRun = (run: string) =>
  !timestamp || run === timestamp || run.endsWith(`/${timestamp}`);

const totals = {
  calls: 0,
  trials: 0,
  unaccounted: 0,
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  usd: 0,
};
const models = new Set<string>();

function account(trial: Trial) {
  const efficiency = efficiencyOf(trial);
  if (!efficiency.available) {
    totals.unaccounted += 1;
    return;
  }
  const model = trial.transcript?.summary?.observedModel;
  if (model) models.add(model);

  totals.trials += 1;
  totals.calls += efficiency.turns;
  totals.input += efficiency.tokens.input;
  totals.output += efficiency.tokens.output;
  totals.cacheRead += efficiency.tokens.cacheRead;
  totals.cacheWrite += efficiency.tokens.cacheWrite;
  totals.usd += costOf(efficiency, model).total;
}

if (allRuns) {
  for (const run of listRuns(experiment)) {
    if (!matchesRun(run)) continue;
    for (const trial of loadRun(experiment, run)) account(trial);
  }
} else {
  for (const entry of resolveMatrix(experiment)) {
    if (!matchesRun(entry.timestamp)) continue;
    for (const trial of loadEval(experiment, entry.timestamp, entry.evalName)) {
      account(trial);
    }
  }
}

if (!totals.trials) {
  console.error(
    `No graded trials under ${experiment}${timestamp ? `/${timestamp}` : ""}.`,
  );
  process.exit(1);
}

const n = (v: number) => v.toLocaleString();
console.log(`\n${experiment}${timestamp ? ` @ ${timestamp}` : " (all runs)"}`);
console.log(
  `  scope             ${allRuns ? "every run on disk" : "current matrix"}`,
);
console.log(`  model(s)          ${[...models].join(", ") || "unknown"}`);
console.log(`  trials            ${totals.trials}`);
if (totals.unaccounted) {
  console.log(
    `  unaccounted       ${totals.unaccounted} trial(s) with no transcript — billed, not counted below`,
  );
}
console.log(`  requests          ${n(totals.calls)}`);
console.log(`  input (net)       ${n(totals.input)}`);
console.log(
  `  input (incl.cache)${n(totals.input + totals.cacheRead).padStart(12)}`,
);
console.log(`  cache read        ${n(totals.cacheRead)}`);
console.log(`  cache write       ${n(totals.cacheWrite)}`);
console.log(`  output            ${n(totals.output)}`);
console.log(`  estimated         $${totals.usd.toFixed(6)}\n`);
