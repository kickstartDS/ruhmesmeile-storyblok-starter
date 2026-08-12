/**
 * 3.4 — the judge CLI.
 *
 * Dry by default. `bin/prune-results.ts` established the convention for the one
 * other command in this package that does something irreversible, and spending
 * money qualifies: running this with no flags prints what it would ask, of
 * which model, and what that would cost, and stops. `--apply` is the only thing
 * that opens a socket.
 *
 * Verdicts are cached per trial, keyed by model and criterion text, so
 * `--apply` twice in a row is free the second time and editing one rubric
 * re-runs one rubric. That is what makes the calibration loop in 3.7 —
 * "iterate until the judge agrees with a human 80% of the time" — something
 * that can actually be iterated.
 *
 *   pnpm judge cc-both-sonnet-high/810-atom-from-schema      # dry, one eval
 *   pnpm judge --all                                          # dry, everything
 *   pnpm judge --all --apply                                  # spends
 */

import { parseAddress, resolveTrials } from "../lib/address";
import {
  listExperiments,
  loadEval,
  resolveMatrix,
  type Trial,
} from "../lib/graders/trial";
import {
  askable,
  checkDivergence,
  estimateCost,
  judgeTrial,
  JUDGE_MODEL_ID,
  plan,
  verifyPin,
} from "../lib/judge/run";

const address = (trial: Trial): string =>
  `${trial.experiment}/${trial.evalName}/run-${trial.run}`;

/**
 * Report the trials where the structural rubric fails and the conventional one
 * passes — competent but foreign.
 *
 * This was written as an invariant check, on 48 trials with no inversion, and
 * exited non-zero when one appeared. One appeared on the first run under the
 * rewritten criteria, the reasoning held up, and the claim is retired (D-139).
 * What is left is worth printing for its own sake: a candidate that clears
 * every mechanical convention check and is still built wrong is the case the
 * deterministic graders cannot reach.
 */
function reportDivergence(trials: Trial[]): void {
  for (const report of checkDivergence(trials)) {
    const share = `${report.foreign.length} of ${report.comparable} comparable`;
    console.log(
      `\nCompetent but foreign — ${report.structural} fails, ${report.conventional} passes: ${share}`,
    );
    for (const trial of report.foreign) console.log(`  ${trial}`);
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const all = argv.includes("--all");
  const apply = argv.includes("--apply");
  const [target] = argv.filter((arg) => !arg.startsWith("--"));

  if (!all && !target) {
    throw new Error(
      "Usage: pnpm judge <experiment>/<eval>[/run-N] | --all  [--apply]",
    );
  }

  const trials = all
    ? listExperiments().flatMap((experiment) =>
        resolveMatrix(experiment).flatMap((entry) =>
          loadEval(experiment, entry.timestamp, entry.evalName),
        ),
      )
    : resolveTrials(parseAddress(target));

  const planned = trials.map((trial) => ({ trial, calls: plan(trial) }));
  const outstanding = planned.flatMap((entry) =>
    entry.calls.filter((call) => !call.cached),
  );
  const cached = planned.flatMap((entry) =>
    entry.calls.filter((call) => call.cached),
  );

  console.log(`Judge model: ${JUDGE_MODEL_ID}`);
  console.log(
    `${trials.length} trial(s) — ${outstanding.length} rubric call(s) to make, ${cached.length} already answered.`,
  );

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apply) {
    // The estimate is the point of the dry run, but a pin that does not resolve
    // is the thing that would waste the most time, so check it here rather than
    // discovering it on call one of two hundred and forty.
    if (apiKey) {
      try {
        const { ok, available } = await verifyPin(apiKey);
        console.log(
          ok
            ? `Pin resolves. ✓`
            : `Pin does NOT resolve. Available:\n  ${available.join("\n  ")}`,
        );
      } catch (error) {
        console.log(`Could not verify pin: ${(error as Error).message}`);
      }
    } else {
      console.log("ANTHROPIC_API_KEY unset — cannot verify the pin.");
    }

    console.log(`Estimated cost: $${estimateCost(outstanding).toFixed(2)}`);
    for (const entry of planned.slice(0, 3)) {
      for (const call of entry.calls) {
        console.log(
          `  ${address(entry.trial)}  ${call.rubric.id}  ~${call.estimatedInputTokens} in${call.cached ? "  (cached)" : ""}`,
        );
      }
    }
    if (planned.length > 3) console.log(`  … and ${planned.length - 3} more`);
    reportDivergence(trials);
    console.log("\nDry run. Pass --apply to spend.");
    return;
  }

  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");

  for (const [index, { trial }] of planned.entries()) {
    const results = await judgeTrial(trial, apiKey);
    // Not every verdict on disk is one this run asked for. `judgeTrial` hands
    // back the whole cache, so an unfiltered summary reports a narrowed
    // rubric's old answer as though it were fresh — which is what printed
    // `design-intent=pass` beside all twelve `812` trials the first time.
    const live = askable(trial);
    const summary = results
      .filter((result) => live.has(result.rubric))
      .map((result) => `${result.rubric}=${result.verdict}`)
      .join(" ");
    console.log(
      `[${index + 1}/${planned.length}] ${address(trial)}  ${summary}`,
    );
  }

  console.log(`\nDone. Verdicts cached next to each trial as judge.json.`);
  reportDivergence(trials);
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
